# Lattice recovery from a chart screenshot

Resolves `.scratch/chart-parsing/issues/03-lattice-recovery.md`.

**Question:** how to automatically recover the Chart's lattice — origin, pitch, and Cell
dimensions — from a screenshot of a colorwork chart.

Every claim below is either cited to a primary source (library documentation, library
source, or the paper the library itself cites) or is a measurement made on this project's
own example chart. Measurements are marked **[measured]** and are reproducible with the
script sketches at the end.

Measurement environment: `opencv-python-headless 5.0.0`, `scikit-image 0.26.0`,
`numpy 2.5.2`, `scipy 1.18.0`, on `tests/examples/112w150h.png` (1074×1428).

---

## 0. TL;DR

1. **Recommended primary technique: gradient projection profile → continuous-frequency DFT
   peak for the pitch, DFT *phase* at that peak for the origin.** Measured error on the
   example chart: pitch off by 0.001 px, origin off by 0.15 px, worst-case lattice error at
   Cell 112 = **0.26 px = 0.029 Cells**. Runs in ~60 ms. It does not degrade in the
   saturated regions.
2. **Fallback / cross-check: `cv2.HoughLinesP` on a `cv2.Canny` edge map**, which also
   survives the saturated regions (because it keys on gradient, not colour) and gives an
   independent line list to validate the extrapolated lattice against.
3. **Do not use checkerboard detection.** It is structurally inapplicable here, not merely
   badly tuned. Measured: only **1.9%** of interior corners in this chart have the
   alternating 2×2 luminance pattern a checkerboard detector looks for.
4. **Deskew is required before the projection profile, and the tolerance is brutal**:
   0.1° is fine, **0.25° already destroys the estimate**. A cheap angle sweep maximising the
   DFT peak strength recovers the angle exactly and costs ~1.5 s.

---

## 1. Correction to an established fact — the pitch is 8.853, not 9.0

The map (`.scratch/chart-parsing/map.md`) records "grid pitch is regular at ~9px (median
9.0; spacing histogram 9×32, 8×10)". **The median is a rounding artefact and using it is
exactly the failure the ticket is worried about.**

**[measured]** Peak-picking the column gradient profile with
`scipy.signal.find_peaks(col_profile, distance=6, prominence=0.05*ptp)` returns **113 peaks
spanning x=34 to x=1026, with every consecutive difference in [6, 12]** — i.e. 113
consecutive gridlines with no missed lines, bounding exactly 112 Cells. That gives an
unambiguous ground truth by long baseline:

```
pitch_x = (1026 - 34) / 112 = 8.85714      (least-squares over all 113: 8.85230)
pitch_y = 8.85428                          (150 Cells, y = 52 .. 1381)
```

The per-interval differences are integers because gridlines are rasterised to integer pixel
rows, so their *median* is 9 and their *mean* is 8.857. The median is wrong by 0.148 px per
Cell:

```
(9.0 - 8.8523) x 112 = 16.54 px = 1.87 Cells of drift across the chart
```

**[measured]** This bit me during this very investigation: my first least-squares fit
assigned lattice indices via `round((peak - peak[0]) / 9.0)`, and the 1.87-Cell drift
mis-assigned indices near the right edge, producing a "ground truth" of 9.006 with a 2.6 px
RMS residual. The correct assignment gives 8.8523 with **0.83 px RMS**. Any index
assignment step must be seeded with a pitch that is already good to much better than
`P / (2 x n_cells)` ≈ 0.04 px, or bootstrapped iteratively.

**Consequence for the spike:** never derive the pitch from a median or mode of adjacent
gridline spacings. Use a long-baseline or frequency-domain estimator.

**[measured]** The chart also carries a **bold gridline every 5 Cells** (visible as spectral
energy at bin 24 ≈ period 44.7 px ≈ 5 × 8.853, plus its harmonics at periods 22.35, 14.70,
11.06). This is a real trap for a naive "argmax of the spectrum over a wide period band" —
see §3.3.

---

## 2. Projection profiles

### What it is

Reduce the 2-D problem to two 1-D problems: sum an edge/gradient response along each axis.
A vertical gridline contributes to every row it crosses, so summing down columns
concentrates it into one strong sample; artwork edges, which are not axis-aligned and not
periodic, average down.

### Concrete implementation

