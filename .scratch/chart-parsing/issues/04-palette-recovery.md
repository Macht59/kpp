# Palette recovery from anti-aliased, lossy charts

Type: research
Status: resolved

## Question

The Chart's Palette must come back as a small set of design colours — plausibly 12–16 for the example — from an image holding **121,369 distinct RGB values**. Quantizing to a 24-step lattice gives 187 buckets with 43 above 0.2%, so the noise is not a thin halo around a clean palette; it is substantial, and naive quantization overcounts by roughly 3×.

Three distinct sources of noise are tangled together, and they may need different treatment:

- **Anti-aliasing** at colour boundaries, producing intermediate colours that belong to neither neighbour.
- **Lossy compression** ringing, which spreads a flat fill into a cloud (the example's greys span at least `107,106,110` through `112,111,115`).
- **Gridline-over-fill blending**, which darkens a consistent fraction of every Cell and produces systematically-biased colours that a clustering algorithm may read as real Palette entries.

Survey, against primary sources:

- **Clustering approaches** — k-means (and how k is chosen when the Palette size is unknown), mean-shift, DBSCAN, and octree/median-cut quantization. Which tolerate wildly unequal cluster sizes, given the example's largest colour is 21% of pixels and real Palette entries sit below 1%?
- **Choosing k automatically** — silhouette scores, elbow detection, or gap statistic. Getting k wrong is structural: too few merges two yarns, too many splits one.
- **Colour spaces** — whether clustering in CIELAB rather than RGB meaningfully improves separation of perceptually-close yarns, and what the conversion costs.
- **Sampling strategy as noise avoidance** — whether sampling a Cell's *interior region* and taking a robust statistic (median, or the mode of a trimmed histogram) sidesteps most of this before clustering ever runs, given the gridlines and outlines sit at Cell edges.

Return technique names, the library calls implementing them, failure modes, and a recommendation on ordering: does robust per-Cell sampling come first and clustering second, or the reverse? Cite primary sources.

Resolved by a `/research` subagent; capture findings on a `research/palette-recovery` branch with a context pointer here.

## Answer

Full findings, with citations: [`docs/research/palette-recovery.md`](../../../docs/research/palette-recovery.md) (672 lines, 54 primary sources).

**Sample first, cluster second — and the clustering step nearly disappears.**

The ordering question the ticket asked is settled decisively. Clustering 1.53M raw pixels misplaces at least one real Palette entry by ΔE 12.5; clustering ~19,200 Cell interior medians holds every entry to ΔE 3.4 and runs 10× faster. The cause is structural rather than incidental: k-means allocates centres in proportion to squared-error mass, and the white↔grey anti-aliasing ramp carries more pixels than several real Palette entries combined. Interior sampling deletes that ramp instead of asking the clusterer to survive it, and removes the gridline bias at the same time — whole-Cell medians measured 3.7× noisier and biased dark (5th-percentile luma −18.7).

The headline finding is that most of the problem dissolves before clustering starts. Pixels whose 3×3 neighbourhood is strictly constant make up ~18% of the image and carry **13 distinct RGB values** — down from 121,369, with no clustering at all. Merging near-duplicates in CIELAB via `AgglomerativeClustering(distance_threshold=3.0, linkage="complete")` yields **10 Palette entries**, with every merge decision two orders of magnitude clear of the boundary (duplicates at ΔE2000 0.2–0.4, genuine pairs at ≥4.2). k is never chosen; the threshold is a perceptual distance, which is a quantity we actually know.

**Independently verified.** Re-measured with a separate stdlib PNG decoder: 268,968 strictly-flat centre pixels (17.5% — the 0.4pp gap from the report is border handling), and exactly **13 distinct values**. The merge to 10 is directly visible: `(110,109,113)`/`(109,108,112)` are one grey, `(255,255,255)`/`(254,254,254)` one white, and `(100,100,100)` is a single stray pixel.

**Negative results worth carrying forward:**

- **HDBSCAN over-segments badly** here — 72–160 clusters against a true ~10 — and its documented remedy `cluster_selection_epsilon` crashes on sklearn 1.9.0 ([scikit-learn#33219](https://github.com/scikit-learn/scikit-learn/issues/33219)).
- **Silhouette does not resolve k.** It plateaus within ±0.004 from k=11 to 20, and its argmax (k=16) is a genuine over-split of the near-black entry.
- **Median cut is actively wrong for discovery.** Heckbert's algorithm splits boxes at the median so each holds equal pixel counts — exactly backwards when one entry is 18% and another 0.2%. Use assignment residual in ΔE as the stopping rule.
- The folklore that k-means requires balanced cluster sizes was **refuted, not confirmed**: scikit-learn states no theoretical size-balance requirement. The real failure is the objective following mass, which is a different and more precise claim.

**Two corrections this forces on the map:**

1. The Palette is **10, not the 12–16 estimated during charting** — and three of the ten are structural (white background, black outlines, off-white) rather than yarn. The map's Notes have been corrected.
2. The strict-flatness test is a **global harvesting tool, not a per-Cell one**: only 44.7% of Cells contain a strictly-flat pixel. The pipeline therefore needs two distinct sampling operations — flat-pixel harvesting to discover the Palette, and interior-median sampling to assign every Cell — which is a shape [Automatic extraction spike](05-extraction-spike.md) must build to.

---

## Amendment — the corpus falsifies both halves of the recommendation

Re-run against the charts from [Assemble a test corpus of chart screenshots](01-test-corpus.md), which arrived after this ticket closed. The **sample-first-cluster-second ordering survives**; the two specific mechanisms recommended for doing it do not. Both findings were measured on `8w37h.png` and `74w38h.png`, not argued.

### Flat-pixel harvesting fails on a noisy chart

It is not degraded, it is defeated. `8w37h.png` holds 234,881 distinct RGB values in 613,452 pixels — 38% of its pixels are unique — and only **0.1%** have a strictly-constant 3×3 neighbourhood, against 18% on the crisp original. The 746 pixels that survive the test yield 24 values that are **all near-white**: they come from the margin, because the margin is the only flat thing in the image. Every yarn colour in the chart — the olive, the cream, the grey-beige — is absent from the harvest. A Palette built this way would contain no yarn at all.

`74w38h.png` passes, but thinly: 2.4% flat pixels, 6 values, merging correctly to the true 2. The technique degrades with image quality and falls off a cliff rather than a slope.

**Strict flatness is a property of crisp screenshots, not of charts.** It cannot be the primary discovery mechanism. Cell-interior medians must be, with flat-pixel harvesting demoted to an optimisation for images clean enough to support it — and gated on measuring the flat fraction first, which is one cheap pass.

### The ΔE 3.0 merge threshold is an artefact of one chart

The headline claim was that *k is never chosen; the threshold is a perceptual distance, which is a quantity we actually know*. The corpus says we do not know it. Complete-linkage agglomerative merge over `8w37h`'s 254 unique Cell medians, swept by threshold:

| ΔE | 3 | 6 | 10 | 15 | **20** | **25** | 30 |
|---|---|---|---|---|---|---|---|
| clusters | 40 | 15 | 6 | 5 | **3** | **3** | 2 |

The correct answer is 3. The recommended 3.0 returns **40** — over-segmenting by more than 13×. The threshold that works here is 20–25, nearly an order of magnitude above the one that worked on the original chart. Within-colour spread scales with image noise, so no fixed perceptual distance is portable across provenance.

**What is portable is the plateau.** The 3-cluster answer is stable across ΔE 20→25 while every wrong answer occupies a single step of the sweep. Cluster stability across a range of thresholds is the criterion that survived the corpus — sweep the threshold and take the widest plateau, rather than fixing a distance. That still avoids choosing k directly, which was the real virtue of the original recommendation.

### A tail of blend colours needs a rule that is not frequency

Interior-median sampling on `74w38h` recovers its 2 true colours at 55.5% and 43.1%, plus **5 spurious entries totalling 1.2%** (39 Cells) — greys at 205, 179, 156, 228, 78 against a true 102-on-252. These are Cells straddling the heavy every-5 gridline.

A frequency floor would remove them and **must not be used**: this ticket already established that genuine Palette entries sit below 1% on the original chart. The discriminator is that every spurious entry is **collinear in Lab between two real entries** — they are blends, not colours. Position in Lab, not population, is what separates them.

### Net effect on the spike

The ordering conclusion stands and is now better evidenced: interior sampling handled all three PNGs, on lattices that were themselves correct. What [Automatic extraction spike](05-extraction-spike.md) must build differently is the merge — a threshold sweep with plateau selection and a collinearity test for blends, rather than a fixed ΔE and a flat-pixel harvest.
