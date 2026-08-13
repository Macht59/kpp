# Assemble a test corpus of chart screenshots

Type: task
Status: resolved

## Question

Nothing else on this map can be judged against a single example. "Does automatic extraction work?" is unanswerable with n=1 — the one chart we have could be unrepresentative in pitch, palette size, gridline weight, or overlay density, and a pipeline tuned to it would prove nothing.

Assemble a corpus of **8–12 colorwork chart screenshots** spanning the variation the parser will actually meet, and record for each what makes it interesting. Target the axes we already know bite:

- **Grid pitch** — much finer and much coarser than the example's ~9px, including at least one where pitch is non-integer or the screenshot has been rescaled.
- **Palette size** — a 2–3 colour chart and something busier than the example's 12–16.
- **Gridline treatment** — heavy every-10 lines, hairline-only, and at least one chart with *no* gridlines at all.
- **Overlay density** — charts free of outlines and symbols, and charts worse than the example.
- **Silhouette** — plain rectangles as well as garment shaping with non-stitch background.
- **Provenance** — screenshots taken at different zoom levels and from different pattern software, since compression artifacts differ.

This is HITL: the agent cannot judge what a real knitter's chart looks like, and sourcing is a human call. Note licensing — these are working test fixtures, so prefer charts you own or that are freely licensed, and record the source for each.

**Resolved when** the corpus lives in the repo (or a linked location) with a short manifest naming each chart's interesting property, and the whole set is diverse enough that passing on all of it would be real evidence.

## Answer

**Four charts in [`tests/examples/`](../../../tests/examples/), manifest at [`tests/examples/MANIFEST.md`](../../../tests/examples/MANIFEST.md).** Three supplied by the user; the fourth is the original charting example, moved in from the repo root and renamed `112w150h.png`.

Ground truth is carried **in the filename** — `<width>w<height>h` in Cells. That is a better convention than the manifest table this ticket imagined: the scoring key travels with the file and cannot drift from it.

**Short of the 8–12 asked for, and resolved anyway.** Four charts have already falsified two research findings and one design rule — the corpus has done the job this ticket existed to do, and the remaining axes are cheaper to add when the spike shows it needs them than to source speculatively now. The uncovered axes are listed under *Gaps* in the manifest; the spike must state its results against that list rather than claiming general coverage.

### What the corpus broke before a single line of the spike was written

Running the two resolved research tickets' recommended techniques over the new charts:

1. **Lattice recovery generalises — confirmed on new data.** Gradient-projection DFT recovered pitch on both new PNGs, square in each (40.63/40.59 and 24.91/24.96), and interior sampling on those lattices produced **exactly** 8×37 = 296 and 74×38 = 2812 Cells against the filename ground truth. It survived `8w37h`'s 38%-unique-pixel noise and `74w38h`'s scan degradation. See [Lattice recovery techniques](03-lattice-recovery.md).
2. **Flat-pixel Palette harvesting does not generalise — it fails outright on `8w37h`.** See [Palette recovery from anti-aliased, lossy charts](04-palette-recovery.md).
3. **The Non-stitch flood-fill rule is wrong for at least one real chart.** `8w37h` marks Non-stitch with an **X glyph** over an ordinary background-coloured Cell — there is no separate colour to flood and no guarantee the region touches the crop edge. See [Validate the Non-stitch flood-fill rule](07-non-stitch-rule.md).

### Three cross-cutting facts, none of them anticipated on the map

- **Number gutters are the norm, not the exception.** Three of four charts print row and/or column numbers in a margin outside the grid; the original example was the odd one out. They are simultaneously an obstacle (they must be excluded, and naive `image_width / pitch` overcounts by up to 24% because of them) and the strongest independent signal available for Cell counts and for validating a parse.
- **Charts declare their own reading direction.** Two of four number their columns **right-to-left**. This is the chart stating how it is meant to be read, and it is machine-readable — relevant to the per-row readout toggle, which currently has no default.
- **Every new chart is coarser than the original.** Pitches of 40.6, 24.9 and ~25 against 8.85. Fine pitch is the *rare* case in this corpus, not the typical one, which inverts the difficulty assumption the map was charted under.