The cheapest form needs no OpenCV at all:

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
col_profile = np.abs(np.diff(gray, axis=1)).sum(axis=0)   # length W-1, peaks at vertical gridlines
row_profile = np.abs(np.diff(gray, axis=0)).sum(axis=1)   # length H-1, peaks at horizontal gridlines
```

`numpy.diff` computes the discrete difference along the given axis
([numpy.diff docs](https://numpy.org/doc/stable/reference/generated/numpy.diff.html)).
Alternatives with the same shape of output: `cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)` then
`np.abs(...).sum(axis=0)`
([OpenCV Sobel](https://docs.opencv.org/4.x/d4/d86/group__imgproc__filter.html)), or
`skimage.filters.sobel_v` / `sobel_h`
([skimage.filters](https://scikit-image.org/docs/stable/api/skimage.filters.html)).

### Does it survive the saturated regions? — Yes. **[measured]**

This is the central empirical question in the ticket, and the answer is unambiguous. Split
the image into 14 horizontal bands and estimate the column pitch independently in each:

| band (y) | pitch | phase | peak strength |
|---|---|---|---|
| 0–102 | 8.8537 | 7.84 | 0.535 |
| 102–204 | 8.8536 | 7.85 | 0.564 |
| 204–306 | 8.8539 | 7.82 | 0.547 |
| 306–408 | 8.8539 | 7.82 | 0.531 |
| 408–510 | 8.8534 | 7.84 | 0.535 |
| 510–612 | 8.8532 | 7.88 | 0.564 |
| 612–714 | 8.8534 | 7.87 | 0.507 |
| **714–816** | **8.8533** | **7.86** | **0.527** |
| **816–918** | **8.8527** | **7.90** | **0.564** |
| **918–1020** | **8.8527** | **7.90** | **0.534** |
| **1020–1122** | **8.8528** | **7.90** | **0.558** |
| **1122–1224** | **8.8534** | **7.84** | **0.534** |
| **1224–1326** | **8.8532** | **7.86** | **0.553** |
| **1326–1428** | **8.8529** | **7.89** | **0.553** |

The bolded rows are past y=717, the point at which the naive colour-scan collapsed
completely. **Pitch spread across all 14 bands is 0.0012 px (0.014%); peak strength never
drops below 0.507.** There is no degradation whatsoever in the flames and wall.

**Why the naive approach failed and this one does not.** The naive pass tested pixel
*colour* against a grey reference. A gridline drawn over an orange fill is not grey, so the
test fails. A gradient operator tests for a *local step*, and a grey-toned line over orange
is still a step in luminance — `np.abs(np.diff(...))` fires on it regardless of the
underlying colour. The failure was never about the saturated region being hard; it was about
using an absolute colour predicate where a differential one was needed.

**Caveat on the response, not the position:** the *magnitude* of the gradient does vary with
the background (a grey line on a mid-grey fill is a weak step). This is why the profile is
summed over the full extent — the sum of ~1400 partly-weak contributions is still a clean
peak — and why an amplitude-threshold-based line detector is fragile while a periodicity
estimator is not.

### Failure modes

- **Skew.** The dominant one. See §6. Summing over a 1428-px height smears a gridline over
  `H·tan θ` pixels; when that approaches `P/2` the comb disappears.
- **Strong axis-aligned artwork.** A long horizontal black outline adds a spurious profile
  peak. It perturbs individual peak positions but contributes negligible energy at the
  lattice frequency, so it damages peak-picking far more than it damages the DFT.
- **Non-uniform lattices.** Charts with a wider "every 10th" column, or a legend/row-numbers
  strip inside the crop, break the single-period assumption. Detect via the strength metric
  and the windowed-phase check (§6.3).

---

## 3. Frequency-domain methods — the recommendation

### 3.1 Why the DFT and not autocorrelation

Both recover a period. The DFT wins for three concrete reasons, all measurable here.

**(a) Sub-pixel period without bias.** **[measured]**, against ground truth `P = 8.85230`:

| estimator | pitch | error | drift across 112 Cells |
|---|---|---|---|
| **DFT, continuous-frequency peak** | **8.85329** | **+0.00098** | **0.012 Cells** |
| autocorrelation, first peak (m=1), parabolic | 8.98893 | +0.13662 | **1.73 Cells** ✗ |
| autocorrelation, m=5 harmonic | 8.80972 | −0.04258 | 0.54 Cells ✗ |
| autocorrelation, m=20 harmonic | 8.85111 | −0.00119 | 0.015 Cells |
| autocorrelation, m=50 harmonic | 8.85787 | +0.00557 | 0.070 Cells |
| autocorrelation, m=100 harmonic | 8.85143 | −0.00087 | 0.011 Cells |
| median of adjacent gridline spacings | 9.00000 | +0.14770 | 1.87 Cells ✗ |
| mean of adjacent gridline spacings | 8.85714 | +0.00484 | 0.061 Cells |

The **first** autocorrelation peak — the obvious thing to reach for — is off by 1.73 Cells.
The profile is comb-like, so the ACF peak is narrow and parabolic interpolation over
integer lags is badly biased toward the nearest integer (9). It only becomes competitive at
the m≈20–100 harmonic, where the lag is long enough that a whole-sample error divides down —
but by then the peak has decayed to 0.19–0.51 of the zero-lag value and you must already know
the pitch to ~±P/2 to place the search window. (I initially centred the m=100 window using a
wrong seed pitch and got 9.03.) **Autocorrelation is usable but is strictly worse than the
DFT here and has a bootstrapping problem.**

**(b) It yields the origin for free.** The complex argument of the DFT at the lattice
frequency *is* the lattice phase. Autocorrelation is translation-invariant by construction
and throws the origin away — you would need a separate step. See §5.

**(c) It yields a natural quality metric.** `|Z| / Σ|x|` at the peak frequency, i.e. the
fraction of the profile's energy that sits in the lattice comb. **[measured]** it is ~0.60
on a good axis-aligned chart and collapses to 0.18–0.40 under skew, which makes it a usable
automatic self-check for the fully-automatic happy path.

### 3.2 Concrete implementation

NumPy's DFT is defined with a negative exponent,
`A_k = Σ_m a_m · exp(-2πi·mk/n)`, and `norm="backward"` (unscaled forward transform) is the
default ([numpy.fft routines](https://numpy.org/doc/stable/reference/routines.fft.html)).
`np.fft.rfft` exploits Hermitian symmetry for real input and returns `n//2 + 1` bins; its
`n` parameter crops or **zero-pads** the input
([numpy.fft.rfft](https://numpy.org/doc/stable/reference/generated/numpy.fft.rfft.html)).
Zero-padding is what buys the fine frequency grid — it interpolates the existing spectrum
rather than adding true resolution, which is exactly what is wanted for peak localisation.

```python
def lattice_1d(profile, pmin=5.0, pmax=20.0, zero_pad=32):
    """-> (pitch, phase, strength). phase is the offset of the first gridline, in [0, pitch)."""
    x = np.asarray(profile, float)
    x = x - x.mean()                       # kill DC so bin 0 cannot win
    n = len(x)
    w = x * np.hanning(n)                  # sidelobe suppression for peak *location*
    N = n * zero_pad
    mag = np.abs(np.fft.rfft(w, n=N))
    f   = np.fft.rfftfreq(N)
    band = (f >= 1/pmax) & (f <= 1/pmin)   # constrain to plausible pitches -- see 3.3
    k = int(np.argmax(np.where(band, mag, -1)))
    y0, y1, y2 = mag[k-1], mag[k], mag[k+1]
    f0 = f[k] + 0.5*(y0-y2)/(y0-2*y1+y2) * (f[1]-f[0])   # parabolic refine

    # phase measured on the UNwindowed profile: the Hann window is symmetric so it does
    # not bias phase, but leaving it out avoids any question of it.
    z = np.sum(x * np.exp(-2j*np.pi*f0*np.arange(n)))
    pitch    = 1.0 / f0
    phase    = ((-np.angle(z) / (2*np.pi)) * pitch) % pitch
    strength = np.abs(z) / np.abs(x).sum()
    return pitch, phase, strength
```

`zero_pad=32` gives a frequency grid ~32× finer than the natural bin spacing; with the
parabolic refinement on top, the residual quantisation is far below the accuracy actually
achieved. **[measured]** this whole function costs **~60 ms for both axes** of the 1074×1428
image. A brute-force scan over a fine frequency grid (evaluating `Σ x·exp(-2πifx)` directly)
gives an indistinguishable answer (8.85329 vs 8.85329) at ~1000× the cost — don't bother.

An equivalent, more principled route to arbitrary-precision refinement is the matrix-multiply
DFT upsampling of **Guizar-Sicairos, Thurman & Fienup, "Efficient subpixel image
registration algorithms", *Optics Letters* 33(2):156–158, 2008**
([DOI 10.1364/OL.33.000156](https://doi.org/10.1364/OL.33.000156)) — upsample only a small
neighbourhood of the peak rather than zero-padding the whole transform. This is the algorithm
behind `skimage.registration.phase_cross_correlation`
([skimage.registration](https://scikit-image.org/docs/stable/api/skimage.registration.html)),
whose `upsample_factor` parameter is documented as registering "to within `1 / upsample_factor`
of a pixel". Worth knowing about; the zero-padded `rfft` is simpler and already sufficient at
this signal length.

### 3.3 Failure modes

- **Harmonic and sub-harmonic capture.** The every-5-Cells bold lines put real energy at
  period 44.7 px. **[measured]** on the clean image the fundamental comb still dominates
  (magnitude 3.63e6 at period 8.87 vs 1.37e6 at period 44.7), but **under 0.25°–1.0° of skew
  the estimator flips to 44.21 px** — the fine comb smears away first, leaving the bold comb
  standing. Mitigations: (i) constrain `pmin`/`pmax` to a plausible screenshot pitch band
  (5–20 px is a safe default for published charts and is what the code above uses); (ii) after
  picking `f0`, test `f0/2`, `f0/3`, `f0/5` and `2·f0` and prefer the highest frequency whose
  strength is within a factor of ~2 of the best; (iii) sanity-check that the recovered Cell
  count is plausible for a knitting chart.
- **Very small pitch.** **[measured]** strength falls from 0.60 at P=8.85 to 0.387 at P=3.10.
  Still accurate (0.04 Cells over 112), but the margin is thinning; below ~3 px the gridlines
  themselves are being destroyed by resampling.
- **Skew.** See §6 — this is the one that actually breaks it.
- **Spectral leakage biasing the peak.** Mitigated by the Hann window
  (`np.hanning`). Do not use the window when measuring phase — or, since a symmetric window
  has linear phase about the centre, be consistent about it.

---

## 4. Hough transform

### Concrete calls and parameters

OpenCV's [imgproc feature detection module](https://docs.opencv.org/4.x/dd/d1a/group__imgproc__feature.html):

```cpp
void cv::HoughLines (InputArray image, OutputArray lines, double rho, double theta,
                     int threshold, double srn=0, double stn=0,
                     double min_theta=0, double max_theta=CV_PI, bool use_edgeval=false)
void cv::HoughLinesP(InputArray image, OutputArray lines, double rho, double theta,
                     int threshold, double minLineLength=0, double maxLineGap=0)
void cv::Canny      (InputArray image, OutputArray edges, double threshold1, double threshold2,
                     int apertureSize=3, bool L2gradient=false)
```

- `rho` — "Distance resolution of accumulator in pixels"; `theta` — "Angle resolution of
  accumulator in radians"; `threshold` — "Accumulator threshold; lines with vote count
  exceeding this value are returned".
- `min_theta` / `max_theta` are the useful knob here: restrict the search to near-vertical and
  near-horizontal in two separate calls and the diagonal artwork stops competing for the
  accumulator.
- `HoughLinesP` implements the progressive probabilistic Hough transform of **Matas, Galambos
  & Kittler, "Robust detection of lines using the progressive probabilistic Hough transform",
  *Computer Vision and Image Understanding* 78(1):119–137, 2000**, cited as `[191]` in the
  [OpenCV bibliography](https://docs.opencv.org/4.x/d0/de3/citelist.html). `Canny` cites
  **Canny, "A computational approach to edge detection", *IEEE TPAMI* (6):679–698, 1986**
  (`[50]`, same page).

scikit-image equivalents
([skimage.transform](https://scikit-image.org/docs/stable/api/skimage.transform.html)):
`hough_line(image, theta=None)` → `(hspace, angles, distances)`; theta "defaults to 180 angles
evenly spaced in [-pi/2, pi/2)"; `hough_line_peaks(hspace, angles, dists, min_distance=9,
min_angle=10, threshold=None, num_peaks=inf)` with threshold defaulting to `0.5 * max(hspace)`;
`probabilistic_hough_line(image, threshold=10, line_length=50, line_gap=10, ...)`, which cites
the same Galamhos/Matas/Kittler 1999 work.

### Does it degrade like naive colour scanning? — No. **[measured]**

`cv2.Canny(gray, 50, 150, apertureSize=3)` produces edges at **17.5% / 16.8% / 25.6% / 22.4%**
density in the four vertical quarters of the image. Edge density is *higher*, not lower, in
the saturated bottom half. Same reason as §2: Canny thresholds a gradient, not a colour.

```
cv2.HoughLines (edges, 1, np.pi/180, threshold=300)
  -> 10293 lines: 335 near-vertical (theta<0.02), 443 near-horizontal, 9515 diagonal
     near-vertical   rho span   34 .. 1029   (ground truth gridlines: 34 .. 1026)
     near-horizontal rho span   52 .. 1382   (ground truth gridlines: 52 .. 1381)

cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=200, maxLineGap=3)
  -> 252 segments: 123 exactly vertical, 129 exactly horizontal, 0 diagonal
     horizontal y span 52 .. 1382,  vertical x span 34 .. 1019
```

**Hough recovers gridlines across the full height and width of the image, saturated regions
included.** The rho spans match ground truth to a pixel. This is a genuinely useful result: the
Hough path is not subject to the failure that killed the colour scan.

### Failure modes

- **Massive over-detection and duplication.** `HoughLines` returned 10 293 lines at
  threshold 300, 92% of them diagonal artwork. Even among the near-vertical ones, 335 lines for
  113 gridlines — the median rho difference is **2.00**, i.e. each gridline yields ~3 accumulator
  entries at `rho=1`. You get a cloud, not a list; clustering is mandatory. `HoughLinesP` with
  `minLineLength=200` is far cleaner (252 segments, zero diagonals) but still ~1.1 segments per
  gridline on the columns and **under-detects rows (129 found vs 151 present)**.
- **No sub-pixel output.** With `rho=1` the positions are integers. Reducing `rho` below 1 splits
  votes and lowers the peak. So Hough gives you *approximate* line positions, from which you
  must still fit a lattice — it does not itself solve the accumulation-of-error problem.
- **Threshold sensitivity.** `threshold` is an absolute vote count and therefore scales with image
  size and line length. **[measured]** scaling `threshold` and `minLineLength` linearly with the
  resize factor keeps the segment count roughly stable (252 → 250 → 282 → 133 at scales 1.0,
  0.732, 0.5, 0.35), but the vertical/horizontal balance degrades badly at 0.5 (177 vertical vs
  81 horizontal). It needs per-image tuning that the DFT does not.
- **Cost.** 0.2 s each for `HoughLines`/`HoughLinesP` here; `skimage.transform.hough_line` at
  0.25° resolution took 1.6 s. All acceptable, all slower than the 60 ms DFT.

**Verdict:** valuable as a *cross-check and rescue*, not as the primary estimator. Its output is
a set of candidate line positions with integer precision and both false positives and false
negatives. Feeding those into a robust lattice fit (`RANSAC` over (pitch, phase), or the
long-baseline fit of §1) is a legitimate fallback when the DFT's strength metric says the
periodic model failed. It is the natural rescue for a chart whose lattice is *not* uniform,
where the DFT's single-period assumption is simply wrong.

---

## 5. Corner / checkerboard detection — does not transfer

### The calls

From [`modules/calib3d/include/opencv2/calib3d.hpp`](https://github.com/opencv/opencv/blob/4.x/modules/calib3d/include/opencv2/calib3d.hpp) /
[the calib3d reference](https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html):

```cpp
bool findChessboardCorners  (InputArray image, Size patternSize, OutputArray corners,
                             int flags = CALIB_CB_ADAPTIVE_THRESH + CALIB_CB_NORMALIZE_IMAGE);
bool findChessboardCornersSB(InputArray image, Size patternSize, OutputArray corners,
                             int flags, OutputArray meta);
bool checkChessboard        (InputArray img, Size size);
```

Flags for the classic detector: `CALIB_CB_ADAPTIVE_THRESH`, `CALIB_CB_NORMALIZE_IMAGE`,
`CALIB_CB_FILTER_QUADS`, `CALIB_CB_FAST_CHECK`, `CALIB_CB_PLAIN`. For `...SB`:
`CALIB_CB_NORMALIZE_IMAGE`, `CALIB_CB_EXHAUSTIVE`, `CALIB_CB_ACCURACY`, `CALIB_CB_LARGER`,
`CALIB_CB_MARKER`.

`findChessboardCornersSB` "uses a localized radon transformation approximated by box filters
being more robust to all sort of noise, faster on larger images and is able to directly return
the sub-pixel position of the internal chessboard corners", citing **Duda & Frese, "Accurate
Detection and Localization of Checkerboard Corners for Calibration", 29th British Machine Vision
Conference (BMVC), Newcastle, 2018** ([`[78]` in the OpenCV
bibliography](https://docs.opencv.org/4.x/d0/de3/citelist.html);
[paper listing](https://www.dfki.de/en/web/research/projects-and-publications/publication/9928)).
The paper reports localisation "close to the theoretical limit of 1/100 of a pixel". On paper
this is exactly the accuracy the ticket wants.

### It fails, and the reason is structural. **[measured]**

Every variant returns `found=False` on this chart:

| call | result | time |
|---|---|---|
| `findChessboardCorners(g, (112,152), ADAPTIVE_THRESH+NORMALIZE_IMAGE+FAST_CHECK)` | False | 0.10 s |
| `findChessboardCorners(g, (9,9), same flags)` | False | 0.54 s |
| `findChessboardCornersSB(g, (111,151), LARGER+NORMALIZE_IMAGE)` | False | 0.35 s |
| `findChessboardCornersSB(g, (5,5), LARGER+EXHAUSTIVE)` | False | 0.33 s |
| `checkChessboard(g, (112,152))` | False | 0.05 s |

Not a tuning problem. Sampling the Cell centres on the (independently verified) true lattice:

- **88.5%** of horizontally adjacent Cell pairs and **90.1%** of vertically adjacent pairs are
  the same colour (RGB distance < 20).
- Only **1.9% of the 16 539 interior corners** show the alternating 2×2 luminance pattern
  (`sign(a−b) == sign(d−c)` and `sign(a−c) == sign(d−b)`, with both contrasts > 20) that defines
  a checkerboard corner.

A colorwork chart is a *picture*: it is made of large flat regions of one colour. A checkerboard
corner requires four cells alternating light-dark-light-dark, and 98% of this chart's corners are
nothing of the sort — there is no corner feature there to detect, at any parameter setting.

Two further documented blockers even for a hypothetical high-contrast chart:

- Both functions require a quiet border. Classic: *"The function requires white space (like a
  square-thick border, the wider the better) around the board … Otherwise, if there is no border
  and the background is dark, the outer black squares cannot be segmented properly and so the
  square grouping and ordering algorithm fails."* SB: *"The function requires a white boarder with
  roughly the same width as one of the checkerboard fields around the whole board."* A user-cropped
  chart rectangle has no such border by construction.
- Both are **all-or-nothing**: the classic detector "returns a non-zero value if **all** of the
  corners are found and they are placed in a certain order … Otherwise, if the function fails to
  find all the corners or reorder them, it returns 0". One ambiguous corner out of 17 000 loses the
  whole lattice. That is precisely the wrong robustness profile for a fully-automatic happy path.

**Verdict: rule it out.** Note however that `estimateChessboardSharpness`'s documented rule of
thumb — a black↔white transition should be "below ~3.0 pixels" — is a useful independent
sanity check on whether a rescaled screenshot still has resolvable gridlines.

---

## 6. Cross-cutting concerns

### 6.1 Rescaled screenshots (non-integer pitch) — the DFT handles this cleanly. **[measured]**

Resizing the chart with `cv2.resize(img, None, fx=s, fy=s, interpolation=...)`
([OpenCV geometric transforms](https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html))
and re-running the estimator:

| scale | interp | size | expected pitch | recovered | error | drift / 112 Cells | strength |
|---|---|---|---|---|---|---|---|
| 0.732 | INTER_AREA | 786×1045 | 6.4799 | 6.4804 | +0.0005 | 0.009 Cells | 0.596 |
| 0.500 | INTER_AREA | 537×714 | 4.4261 | 4.4272 | +0.0010 | 0.026 Cells | 0.553 |
| 1.370 | INTER_LINEAR | 1471×1956 | 12.1277 | 12.1292 | +0.0015 | 0.014 Cells | 0.607 |
| 0.813 | INTER_LINEAR | 873×1161 | 7.1969 | 7.1975 | +0.0006 | 0.009 Cells | 0.591 |
| 0.450 | INTER_AREA | 483×643 | 3.9835 | 3.9839 | +0.0004 | 0.010 Cells | 0.514 |
| 0.350 | INTER_AREA | 376×500 | 3.0983 | 3.0994 | +0.0011 | 0.040 Cells | 0.387 |

Non-integer pitch is a non-issue for the DFT: it works in the continuous frequency domain and
never assumes an integer period. Accuracy stays within 0.04 Cells across the whole chart even at a
3.1 px pitch. This is the single strongest argument for the frequency-domain approach — every
integer-lag method (median spacing, ACF first peak, Hough with `rho=1`) is quantised, and this one
is not.

Note the strength metric degrading with scale (0.60 → 0.39). Use it as a "this screenshot is too
small" gate.

### 6.2 Deskew — required, and the tolerance is tight. **[measured]**

Rotating the chart with `cv2.getRotationMatrix2D` + `cv2.warpAffine` and re-estimating:

| injected rotation | recovered pitch | strength | verdict |
|---|---|---|---|
| 0.00° | 8.8533 | 0.613 | correct |
| 0.10° | 8.8541 | 0.601 | correct |
| **0.25°** | **44.2100** | 0.399 | **broken — locked onto the 5-Cell bold comb** |
| **0.50°** | **44.2080** | 0.416 | **broken** |
| **1.00°** | **44.2029** | 0.367 | **broken** |
| 2.00° | 8.8534 | 0.182 | numerically right, strength collapsed |

The mechanism is arithmetic, not mysterious. Summing over `H` rows smears a vertical line across
`H·tan θ` pixels; the comb survives only while that is well under half a pitch:

```
theta_max ≈ atan( P / (2H) ) = atan(8.85 / 2856) = 0.178°
```

which matches the measured cliff between 0.10° and 0.25° exactly. **Any projection-profile method
must be deskewed first.** Screenshots are *usually* axis-aligned, but "usually" is not a safe
assumption when the failure is silent and produces a plausible-looking wrong pitch — the 0.25° case
returned strength 0.40, which a naive threshold would accept.

**A cheap deskew that works. [measured]** Sweep the rotation angle and take the one maximising the
DFT peak strength:

```python
def deskew(gray, lo=-0.8, hi=0.8, step=0.05):
    best = (0.0, -1.0)
    for a in np.arange(lo, hi + 1e-9, step):
        M = cv2.getRotationMatrix2D((gray.shape[1]/2, gray.shape[0]/2), a, 1.0)
        r = cv2.warpAffine(gray, M, gray.shape[::-1],
                           flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        _, _, s = lattice_1d(np.abs(np.diff(r.astype(float), axis=1)).sum(0))
        if s > best[1]: best = (a, s)
    return best[0]
```

Injecting +0.40° and sweeping ±0.8° in 0.05° steps recovered a correction of **exactly −0.40°**
(strength 0.6225, pitch 8.8536); on the unrotated image it returned −0.05°, i.e. within one step of
zero. **33 angles cost 1.5 s.** Coarse-to-fine (0.1° then 0.02°) would halve that.

`skimage.transform.rotate(image, angle, resize=False, order=1)` is the scikit-image equivalent.

**Hough as an alternative deskew estimator.** `skimage.transform.hough_line` with a 0.25° theta
grid, scoring each angle column by sum-of-squares of the accumulator, **[measured]** ranked the top
orientations as −90.00°, +0.12°, −0.12°, −0.37° — correctly identifying the image as axis-aligned,
in 1.6 s. This is a reasonable independent check but I could not make it *more* accurate than the
profile-strength sweep, and a naive "modal Hough line angle" is easy to get wrong (angle wrapping at
±45°/±90° bit me on the first attempt). Prefer the strength sweep; keep Hough for the case where the
profile method has no peak to maximise at all.

### 6.3 Recovering the ORIGIN, not just the pitch

**The phase of the DFT at the lattice frequency is the origin.** With `z = Σ x[i]·exp(-2πi·f₀·i)`
computed on the mean-removed profile, the position of the first lattice line in `[0, P)` is
`(-arg(z)/2π)·P mod P`. The sign follows from NumPy's negative-exponent DFT convention
([numpy.fft](https://numpy.org/doc/stable/reference/routines.fft.html)); `np.angle` gives the
argument.

**[measured]** accuracy on the example chart:

| axis | recovered pitch | pitch error | recovered phase | true origin mod P | phase error |
|---|---|---|---|---|---|
| x | 8.85328 | +0.00098 | 7.8621 | 8.0151 | **−0.150 px** |
| y | 8.85339 | −0.00089 | 8.4648 | 8.4621 | **−0.002 px** |

Combined worst case at the far edge of the chart: `0.00098 × 112 + 0.150 = 0.260 px = 0.029 Cells`.
The budget before sampling lands in the wrong Cell is 0.5 Cells, so there is a **17× margin**.

**Phase gives origin *modulo* P. Getting the absolute origin and the Cell count needs one more
step:** evaluate the profile at every predicted lattice position across the image, mark which ones
have edge support, and take the extent of the supported region.

```python
def extent(profile, pitch, phase, win=9, need=5):
    n = len(profile)
    ks  = np.arange(int(np.floor(-phase/pitch)), int(np.ceil((n-phase)/pitch)) + 1)
    pos = phase + ks*pitch
    pos = pos[(pos >= 1) & (pos < n-1)]
    val = np.array([profile[int(round(x))-1 : int(round(x))+2].max() for x in pos])
    good = val > np.median(val) * 0.25
    # gap-tolerant: a line is "inside the chart" if >=need of the surrounding win lines are supported
    dens = np.convolve(good.astype(int), np.ones(win, int), mode='same') >= need
    idx = np.flatnonzero(dens)
    return pos[idx[0]], idx[-1] - idx[0]      # (first gridline, n_cells)
```

**[measured]** results, against ground truth `x: 34..1026, 112 Cells` and `y: 52..1381, 150 Cells`:

```
[x] extent 34.42 .. 1025.99 = 112 Cells   (100% of interior lines supported)
[y] extent 52.73 .. 1380.74 = 150 Cells   ( 99% of interior lines supported)
```

Exact on both axes, sub-pixel on the origin.

**The `win`/`need` gap tolerance is load-bearing, not decoration. [measured]** My first attempt used
the *longest strictly contiguous run* of supported lines. On the columns it was perfect; on the rows
a handful of horizontal gridlines inside the saturated region fall under the support threshold, the
run broke, and it returned `539.67 .. 1380.74 = 95 Cells` instead of 150 — losing a third of the
chart. The 5-of-9 density rule fixes it completely. **Any extent heuristic must tolerate individually
missing gridlines**, which is the same lesson the naive colour scan taught, in a different place.

### 6.4 Verifying the recovered lattice

Two checks the spike should implement, both cheap:

**(a) Residual against detected peaks. [measured]** Distance from each predicted lattice line to the
nearest `find_peaks` peak:

```
[x] median 0.752 px, p90 1.095 px, max 1.902 px; 100.0% of lines within P/4
[y] median 0.806 px, p90 8.130 px, max 16.824 px;  84.4% of lines within P/4
```

The x-axis is clean. The y-axis p90/max are large *not* because the lattice is wrong but because
some horizontal gridlines have no detectable peak at all (obscured by the flames), so the "nearest
peak" is a lattice line away. **A pass criterion should be on the median and the fraction within
P/4, not on the max.** ≥80% of lines within P/4 is a reasonable bar.

**(b) Windowed phase consistency. [measured]** Re-measure the phase at the known frequency in 8
horizontal bands. Constant phase means a uniform, unskewed lattice:

```
7.87 7.86 7.85 7.87 7.86 7.87 7.86 7.86
unwrapped spread = 0.020 px  ->  residual skew <= 0.0008 deg
```

This is a much sharper skew detector than the global strength metric and costs almost nothing. It
also catches non-uniform lattices (an inserted legend strip, a chart with a doubled column) which
would show a phase step rather than a constant.

### 6.5 End-to-end proof

Running the full pipeline (profile → DFT pitch+phase → gap-tolerant extent → sample Cell centres
with a 3×3 median) produced a **112 × 150 Cell** resample of the chart. Rendered at 6× nearest
neighbour it is a clean, artefact-free pixel image with no drift or Cell-boundary smearing anywhere,
including the bottom-right corner furthest from the origin. Overlaying the extrapolated lattice on
the original at the bottom-right corner shows the predicted lines still sitting on the actual
gridlines after 112 columns and 150 rows of extrapolation.

(Incidentally: 989 distinct RGB values at the 16 800 Cell centres, corroborating the map's note that
colour clustering is mandatory. Out of scope for this ticket.)

---

## 7. Recommendation

### Try FIRST: gradient projection profile → zero-padded DFT peak (pitch) + DFT phase (origin)

```
1. gray = cvtColor(BGR2GRAY)
2. deskew: sweep rotation ±0.8° @0.05°, maximise DFT peak strength         (~1.5 s)
   -> skip the sweep if |best angle| < 0.05°, which is the common case
3. col_profile = |diff(gray, axis=1)|.sum(0);  row_profile = |diff(gray, axis=0)|.sum(1)
4. per axis: lattice_1d(profile, pmin=5, pmax=20, zero_pad=32)
   -> pitch (continuous), phase (origin mod pitch), strength
5. guard against harmonic capture: test f0/5, f0/3, f0/2, 2*f0
6. per axis: gap-tolerant extent(profile, pitch, phase, win=9, need=5)
   -> absolute first gridline + Cell count
7. verify: median |lattice - nearest peak| < P/8 AND >=80% of lines within P/4
           AND windowed phase spread < 0.25 px across 8 bands
8. sample Cell centres with a 3x3 median
```

Why first:

- **It is the only method measured that is accurate enough.** 0.029 Cells of worst-case error
  against a 0.5-Cell budget. Every integer-quantised alternative (median spacing, ACF first peak,
  Hough at `rho=1`) is off by 0.5–1.9 Cells.
- **It answers the ticket's central worry directly.** Measured pitch spread across 14 bands
  including the flames and wall: 0.014%. The saturated regions are simply not a problem for a
  gradient-based, energy-summing method — the naive scan failed because it used a colour predicate,
  not because the region is hard.
- **It handles rescaled screenshots natively** — no integer-period assumption anywhere, verified
  down to a 3.1 px pitch.
- **It gives the origin for free**, which autocorrelation cannot, and which is half the problem.
- **It is fast** (60 ms) and **~40 lines of NumPy** — no OpenCV dependency at all except for the
  optional deskew and colour conversion.
- **It self-reports failure** via the peak strength and the two verification checks, which the
  fully-automatic happy path needs in order to know when to hand off to the correction path.

### Fall back to: Canny + `HoughLinesP`, clustered, then robust lattice fit

Trigger the fallback when step 7's verification fails, or when the strength metric is below ~0.35.

```
edges = cv2.Canny(gray, 50, 150, apertureSize=3)
segs  = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=0.15*max(H,W), maxLineGap=3)
   -> keep exactly-axis-aligned segments; cluster their x (resp. y) with tolerance P/3
   -> robust fit of (pitch, origin) over the cluster centres, e.g. RANSAC or a long-baseline
      least-squares with iterative index reassignment
```

Why second, not first:

- It **does** survive the saturated regions (measured rho spans 34..1029 and 52..1382, matching
  ground truth), so it is a real fallback and not a token one.
- But its output is integer-precision, duplicated (~3 accumulator lines per gridline at `rho=1`),
  and incomplete (129 of 151 horizontal gridlines found). It gives you *candidate lines*; you still
  have to fit a lattice to them, and that fit inherits the index-assignment bootstrapping problem
  of §1.
- Its thresholds are absolute vote counts and need per-image scaling, which the DFT does not.
- It is 3–25× slower.

Its real value is the case the DFT cannot handle **by construction**: a chart whose lattice is not a
single uniform period. There the single-frequency model is wrong and a line list is the right
primitive.

### Do not implement

- **Checkerboard detection** (`findChessboardCorners`, `findChessboardCornersSB`). Measured: 1.9%
  of corners have the required alternating pattern; all five variants tried return `found=False`;
  the documented white-border requirement conflicts with a user-cropped rectangle; and the
  all-or-nothing return is the wrong robustness profile. Ruled out on structure, not on tuning.
- **Autocorrelation as the primary pitch estimator.** It needs a good seed pitch to place the
  harmonic search window (chicken-and-egg), its first peak is biased by 1.7 Cells, and it discards
  the phase you need for the origin. Reasonable as a third opinion inside the verification step;
  not as an estimator.
- **Median or mode of adjacent gridline spacings.** Costs 1.87 Cells of drift on this chart. This
  is the trap the ticket was written to avoid, and the map's own "median 9.0" figure is an instance
  of it.

---

## Sources

Primary library documentation and source:

- OpenCV, [Feature Detection (imgproc)](https://docs.opencv.org/4.x/dd/d1a/group__imgproc__feature.html) — `HoughLines`, `HoughLinesP`, `Canny` signatures and parameters.
- OpenCV, [Camera Calibration and 3D Reconstruction (calib3d)](https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html) and [`modules/calib3d/include/opencv2/calib3d.hpp`](https://github.com/opencv/opencv/blob/4.x/modules/calib3d/include/opencv2/calib3d.hpp) — `findChessboardCorners`, `findChessboardCornersSB`, `checkChessboard`, `estimateChessboardSharpness`, flags, and the white-border / all-or-nothing notes.
- OpenCV, [Bibliography](https://docs.opencv.org/4.x/d0/de3/citelist.html) — entries `[78]` duda2018, `[191]` Matas00, `[50]` Canny86.
- OpenCV, [Geometric Image Transformations](https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html) — `resize`, `getRotationMatrix2D`, `warpAffine`.
- NumPy, [Discrete Fourier Transform routines](https://numpy.org/doc/stable/reference/routines.fft.html) — DFT definition (negative exponent), normalisation conventions.
- NumPy, [`numpy.fft.rfft`](https://numpy.org/doc/stable/reference/generated/numpy.fft.rfft.html) — the `n` parameter crops or zero-pads; Hermitian symmetry, `n//2 + 1` output length.
- NumPy, [`numpy.diff`](https://numpy.org/doc/stable/reference/generated/numpy.diff.html).
- SciPy, [`scipy.signal.correlate`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.correlate.html) — cross-correlation definition, `mode`, `method='fft'|'direct'|'auto'`.
- SciPy, [`scipy.signal.find_peaks`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html) — `distance`, `prominence`, and the documented caveat that noise shifts peak locations.
- scikit-image, [`skimage.transform`](https://scikit-image.org/docs/stable/api/skimage.transform.html) — `hough_line`, `hough_line_peaks` (defaults `min_distance=9`, `min_angle=10`, `threshold=0.5*max`), `probabilistic_hough_line`.
- scikit-image, [`skimage.registration`](https://scikit-image.org/docs/stable/api/skimage.registration.html) — `phase_cross_correlation`, `upsample_factor` semantics and its reference list.

Papers:

- J. Canny, "A computational approach to edge detection", *IEEE TPAMI* (6):679–698, 1986. (Cited by OpenCV as `Canny86`.)
- J. Matas, C. Galambos, J. Kittler, "Robust detection of lines using the progressive probabilistic Hough transform", *Computer Vision and Image Understanding* 78(1):119–137, 2000. (The algorithm behind `HoughLinesP`; cited by OpenCV as `[191]`.)
- A. Duda, U. Frese, "Accurate Detection and Localization of Checkerboard Corners for Calibration", *29th British Machine Vision Conference (BMVC)*, Newcastle, 2018. ([listing](https://www.dfki.de/en/web/research/projects-and-publications/publication/9928)) (The algorithm behind `findChessboardCornersSB`; cited by OpenCV as `[78]`.)
- M. Guizar-Sicairos, S. T. Thurman, J. R. Fienup, "Efficient subpixel image registration algorithms", *Optics Letters* 33(2):156–158, 2008. [DOI 10.1364/OL.33.000156](https://doi.org/10.1364/OL.33.000156). (Matrix-multiply DFT upsampling; the algorithm behind `phase_cross_correlation`.)

Measurements: all **[measured]** figures were produced against
`tests/examples/112w150h.png` in this repository, with
`opencv-python-headless 5.0.0`, `scikit-image 0.26.0`, `numpy 2.5.2`, `scipy 1.18.0`.
