# Palette recovery from anti-aliased, lossy charts

Research resolving [`04-palette-recovery`](../../.scratch/chart-parsing/issues/04-palette-recovery.md).
Question: how to recover a small design Palette from a screenshot holding 121,369 distinct RGB values.

Everything below is either cited to a primary source (official scikit-learn / scikit-image / OpenCV /
SciPy / Pillow docs, or a paper) or measured directly on the example chart
(`tests/examples/112w150h.png`, 1074×1428). Measurements are marked **[measured]** and the
probe scripts are described in [Reproducing the measurements](#reproducing-the-measurements).

---

## Recommendation, up front

**Sample first, cluster second.** Robust per-Cell interior sampling comes first; clustering runs on
~19k Cell colours, never on 1.5M raw pixels. Concretely:

1. **Harvest a Palette from strictly-flat pixels** (global, no grid needed). Pixels whose 3×3
   neighbourhood is constant in all channels. **[measured]** 17.9% of the example's pixels qualify and
   they carry **13 distinct RGB values** — down from 121,369, with no clustering at all.
2. **Merge near-duplicates** in CIELAB with `AgglomerativeClustering(n_clusters=None,
   distance_threshold≈3.0, linkage="complete")`. **[measured]** 13, minus one single-pixel speck, minus
   two merges → **10 Palette entries**.
3. **Sample each Cell's interior** (a ~4×4 patch at the Cell centre of an 8.85px Cell) and take the
   **per-channel median**.
4. **Assign** each Cell to the nearest Palette entry in CIELAB. **[measured]** 96.95% of Cells land
   within ΔE 2 of an entry; median ΔE 0.34.
5. **Use the assignment residual as the acceptance signal**, not silhouette. Cells beyond a residual
   threshold are flagged for the rescue path, and a residual cluster that is a genuinely new hue
   (rather than a darkened variant of an existing entry) means the Palette is short an entry.

k is never guessed. It falls out of step 1–2. k-means is used only as an optional refinement or
fallback, and if it is used it is run on Cell colours in Lab, never on raw pixels.

---

## 1. The evidence for the ordering

This is the ticket's key question, so it goes first. Three measurements settle it.

### 1a. Noise lives at Cell edges; interiors are already nearly clean

**[measured]** Restricting to pixels whose local neighbourhood is flat collapses the colour count
catastrophically (window = neighbourhood size, tol = max per-channel range allowed inside it):

| window | tol | pixels kept | distinct RGB | buckets > 0.2% |
|---|---|---|---|---|
| — (all pixels) | — | 1,533,672 (100%) | **121,369** | 21 |
| 3×3 | 0 | 273,968 (17.9%) | **13** | 10 |
| 3×3 | 4 | 555,374 (36.2%) | 1,132 | 27 |
| 3×3 | 8 | 685,126 (44.7%) | 4,619 | 33 |
| 5×5 | 0 | 220,292 (14.4%) | **11** | 5 |
| 7×7 | 8 | 320,315 (20.9%) | 370 | 20 |

The 13 colours at 3×3/tol=0, by share of flat pixels:

```
rgb(255,255,255) 81.49%   rgb(110,109,113) 11.08%   rgb(135,156,107)  1.89%
rgb(250,154,  9)  1.35%   rgb(247,198, 59)  1.22%   rgb(143,100, 84)  0.94%
rgb(109,108,112)  0.85%   rgb( 27, 27, 27)  0.42%   rgb( 94,118, 86)  0.40%
rgb( 88, 67, 48)  0.24%   rgb(218,213,208)  0.08%   rgb(254,254,254)  0.04%
rgb(100,100,100)  0.00% (1 px)
```

That is a Palette, essentially by inspection. Three of the thirteen are near-duplicates:
`(254,254,254)` is ΔE2000 **0.2** from white, `(109,108,112)` is ΔE2000 **0.4** from the grey, and
`(100,100,100)` is a single pixel. Every other entry's nearest neighbour is ΔE2000 **≥ 4.2**, most
**≥ 14.8**. The gap between "duplicate" and "distinct Palette entry" is two orders of magnitude wide,
which is why a fixed merge threshold works and needs no tuning.

Note this does not contradict the established quantized-lattice figures (white 21.45%, grey 18.91% at
a 24-step lattice). **[measured]** at exact RGB, white is 18.22% and the largest single grey is 7.51%
— the grey's mass is spread across a cloud of exact values that the lattice re-collects. The spread
*is* the compression noise the ticket describes.

### 1b. Interior sampling beats whole-Cell sampling, and the difference is the gridline bias

Grid pitch recovered by DFT of the gradient projection: **[measured]** 8.8533 px in x, 8.8535 px in y,
giving a 120 × 160 = 19,200-Cell lattice (consistent with the map's ~9px pitch and ~112×152 estimate;
exact lattice recovery is [ticket 03](../../.scratch/chart-parsing/issues/03-lattice-recovery.md)'s job,
this is only good enough to sample interiors).

**[measured]** Per-Cell median over two sampling windows:

| statistic | distinct values over 19,200 Cells |
|---|---|
| median of whole Cell (radius 4.4px, includes gridlines) | **3,375** |
| median of Cell interior (radius 1.5px, ~4×4 patch) | **916** |

Whole-Cell sampling is 3.7× noisier, and it is *biased*, not merely noisy: the whole-Cell median is
darker than the interior median by mean −1.89 luma, median −0.50, and **5th percentile −18.67**. That
long dark tail is the gridline-over-fill and black-outline blending the ticket names — a systematic
darkening concentrated in the Cells the overlay crosses. Sampling the interior removes most of it for
free, before any algorithm has to be robust to it.

### 1c. Clustering on Cell colours beats clustering on raw pixels, decisively

**[measured]** Same k (10), same algorithm family, only the input differs. Error metric: for each of
the 10 flat-pixel colours from §1a, the CIELAB distance to the *nearest* recovered centre — i.e. how
faithfully each true Palette entry survives.

| input | space | per-entry ΔE (worst) | time |
|---|---|---|---|
| 1,533,672 raw pixels (MiniBatchKMeans) | RGB | **14.6** | 5.2s |
| 1,533,672 raw pixels (MiniBatchKMeans) | Lab | **12.5** | 1.6s |
| 19,200 Cell interior medians (KMeans) | RGB | **4.4** | 0.4s |
| 19,200 Cell interior medians (KMeans) | Lab | **3.4** | 0.5s |

Clustering raw pixels misplaces at least one real Palette entry by ΔE 12–15 — far above any
just-noticeable difference, and enough to merge or mislabel a yarn. Clustering Cell colours holds
every entry to ΔE ≤ 3.4. Ten to eighty times faster, too.

**Why raw-pixel clustering fails is structural, not incidental.** k-means minimises inertia, so its
centres migrate toward mass. scikit-learn's own vector-quantization example states the mechanism
plainly: with k-means bin centres, "the counts in the bins are now more balanced and their centers are
no longer equally spaced"
([Vector Quantization Example](https://scikit-learn.org/stable/auto_examples/cluster/plot_face_compress.html)).
Balanced counts are exactly wrong here. In the raw image, the anti-aliasing ramp between white and
grey contains more pixels than several real Palette entries combined, so centres get spent on the
ramp. After per-Cell median sampling that ramp does not exist as data at all — the median of a flat
interior patch is the fill colour, and no intermediate is ever produced.

**Conclusion on ordering: sample first.** Not because clustering is bad, but because sampling deletes
the noise rather than asking the clusterer to be robust to it. All three noise sources named in the
ticket — anti-aliasing, compression ringing, gridline blending — live at or near Cell boundaries.
Interior sampling is a geometric answer to a geometric problem; clustering is a statistical answer to
a geometric problem, and it is the weaker one.

---

## 2. Clustering approaches surveyed

### 2a. k-means (`sklearn.cluster.KMeans`)

```python
KMeans(n_clusters=8, *, init='k-means++', n_init='auto', max_iter=300,
       tol=1e-4, random_state=None, algorithm='lloyd')
```
([KMeans docs](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html))

Average complexity O(k n T). The docs are explicit about the main hazard: *"In practice, the k-means
algorithm is very fast (one of the fastest clustering algorithms available), but it falls in local
minima. That's why it can be useful to restart it several times."* Note `n_init` defaults to **1** when
`init='k-means++'` — set it to 10 explicitly.

**On unequal cluster sizes — confirm and refute, carefully.** The scikit-learn clustering overview
lists k-means' use case as *"General-purpose, even cluster size, flat geometry, not too many clusters"*
([Clustering](https://scikit-learn.org/stable/modules/clustering.html)). But the dedicated example is
more honest and partially refutes the folklore: *"there is no theoretical result about k-means that
states that it requires similar cluster sizes to perform well, yet minimizing euclidean distances does
mean that the more sparse and high-dimensional the problem is, the higher is the need to run the
algorithm with different centroid seeds to ensure a global minimal inertia"*
([Demonstration of k-means assumptions](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_assumptions.html)).
Its prescribed fix for unevenly sized blobs is simply a larger `n_init`.

So the accurate statement for this project is: k-means has no *theoretical* size-balance requirement,
but its objective allocates centres in proportion to squared-error mass, and with a 21%-vs-0.2% split
that means small entries are recovered only if initialisation happens to seed them. The measured ΔE
12.5 failure in §1c is that effect. The same docs also note inertia *"makes the assumption that
clusters are convex and isotropic"* — true of a compressed flat fill's cloud, which is why k-means
works *well* once the input is Cell colours.

**Related failure the docs warn about:** k-means is the maximum-likelihood estimator for a mixture of
Gaussians *"with the same variances but with possibly different means"*. Palette entries in this chart
do not have equal variance — white is near-exact, saturated fills ring more.

### 2b. Mini-batch k-means (`sklearn.cluster.MiniBatchKMeans`)

```python
MiniBatchKMeans(n_clusters=8, *, batch_size=1024, max_no_improvement=10,
                init_size=None, n_init='auto', reassignment_ratio=0.01)
```
([MiniBatchKMeans docs](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.MiniBatchKMeans.html),
implementing [Sculley, *Web-scale k-means clustering*](https://www.eecs.tufts.edu/~dsculley/papers/fastkmeans.pdf))

*"MiniBatchKMeans converges faster than KMeans, but the quality of the results is reduced"*
([Clustering](https://scikit-learn.org/stable/modules/clustering.html)). It has one parameter that
matters directly here: `reassignment_ratio`, which *"control[s] the fraction of the maximum number of
counts for a center to be reassigned. A higher value means that low count centers are more easily
reassigned"*. Low-count centres are precisely the rare Palette entries — the default 0.01 will
cannibalise them. **Verdict: not needed.** 19,200 samples is small; use exact `KMeans`. MiniBatch only
earns its place if you insist on clustering raw pixels, which §1c says not to do.

### 2c. Mean-shift (`sklearn.cluster.MeanShift`)

```python
MeanShift(*, bandwidth=None, bin_seeding=False, min_bin_freq=1, cluster_all=True, max_iter=300)
```
([MeanShift docs](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.MeanShift.html))

Attractive on paper: no k, and the overview table lists its use case as *"Many clusters, uneven cluster
size, non-flat geometry"*. But: *"The algorithm is not highly scalable, as it requires multiple nearest
neighbor searches"*, complexity tends to *O(T·n·log n)* in low dimensions, and *"the estimate_bandwidth
function is much less scalable than the mean shift algorithm and will be the bottleneck if it is
used"*. A single global `bandwidth` is also the wrong shape for this data: the bandwidth that separates
two close yarns is far smaller than the one needed to collapse white's ringing cloud. **Verdict:
rejected** — the single-scale parameter is the same weakness as DBSCAN's `eps`, with worse scaling.

### 2d. DBSCAN (`sklearn.cluster.DBSCAN`)

```python
DBSCAN(eps=0.5, *, min_samples=5, metric='euclidean', algorithm='auto', leaf_size=30)
```
([DBSCAN docs](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html))

Genuinely good at uneven cluster sizes and outlier removal (labels noise `-1`), and the overview table
credits it with *"uneven cluster sizes, outlier removal"*. The blocker is stated outright: `eps` *"is
crucial to choose appropriately for the data set and distance function and usually cannot be left at
the default value… When chosen too small, most data will not be clustered at all… When chosen too
large, it causes close clusters to be merged into one cluster, and eventually the entire data set to be
returned as a single cluster."* And it assumes one global density: *"DBSCAN assumes that the clustering
criterion (i.e. density requirement) is globally homogeneous… DBSCAN may struggle to successfully
capture clusters with different densities"*
([Clustering](https://scikit-learn.org/stable/modules/clustering.html)).

Also *"worst case memory complexity of O(n²)"*, though at 19,200 samples this is irrelevant.
**Verdict: rejected** — the eps-too-small / eps-too-large dilemma is exactly the merge-two-yarns /
split-one-yarn structural failure the ticket wants avoided, moved into a continuous parameter.

### 2e. HDBSCAN (`sklearn.cluster.HDBSCAN`) — tested, and it over-segments

```python
HDBSCAN(min_cluster_size=5, min_samples=None, cluster_selection_epsilon=0.0,
        metric='euclidean', cluster_selection_method='eom', store_centers=None)
```
([HDBSCAN docs](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.HDBSCAN.html),
implementing [Campello, Moulavi & Sander 2013](https://doi.org/10.1007/978-3-642-37456-2_14))

The theoretically correct choice: no k, handles uneven sizes, and *"HDBSCAN alleviates [the global
density] assumption and explores all possible density scales… it no longer needs ε to be given as a
hyperparameter"*. `store_centers="medoid"` gives centres *"guaranteed to be an observed data point"* —
appealing for a Palette, since a medoid is a real screen colour rather than an average of two.

**[measured] It does not work here.** On the 19,200 Cell interior medians in Lab:

| `min_cluster_size` | clusters found | noise |
|---|---|---|
| 20 | **160** | 11.9% |
| 50 | **72** | 17.2% |

Against a true Palette of ~10. HDBSCAN's freedom from k is exactly what hurts: residual compression
clouds and anti-aliased Cells form dozens of small, genuinely dense knots in Lab, and excess-of-mass
selection is happy to call each one a cluster. Raising `min_cluster_size` trades over-segmentation for
throwing real rare entries into noise.

The documented fix is `cluster_selection_epsilon`, *"a distance threshold. Clusters below this value
will be merged"* (per [Malzer & Baum 2019](https://arxiv.org/abs/1911.02282)). **[measured] It crashes
on scikit-learn 1.9.0 / NumPy 2.5.2** with `TypeError: only 0-dimensional arrays can be converted to
Python scalars` inside `_hdbscan/_tree.pyx:epsilon_search` — a known open bug,
[scikit-learn#33219](https://github.com/scikit-learn/scikit-learn/issues/33219). The
`scikit-learn-contrib/hdbscan` package is unaffected but is a second dependency.

**Verdict: rejected for v1.** Over-segments by 7–16×, and its one documented remedy is currently
broken in the library the project would use.

### 2f. Median cut (`PIL.Image.quantize`)

```python
Image.quantize(colors=256, method=Image.Quantize.MEDIANCUT, kmeans=0, palette=None,
               dither=Dither.FLOYDSTEINBERG)
```
([Pillow Image docs](https://pillow.readthedocs.io/en/stable/reference/Image.html))

Median cut splits the colour box along its widest axis, and — critically — *"the split point is the
median point: the plane which divides the box into two halves so that equal numbers of colors are on
each side"*, so each box holds approximately equal pixel counts
([Heckbert, *Color Image Quantization for Frame Buffer Display*](http://www.cs.cmu.edu/~ph/ciq_thesis)).

That is a **deliberate equal-mass design**, and it is the single worst property for this problem. With
white at 18% and a rare yarn at 0.2%, median cut spends ~90 boxes subdividing white's ringing cloud
before it looks at the rare yarn. Heckbert's own analysis of the alternative popularity algorithm names
the mirror-image failure: *"the highly-saturated primaries… are neglected"* while *"the grays and
low-saturation colors are over-represented."* Both classic quantizers fail this image from opposite
directions. **Verdict: rejected** for Palette discovery. (Still useful as a *rendering* step once the
Palette is known — `Image.quantize(palette=...)` maps onto a given Palette.)

`Quantize.FASTOCTREE` (octree) is a hierarchical subdivision of the RGB cube; the same objection
applies — it merges by occupancy, so a large cloud outvotes a small flat fill.
`Quantize.MAXCOVERAGE` and `MEDIANCUT` do not support RGBA (fast octree is substituted).

### 2g. Agglomerative clustering with a distance threshold (`sklearn.cluster.AgglomerativeClustering`) — recommended for the merge step

```python
AgglomerativeClustering(n_clusters=None, *, metric='euclidean', linkage='complete',
                        distance_threshold=3.0, compute_full_tree=True)
```
([AgglomerativeClustering docs](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.AgglomerativeClustering.html))

`distance_threshold` is *"the linkage distance threshold at or above which clusters will not be
merged"*, and *"if not None, n_clusters must be None and compute_full_tree must be True"*. `linkage`
selects what distance between sets is minimised: `'complete'` *"uses the maximum distances between all
observations of the two sets"*, `'single'` *"uses the minimum"*.

Use `'complete'`: it guarantees no merged group spans more than the threshold, so two real yarns
separated by ΔE 15 can never be joined through a chain of intermediates. `'single'` would chain them —
that is the classic single-linkage chaining failure, and with anti-aliasing ramps present it is a real
risk, not a theoretical one.

This is the right tool because the *quantity we actually know* is not k, it is a **perceptual distance
below which two colours are the same yarn**. `distance_threshold` takes exactly that. **[measured]**
threshold 3.0 in Lab turns the 12 flat candidates (≥50px) into **10 Palette entries** and puts every
merge/no-merge decision two orders of magnitude away from the boundary (§1a).

### Summary table

| approach | needs k? | tolerates 21% vs 0.2%? | verdict |
|---|---|---|---|
| `KMeans` | yes | poorly on raw pixels (ΔE 12.5); fine on Cell colours (ΔE 3.4) | fallback / refinement |
| `MiniBatchKMeans` | yes | worse — `reassignment_ratio` evicts low-count centres | no |
| `MeanShift` | no | yes in principle, but one global bandwidth + poor scaling | no |
| `DBSCAN` | no | yes, but `eps` reintroduces the merge/split dilemma | no |
| `HDBSCAN` | no | yes in principle; **measured 72–160 clusters vs true ~10** | no (v1) |
| median cut / octree | yes (colors=) | **no — equal-mass split is the wrong objective** | no (discovery); yes (rendering) |
| `AgglomerativeClustering(distance_threshold, complete)` | **no — takes a ΔE instead** | yes; threshold is on distance, not mass | **recommended** |

---

## 3. Choosing k automatically — and why the recommendation avoids needing to

### Silhouette (`sklearn.metrics.silhouette_score`)

```python
silhouette_score(X, labels, *, metric='euclidean', sample_size=None, random_state=None)
```
([silhouette_score docs](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html))
`s = (b - a) / max(a, b)`, mean over samples, defined only for `2 ≤ n_labels ≤ n_samples - 1`; use
`sample_size` to cut cost on large inputs.

**[measured] It does not resolve k on this data.** KMeans on Cell interior medians in Lab,
`sample_size=5000`:

```
k= 6 0.8609   k= 9 0.9517   k=12 0.9619   k=15 0.9622   k=18 0.9627
k= 7 0.9042   k=10 0.9553   k=13 0.9629   k=16 0.9634   k=19 0.9625
k= 8 0.9284   k=11 0.9593   k=14 0.9612   k=17 0.9624   k=20 0.9631
```

It rises steeply to k≈10 and then **plateaus within ±0.004 from k=11 to k=20**. Its argmax is
**k=16** — which is a genuine over-split: **[measured]** at k=16 the near-black entry splits into
`(28,27,26)` and `(9,7,5)`, closest centre pair ΔE 7.8, smallest cluster 17 Cells (0.09%). That is
precisely the "too many splits one yarn into two" failure the ticket warns about, and silhouette
*prefers* it. scikit-learn's own example already flags this class of ambiguity: *"Silhouette analysis
is more ambivalent in deciding between 2 and 4"*
([Selecting the number of clusters with silhouette analysis](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_silhouette_analysis.html)),
and notes that reading cluster *size* off the plot thickness is part of the judgement — a judgement
call, not an automatic criterion. This pipeline runs unattended, so a criterion that needs a human to
look at a plot is not a criterion.

### Elbow / knee detection (Kneedle)

The Kneedle algorithm normalises both axes to [0,1], draws a line between the endpoints, and takes the
knee at the maximum perpendicular distance from that line; sensitivity `S` sets how much curvature is
required before a knee is declared. Its stated limitations are directly relevant: **noise sensitivity**,
a **smoothing/spline requirement** on noisy curves, and dependence on the endpoints (an offline
algorithm)
([Satopää, Albrecht, Irwin & Raghavan, *Finding a Kneedle in a Haystack*](https://raghavan.usc.edu/papers/kneedle-simplex11.pdf)).
The reference implementation is `kneed.KneeLocator(x, y, S=1.0, curve='convex',
direction='decreasing')` ([kneed docs](https://kneed.readthedocs.io/en/stable/)).

Applied to inertia here, **[measured]** the curve is `k=6: 1.03e6 → k=10: 93,078 → k=13: 34,972 →
k=20: 14,145` — a smooth power-law-ish decay whose knee depends entirely on the k range you feed it
and whether you log-scale. Not trustworthy as the sole criterion.

### Gap statistic

Tibshirani, Walther & Hastie compare `log W_k` against its expectation under a null reference
distribution and pick the smallest k satisfying the 1-standard-error rule. The method is sound but adds
B Monte-Carlo reference clusterings per candidate k, needs a reference distribution chosen for the data
(uniform over the bounding box, or PCA-aligned), and is designed for the general "is there any cluster
structure" question — which is not this project's question. (The Stanford PDF at
`https://hastie.su.domains/Papers/gap.pdf` is scanned and did not yield extractable text; the
canonical reference is Tibshirani, Walther & Hastie, *JRSS-B* 63(2):411–423, 2001,
[doi:10.1111/1467-9868.00293](https://doi.org/10.1111/1467-9868.00293). Treated here as
"known-but-not-verified" and not relied upon.)

### What to use instead: assignment residual

**[measured]** Residual (distance from each Cell colour to its assigned centre) is far more decisive
than silhouette, because it is measured in the same ΔE units as the acceptance question:

| k | 95th pct residual | 99th pct | max | min centre pair | smallest cluster |
|---|---|---|---|---|---|
| 6 | 14.66 | 37.85 | 41.4 | 21.88 | 10.77% |
| 8 | 5.52 | 15.33 | 36.0 | 17.27 | 2.56% |
| **10** | **1.45** | 13.18 | 36.0 | **15.36** | 0.71% |
| 12 | 1.33 | 5.82 | 23.4 | 15.36 | 0.21% |
| 13 | 1.32 | 5.63 | 19.5 | 15.36 | 0.14% |
| 16 | 1.07 | 4.63 | 19.5 | **7.80** ← split | 0.09% |
| 20 | 1.06 | 3.69 | 19.7 | 8.10 | 0.03% |

Read it as: **p95 residual collapses at k=10** (5.52 → 1.45) and barely improves after. The
**minimum centre-pair distance stays pinned at ΔE 15.36 up to k=13 and then drops to 7.8** — the
signature of a genuine Palette entry being split. Two robust stopping rules fall out, both in ΔE units
a human can reason about:

- **stop adding clusters when the minimum centre-pair distance falls below ~10 ΔE** (you have begun
  splitting a yarn);
- **stop when the p95 residual is below ~2 ΔE** (every Cell is explained).

Note k=10 through k=13 all have p95 residual ≈ 1.3–1.45 and min centre-pair 15.36. The extra centres at
k=12/13 — `(72,71,73)`, `(167,108,13)`, `(94,58,6)` — are not new yarns; see §5.

**But the recommended pipeline needs none of this.** Deriving the Palette from flat pixels (§1a) hands
you the entry count directly. The k sweep above is the *fallback* path, for a chart where the flat-pixel
harvest comes up short.

---

## 4. Colour spaces

### Does Lab help?

Yes, consistently but modestly, and it costs almost nothing at Cell scale. **[measured]** worst-entry
recovery error, from §1c: raw pixels RGB 14.6 → Lab 12.5; Cell colours RGB 4.4 → Lab 3.4. Lab is the
better default, and it becomes essential for the *thresholds*, not the clustering: `distance_threshold`
and the residual stopping rules above are only meaningful numbers because Lab distance approximates
perceptual difference. In RGB, "ΔE 3" has no fixed meaning — 3 units near black and 3 units near white
are wildly different perceptually.

### Cost

**[measured]** `skimage.color.rgb2lab`: **1.03 s** for all 1,533,672 pixels, **0.0065 s** for 19,200
Cell colours — a 160× saving that follows directly from doing the conversion after sampling. Even the
full-image cost is tolerable, but there is no reason to pay it.

```python
from skimage.color import rgb2lab, lab2rgb, deltaE_ciede2000
lab = rgb2lab(rgb_float_0_1)     # rgb2lab(rgb, illuminant='D65', observer='2', channel_axis=-1)
```
([skimage.color API](https://scikit-image.org/docs/stable/api/skimage.color.html))

Two pitfalls:

- **scikit-image expects sRGB in [0,1] float** and applies sRGB gamma companding internally; the docs
  warn *"RGB is a device-dependent color space so, if you use this function, be sure that the image you
  are analyzing has been mapped to the sRGB color space."* Screenshots are sRGB in practice. Divide by
  255 before calling.
- **OpenCV's 8-bit Lab is rescaled and will silently corrupt your thresholds.** For `CV_8U`,
  *"L ← L*255/100, a ← a + 128, b ← b + 128"*; for `CV_32F`, *"L, a, and b are left as is"* and input
  must be 0..1
  ([OpenCV color conversions](https://docs.opencv.org/4.x/de/d25/imgproc_color_conversions.html)).
  A ΔE threshold of 3.0 computed against 8-bit OpenCV Lab is not 3.0 — L is stretched by 2.55×. If you
  use OpenCV, convert `img.astype(np.float32)/255` with `cv2.COLOR_RGB2Lab`.

### CIEDE2000 vs Euclidean-in-Lab

CIEDE2000 exists because CIELAB's Euclidean metric is *not* perceptually uniform: it adds weighting
functions `S_L`, `S_C`, `S_H`, a rotation term `R_T` correcting the blue region near 275°, and a scaling
of `a*` in the neutral/low-chroma region where human sensitivity is reduced
([Sharma, Wu & Dalal, *The CIEDE2000 Color-Difference Formula: Implementation Notes…*](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf)).
The neutral-region correction is the one that matters here — this chart's Palette contains white,
off-white `(218,213,208)`, mid-grey `(110,109,113)`, and near-black `(27,27,27)`, all low-chroma.

**Where it matters and where it doesn't:**

- **Use `deltaE_ciede2000` for the near-duplicate merge decision.** **[measured]** it separates the
  cases cleanly: duplicates at ΔE2000 0.2 and 0.4, every genuine pair at ≥ 4.2 (and mostly ≥ 14.8).
- **Do not use it as a clustering metric.** `KMeans` requires Euclidean geometry (its centroid update
  is only correct for the squared-Euclidean objective), and CIEDE2000 is not a metric in the
  mathematical sense. Passing it to `AgglomerativeClustering` is possible via a precomputed matrix but
  is unnecessary — at 19,200 samples with 12 candidates, the decision margin is 20× wide either way.
- Avoid `deltaE_ciede94` and `deltaE_cmc` for merging: the docs note they are **not symmetric** —
  *"the first color should be regarded as the 'reference' color"* — which makes them ill-defined for a
  symmetric "are these the same yarn" test.

**Practical position:** cluster and threshold with Euclidean-in-Lab (ΔE76), and use CIEDE2000 only for
the final merge decision and for reporting. The measured margins say nothing in this pipeline is close
enough to the boundary for the difference to change an answer — but ΔE76 in Lab is already 90% of the
benefit over RGB, at zero extra cost.

---

## 5. Sampling strategy as noise avoidance

### Robust statistic: which one, and how much it actually matters

**[measured]** three statistics over the same interior patch (radius 1.5), scored as ΔE to the nearest
Palette entry across all 19,200 Cells:

| statistic | median ΔE | p95 | p99 | max | Cells > ΔE 2 |
|---|---|---|---|---|---|
| mean | 0.30 | 1.31 | 16.85 | 36.29 | 3.80% |
| **median** | 0.35 | 1.32 | **13.46** | 36.36 | **3.05%** |
| `trim_mean(0.25)` | 0.29 | 1.25 | 14.54 | 35.91 | 3.34% |

**Be honest about this result: the choice of statistic is a second-order effect.** In the body of the
distribution the three are indistinguishable (median ΔE 0.29–0.35, p95 1.25–1.32). The median wins only
in the **tail** — p99 13.46 vs the mean's 16.85, and 20% fewer Cells beyond ΔE 2 — which is exactly
where overlay-crossed Cells live. The mechanism is the expected one: an outline clipping the corner of
the patch shifts the mean in proportion to its area but does not move the median until it covers half
the patch.

So the median is the right default, but the win is ~0.75 percentage points of Cells, not a
transformation. **The first-order effect is *where* you sample, not *how* you summarise it** — compare
this table's spread (p99 13.5 → 16.9) with §1b's interior-vs-whole-Cell result (916 vs 3,375 distinct
values, −18.67 p5 luma bias). Do not spend engineering effort here.

Concretely: `np.median(patch.reshape(-1, 3), axis=0)`
([numpy.median](https://numpy.org/doc/stable/reference/generated/numpy.median.html)). Per-channel
median can in principle emit a colour no pixel had; with a flat interior it does not.

Alternatives:

- **Trimmed mean** — `scipy.stats.trim_mean(a, proportiontocut, axis=0)` *"Removes the specified
  proportion of elements from each end of the sorted array, then computes the mean of the remaining
  elements"*
  ([scipy.stats.trim_mean](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.trim_mean.html)).
  Measured above at 0.25: marginally the best p95, second-best tail. A defensible alternative, not a
  reason to change.
- **Mode of a trimmed histogram** — theoretically the most correct (it returns an actual observed
  colour), but on a ~16-pixel patch with compression noise the mode frequently degenerates to a
  1-vs-1 tie. It only becomes viable with a larger patch, which reintroduces edge pixels — trading a
  second-order gain for a first-order loss.

**Verdict: per-channel median of the interior patch.** One numpy call, best tail behaviour, no
parameters beyond the patch radius.

### Patch size

At pitch 8.85px, radius 1.5 (a ~4×4 centre patch) works. **[measured]** it leaves p95 residual at 1.32
ΔE while whole-Cell sampling (radius 4.4) triples the distinct-colour count and introduces the −18.67
p5 luma bias. The rule: **sample the middle ~40–50% of the Cell in each axis**, which keeps gridlines
(1px at each edge) and their anti-aliasing skirts entirely out of the patch. Below ~3×3 the median gets
noisy; above ~60% the gridline skirt enters.

### The one thing interior sampling does *not* solve

**[measured]** Only **44.7%** of 9×9 tiles contain even one strictly-flat pixel, and the median tile
contains **zero**. So the strict-flatness test cannot be used *per Cell* — it is a **global harvesting**
tool, not a per-Cell statistic. This is the reason the pipeline has two distinct sampling operations:

- **strict flatness, low coverage, global** → discovers the Palette (needs a few thousand clean samples
  in total; 273,968 is a luxury);
- **interior median, 100% coverage, per Cell** → assigns every Cell (needs a value for all 19,200,
  clean or not).

Conflating them is the trap. Neither one alone does both jobs.

---

## 6. Recommended pipeline, concretely

```python
import numpy as np
from PIL import Image
from scipy.ndimage import maximum_filter, minimum_filter
from skimage.color import rgb2lab
from sklearn.cluster import AgglomerativeClustering

img = np.asarray(Image.open(path).convert("RGB"))          # H x W x 3 uint8

# --- Stage 1: harvest Palette candidates from strictly-flat pixels (no grid needed) ---
rng = np.max([maximum_filter(img[..., c], 3).astype(np.int16)
              - minimum_filter(img[..., c], 3).astype(np.int16) for c in range(3)], axis=0)
for tol in (0, 2, 4, 6):                    # widen until enough samples survive
    flat = img[rng <= tol]
    if len(flat) > 0.02 * img[..., 0].size:
        break
cand, counts = np.unique(flat.reshape(-1, 3), axis=0, return_counts=True)
cand, counts = cand[counts >= 50], counts[counts >= 50]     # drop dust

# --- Stage 2: merge near-duplicates in Lab; k is never chosen ---
cand_lab = rgb2lab(cand.astype(float).reshape(-1, 1, 3) / 255).reshape(-1, 3)
lbl = AgglomerativeClustering(n_clusters=None, distance_threshold=3.0,
                              linkage="complete", metric="euclidean").fit(cand_lab).labels_
palette = np.array([np.average(cand[lbl == g], axis=0, weights=counts[lbl == g])
                    for g in range(lbl.max() + 1)])
palette_lab = rgb2lab(palette.reshape(-1, 1, 3) / 255).reshape(-1, 3)

# --- Stage 3: per-Cell interior median (grid from ticket 03) ---
r = 0.20 * pitch                                            # ~40% of the Cell, each axis
cells = np.array([[np.median(img[int(y-r):int(y+r)+1, int(x-r):int(x+r)+1].reshape(-1, 3), axis=0)
                   for x in cx] for y in cy])
cells_lab = rgb2lab(cells.reshape(-1, 1, 3) / 255).reshape(-1, 3)

# --- Stage 4: assign + residual ---
d = np.linalg.norm(cells_lab[:, None, :] - palette_lab[None, :, :], axis=2)
assignment, residual = d.argmin(axis=1), d.min(axis=1)
```

Fallback when stage 1 yields fewer candidates than the chart plainly needs (a heavily recompressed
input): sweep `KMeans(n_clusters=k, n_init=10, random_state=0)` on `cells_lab` over k = 4..24 and stop
by the two ΔE rules from §3 — min centre-pair distance ≥ 10, p95 residual ≤ 2. This is a fallback
because it can be fooled (§3 shows silhouette choosing k=16 on this chart); the flat-pixel path cannot.

---

## 7. Failure modes, stated honestly

1. **A Palette entry with no flat interior anywhere.** A yarn used only in single scattered Cells that
   the overlay always crosses would never produce a strictly-flat 3×3, and stage 1 would miss it.
   Detection is the residual: such Cells appear as a residual cluster. **Mitigation:** after stage 4,
   cluster the Cells with residual > ~10 ΔE and test whether each group is a *darkened variant* of an
   existing entry (roughly uniform per-channel scaling) or a new hue. **[measured]** on the example,
   1.24% of Cells (238) exceed ΔE 10, and all six of their sub-clusters are darkened scalings of an
   existing entry rather than new hues (scale = sub-cluster RGB sum ÷ nearest hue-direction entry's):

   | residual cluster | Cells | nearest entry by hue direction | scale |
   |---|---|---|---|
   | `(72,71,74)` | 119 | grey `(110,109,113)` | 0.65 |
   | `(176,115,15)` | 35 | orange `(250,154,9)` | 0.74 |
   | `(56,66,45)` | 27 | green `(135,156,107)` | 0.42 |
   | `(95,59,6)` | 26 | orange `(250,154,9)` | 0.39 |
   | `(50,32,14)` | 25 | yellow `(247,198,59)` | 0.19 |
   | `(164,164,164)` | 6 | white `(255,255,255)` | 0.64 |

   (Hue-direction matching is crude for the very dark groups — `(50,32,14)` at 0.19 could equally be a
   heavily-darkened brown — but the conclusion holds regardless of which entry each maps to: every
   group is an existing entry multiplied down, none is a new hue.)
   No new hue hides in the residual — those are outline-crossed Cells, not missing yarns. This test is
   also the correct answer to the ticket's gridline-bias worry: it is what stops a systematically
   darkened colour being promoted to a Palette entry.

2. **The measured Palette is 10, not the 12–16 the map estimated.** Ten entries, three of which are
   structural rather than yarn: white (background), near-black `(27,27,27)` (outlines), and off-white
   `(218,213,208)`. That leaves ~7 yarn colours plus a mid-grey. The 12–16 figure in
   [map.md](../../.scratch/chart-parsing/map.md) was an estimate, not a measurement; this is a
   measurement, but it is a measurement of one chart. Do not hard-code an expected Palette size
   anywhere.

3. **Strict flatness may harvest nothing on a harder-compressed chart.** This screenshot is a PNG whose
   flat cores survived (17.9% of pixels strictly flat). A chart saved as a low-quality JPEG may have no
   strictly-flat 3×3 at all. The tolerance ladder in the stage-1 code handles this, but at tol ≥ 4
   **[measured]** the candidate count jumps to 1,132 — the merge step in stage 2 stops being a
   formality and starts doing real work, and `distance_threshold` becomes load-bearing. Test this
   explicitly with a recompressed input in the
   [test corpus](../../.scratch/chart-parsing/issues/01-test-corpus.md).

4. **Grid phase error propagates into sampling.** The interior patch is only clean if it is centred.
   At pitch 8.85 and radius 1.5, roughly 2px of phase error before the gridline skirt enters the patch
   — tight. This makes Palette quality dependent on
   [lattice recovery](../../.scratch/chart-parsing/issues/03-lattice-recovery.md) accuracy, and it is
   worth having the extraction spike report phase error as a first-class diagnostic.

5. **k-means still falls into local minima** even on Cell colours — the docs say so explicitly. If the
   fallback path is used, `n_init` must be set (default is 1 with k-means++, not 10).

6. **Anti-aliased Cells that are genuinely half one colour and half another.** The median of a 4×4
   patch straddling a diagonal outline returns whichever colour covers more than half. That is the
   right answer for a Cell, but it means the diagonal-outline layer
   ([ticket 06](../../.scratch/chart-parsing/issues/06-overlay-layer.md)) is silently absorbed rather
   than detected. High residual is the only signal that it happened.

---

## Reproducing the measurements

Probes are in the session scratchpad (`palette_probe.py` … `palette_probe5.py`), run against
`tests/examples/112w150h.png` with **numpy 2.5.2, scikit-learn 1.9.0, scikit-image 0.26.0,
Pillow, SciPy** in a throwaway venv. They are not committed — they are one-shot measurements, and
everything they produced is tabulated above. Rebuild with: flat-mask via
`scipy.ndimage.maximum_filter`/`minimum_filter`, grid pitch via refined DFT peak of
`np.abs(np.diff(gray, axis=1)).sum(axis=0)`, and the sklearn/skimage calls quoted in §6.

## Sources

Primary documentation and papers, all consulted directly:

- scikit-learn, [Clustering](https://scikit-learn.org/stable/modules/clustering.html) (overview table, k-means/inertia assumptions, MiniBatchKMeans, MeanShift, DBSCAN, HDBSCAN density-homogeneity)
- scikit-learn, [KMeans](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html), [MiniBatchKMeans](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.MiniBatchKMeans.html), [MeanShift](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.MeanShift.html), [DBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html), [HDBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.HDBSCAN.html), [AgglomerativeClustering](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.AgglomerativeClustering.html), [silhouette_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html)
- scikit-learn examples: [Demonstration of k-means assumptions](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_assumptions.html), [Selecting the number of clusters with silhouette analysis](https://scikit-learn.org/stable/auto_examples/cluster/plot_kmeans_silhouette_analysis.html), [Vector Quantization Example](https://scikit-learn.org/stable/auto_examples/cluster/plot_face_compress.html)
- scikit-learn issue [#33219 — HDBSCAN fails when using cluster_selection_epsilon](https://github.com/scikit-learn/scikit-learn/issues/33219)
- scikit-image, [skimage.color API](https://scikit-image.org/docs/stable/api/skimage.color.html) (`rgb2lab`, `deltaE_ciede2000`, `deltaE_ciede94`, `deltaE_cmc`)
- OpenCV, [Color conversions](https://docs.opencv.org/4.x/de/d25/imgproc_color_conversions.html) (8-bit Lab rescaling), [cv::kmeans](https://docs.opencv.org/4.x/d5/d38/group__core__cluster.html)
- Pillow, [Image.quantize](https://pillow.readthedocs.io/en/stable/reference/Image.html)
- SciPy, [scipy.stats.trim_mean](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.trim_mean.html); NumPy, [numpy.median](https://numpy.org/doc/stable/reference/generated/numpy.median.html)
- Heckbert, P., [*Color Image Quantization for Frame Buffer Display*](http://www.cs.cmu.edu/~ph/ciq_thesis) (median cut; popularity algorithm's neglect of saturated primaries)
- Sharma, Wu & Dalal, [*The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations*](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf)
- Satopää, Albrecht, Irwin & Raghavan, [*Finding a "Kneedle" in a Haystack: Detecting Knee Points in System Behavior*](https://raghavan.usc.edu/papers/kneedle-simplex11.pdf); [kneed](https://kneed.readthedocs.io/en/stable/)
- Sculley, D., [*Web-Scale K-Means Clustering*](https://www.eecs.tufts.edu/~dsculley/papers/fastkmeans.pdf)
- Campello, Moulavi & Sander, [*Density-Based Clustering Based on Hierarchical Density Estimates*](https://doi.org/10.1007/978-3-642-37456-2_14); Malzer & Baum, [*A Hybrid Approach To Hierarchical Density-based Cluster Selection*](https://arxiv.org/abs/1911.02282)
- Tibshirani, Walther & Hastie, *Estimating the number of clusters in a data set via the gap statistic*, JRSS-B 63(2):411–423, 2001, [doi:10.1111/1467-9868.00293](https://doi.org/10.1111/1467-9868.00293) — **not verified against the full text** (the linked Stanford PDF is a scan); treated as background only and not relied upon.
