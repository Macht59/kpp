# Automatic extraction spike

Type: prototype
Status: open
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
