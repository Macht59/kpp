# Automatic extraction spike

Type: prototype
Status: resolved
Blocked by: 01, 02, 03, 04

## Question

This is the spine of the map. Everything upstream feeds it and everything downstream waits on it: **does fully-automatic extraction actually work on real charts?**

Build a throwaway Python pipeline that takes a cropped chart screenshot and returns a Chart — grid dimensions, Palette, and a 2D array of Cells — using the techniques [Lattice recovery techniques](03-lattice-recovery.md) and [Palette recovery from anti-aliased, lossy charts](04-palette-recovery.md) recommend. Run it across the whole corpus from [Assemble a test corpus of chart screenshots](01-test-corpus.md).

> **All four blockers are resolved, and three of them changed this ticket. Read their amendments, not just their headlines.**
>
> **Score on correction burden, not accuracy.** [Acceptance bar for automatic extraction](02-acceptance-bar.md) settled that there is no programmatic bar — the user reviews every parse. So the number that matters is *how much manual repair is left*, reported in two separate categories that must never be averaged together:
>
> - **Cell errors** — count them. Each is one tap to fix.
> - **Structural errors** — wrong dimensions, wrong Palette size, misaligned lattice. Report these as pass/fail per chart, never as a percentage. They cannot be corrected, only redone, so one of them fails the chart outright regardless of per-Cell accuracy.
>
> **Ground truth is in the filenames.** `74w38h.png` is 74×38 Cells. Dimensions can be scored automatically with no annotation work; per-Cell colour cannot, so decide early how much of it is worth hand-labelling.
>
> **Two mechanism changes since the research closed:**
>
> - Palette: use a **threshold sweep with plateau selection** and a Lab-collinearity test for gridline blends. Do *not* use the fixed ΔE 3.0 or flat-pixel harvesting as primary — both were falsified on the corpus.
> - Lattice: **snap the user's crop to the recovered lattice** using the DFT phase. Pitch alone does not give Cell count, and raw crop edges overcounted by up to 24% on the corpus.
>
> **`66w55h.jpg` forces a real image library** — the stdlib PNG decoder used for verification on this map cannot read JPEG.

Throwaway is a constraint on how it is written, not a promise to delete it: no API, no service, no error handling beyond what the experiment needs. Keep it on a `prototype/extraction-spike` branch and link it here.

What the spike must actually answer, beyond a pass/fail number:

- **Where does it break, and on which corpus axis?** Fine pitch, no gridlines, rescaled screenshots, and dense overlay are the suspected failure axes — find out which are real.
- **Does per-Cell confidence exist?** [Acceptance bar for automatic extraction](02-acceptance-bar.md) needs a self-detection signal. Does the pipeline naturally produce one — clustering ambiguity, pitch-fit residual, within-Cell colour variance — or must one be engineered?
- **What does it cost?** Rough wall-clock and memory on a full-size chart. The deployment shape sitting in the map's fog depends on this.

- **How far are raw crops from snapped ones?** If a hand-drawn crop on a phone typically sits within a fraction of a Cell, snapping is a safety net. If it does not, crop assistance becomes a v1 requirement.

**Resolved when** there is a scored result across the corpus — Cell errors counted, structural errors reported per chart — a clear statement of which inputs work and which don't, and a judgement with the human on whether the correction burden is small enough that parsing beats charting by hand.

If the answer is that it isn't viable, say so plainly. A negative result here is the map doing its job, and it redraws the route rather than failing it.

## Answer

**Viable. Automatic extraction works across the whole corpus, and parsing beats charting by hand** — the human confirmed the correction burden is small enough. A negative result would have redrawn the route; instead the spine holds.

Prototype on branch `prototype/extraction-spike` (throwaway, kept not deleted). Findings, scored table, and reconstructions: [`prototype/extraction-spike/README.md`](../../../prototype/extraction-spike/README.md); side-by-sides in `prototype/extraction-spike/out/*.compare.png`.

### Scored result — every chart passes structurally

| chart | dims | Palette | pitch x/y |
|---|---|---|---|
| `112w150h-9colors` | 112×150 ✓ | 9 ✓ | 8.85 / 8.85 |
| `66w55h-2colors` (JPEG) | 66×55 ✓ | 2 ✓ | 25.66 / 19.00 (non-square) |
| `74w38h-2colors` | 74×38 ✓ | 2 ✓ | 24.92 / 24.93 |
| `8w37h-2colors` | 8×37 ✓ | 2 ✓ | 41.15 / 40.57 |

Cell-level burden (eyeballed, per the no-hand-labelling call): **low**. Reconstructions are faithful; the only visible misfills come from the overlay layer ([06](06-overlay-layer.md)) and Non-stitch ([07](07-non-stitch-rule.md)) — a handful of taps on a 16,800-Cell chart, not hundreds.

### What the amendments got right, and two things they got wrong

- **Lattice ([03](03-lattice-recovery.md)) held completely** — DFT-peak pitch (per-axis, recovered the non-square JPEG), mandatory deskew (0.35° on the scan auto-corrected). Origin recovered by a direct offset-search over the gradient comb rather than DFT phase — equivalent, more robust under windowing.
- **Plateau merge ([04](04-palette-recovery.md)) held and is decisive** — threshold-sweep + widest plateau gave 9/2/2/2 exact; fixed ΔE 3.0 gave 127/5/15/49, confirmed garbage.
- **Two recorded figures were wrong; the filenames win.** `8w37h` is **2 colours** (not the "3" ticket 04 recorded); `112w150h` is **9** (not "10"). The spike recovers 2 and 9.
- **Lab-collinearity blend rejection was dropped** — unnecessary (plateau already merges blends) and harmful (over-removed a rare real yarn, 9→8).
- **Comb-support grid-trimming was tried and rejected** — it reintroduced the exact naive-scan failure 03 warned about (support drops out over saturated regions, collapsing to 8×1). The lattice must be extrapolated, not traced.

### What this hands forward

- **06 and 07 are unblocked and given their measurement precondition** — Cell sampling works, overlay corruption is visibly small, both Non-stitch mechanisms (silhouette, X-glyph) are observed in the reconstructions.
- **Crop precision, not extraction, is the fragile part.** Pitch is exact; final Cell count is only as good as the crop (at 8.85px pitch a 4px error flips a row; number gutters must be excluded by the crop, not auto-trimmed). Crop assistance is a v1 requirement — folded into the correction vocabulary and the contract's crop-rect/pitch fields ([08](08-chart-contract.md) Q4).
- **A confidence signal falls out for free** — within-Cell spread (median MAD 0.58 crisp → ~5 noisy) and cluster assignment margin (ΔE 13.5–63.5). Answers [02](02-acceptance-bar.md)'s open question and feeds [08](08-chart-contract.md) Q3.
- **Cost:** ~10 s / 176 MB on the 1074×1428 chart; the deskew angle-sweep dominates and drops ~10× if estimated on a downsampled copy. Feeds the deployment-shape fog.
- **Correction vocabulary graduates** to [09](09-correction-vocabulary.md): the error classes are now known.
