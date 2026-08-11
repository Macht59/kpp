# Lattice recovery techniques

Type: research
Status: resolved

## Question

Recovering the Chart's lattice — origin, pitch, and Cell dimensions — is the foundation everything else stands on. Get the pitch slightly wrong and error accumulates across 112 columns until sampling lands in the neighbouring Cell, corrupting every Run downstream.

We know from charting that the naive approach fails: scanning for grey gridlines recovered horizontal lines only in the white margin (down to y=717 of 1428) and collapsed entirely across the saturated flames and wall, because gridlines are drawn *over* fills and take their colour from beneath. The pitch itself is regular (~9px, median 9.0), which suggests recovering a *periodicity* and extrapolating beats tracing individual lines.

Survey how this is actually done, against primary sources:

- **Projection profiles** — summing gradient magnitude per row/column, then finding the dominant period. Cheap; how well does it survive saturated regions?
- **Frequency-domain methods** — FFT or autocorrelation on the projection to recover pitch directly, including sub-pixel and non-integer pitch. This looks most promising given a regular lattice and unreliable individual lines.
- **Hough transform** — OpenCV's `HoughLines`. Standard for line detection, but does it degrade the same way naive scanning does when line colour varies with the background?
- **Corner/checkerboard detection** — `findChessboardCorners` and relatives solve a strikingly similar problem. Do they transfer to a chart that is not a checkerboard?

Also establish: how each handles a screenshot that has been **rescaled** (non-integer pitch), and whether any needs the image deskewed first.

Return concrete technique names, the OpenCV/scikit-image calls that implement them, their known failure modes, and a recommendation for what the spike should try first and what it should fall back to. Cite primary sources — library docs and papers, not blog summaries.

Resolved by a `/research` subagent; capture findings on a `research/lattice-recovery` branch with a context pointer here.

## Answer

Full findings, with citations: [`docs/research/lattice-recovery.md`](../../../docs/research/lattice-recovery.md) (706 lines, 30 primary sources).

**Try first: gradient projection profile → zero-padded DFT peak for pitch, DFT *phase* at that peak for origin.** Validated end to end on the example chart: worst-case lattice error at Cell 112 is **0.26 px = 0.029 Cells** against a 0.5-Cell budget — a 17× margin — in ~60 ms and ~40 lines of NumPy. It handles non-integer pitch natively (verified across scales 0.35–1.37, still within 0.04 Cells), and the phase yields the **origin**, which autocorrelation structurally cannot.

**Fall back to: Canny + `HoughLinesP` + clustering + robust lattice fit.** It does survive the saturated regions (measured rho spans match ground truth), but its output is integer-precision, ~3× duplicated, and incomplete — a rescue, not a primary. Its real value is charts whose lattice is not a single uniform period.

**Checkerboard detection is ruled out on structure, not tuning.** Only 1.9% of interior corners show the alternating 2×2 luminance pattern `findChessboardCorners` requires, because 88–90% of neighbouring Cells share a colour. All five variants tried return `found=False`.

### This corrects a charting fact — the map's pitch was wrong

The "median 9.0 px" recorded during charting is a **rounding artefact** of integer-rasterised spacings, and it is precisely the trap this ticket was opened to avoid. The true pitch is **~8.852** (113 consecutive gridlines spanning x=34..1026, bounding exactly 112 Cells). Using 9.0 accumulates **16.5 px ≈ 1.87 Cells** of drift — enough to corrupt every Run past the midpoint.

**Independently verified** by direct lattice fit (maximising gradient-projection energy over pitch and offset, separate stdlib decoder): **8.856** on columns, **8.854** on rows — agreement with the research to ~0.004 px. Chart dimensions correct to **112 × 150** Cells, not the 112 × 152 estimated.

### Two further findings that change how the spike should be built

1. **The saturated regions are a non-problem for gradient-based methods.** Pitch spread across 14 bands including the flames and wall is 0.014%. The naive scan failed because it used an absolute *colour* predicate where a *differential* one was needed — not because that region is intrinsically hard. The charting note implying saturation is the obstacle is misleading; the obstacle was the predicate.
2. **Deskew is mandatory, and the tolerance is brutal.** 0.1° is fine; **0.25° silently returns a plausible-but-wrong pitch**, locking onto the chart's every-5-Cells bold-line comb at 44.2 px. Silent and plausible is the dangerous failure mode — it is exactly what [Acceptance bar for automatic extraction](02-acceptance-bar.md) needs a self-detection signal for. A 1.5 s angle sweep maximising DFT peak strength recovered an injected 0.40° exactly.

End-to-end proof: the full pipeline resampled the chart to a clean 112 × 150 Cell grid with no drift at the far corner.

---

## Amendment — confirmed on the corpus, with one gap exposed

Re-run against the charts from [Assemble a test corpus of chart screenshots](01-test-corpus.md), which arrived after this ticket closed. Unlike [Palette recovery from anti-aliased, lossy charts](04-palette-recovery.md), **this recommendation held**.

| | `8w37h.png` | `74w38h.png` |
|---|---|---|
| DFT pitch x / y | 40.627 / 40.594 | 24.913 / 24.956 |
| Cells sampled on that lattice | **8 × 37 exact** | **74 × 38 exact** |

Both came back square to within 0.04 px, and interior sampling on the recovered lattices produced exactly the Cell counts the filenames declare. It survived `8w37h`'s 38%-unique-pixel dithering and `74w38h`'s scan degradation — the two charts where the palette technique struggled or failed. Gradient projection is genuinely robust to noise that destroys colour-based methods, which is the same lesson as the original correction about differential versus absolute predicates.

Also incidentally settled: **Cells are square** on all three PNGs. `66w55h.jpg` is unmeasured and its margins hint otherwise, so x and y pitch must still be recovered independently — but there is no evidence yet for the non-square case.

### The gap: pitch alone does not give Cell count

Pitch is necessary and not sufficient. Naive `image_dimension / pitch` overcounts on every corpus chart, because number gutters and margins are inside the image but outside the grid:

| | implied | true | error |
|---|---|---|---|
| `8w37h` x | 9.89 | 8 | **+24%** |
| `8w37h` y | 37.59 | 37 | +1.6% |
| `74w38h` x | 75.46 | 74 | +2.0% |
| `74w38h` y | 40.63 | 38 | +6.9% |

The exact counts above were obtained by supplying the grid extent, not by deriving it. Cropping is the user's job by an earlier decision, so this is nominally covered — but **a hand-drawn crop on a phone will not be pixel-exact**, and the table shows how little slop it takes to gain or lose a column. The DFT **phase** already yields the origin to sub-pixel precision, so the fix is available and cheap: **snap the user's crop to the recovered lattice rather than trusting its edges**. [Automatic extraction spike](05-extraction-spike.md) must do this and report how far raw crops typically sit from the snapped ones.

Number gutters are also an *opportunity* the map had not considered: three of four corpus charts print row or column numbers, which is an independent statement of the Cell count available for cross-checking a parse.
