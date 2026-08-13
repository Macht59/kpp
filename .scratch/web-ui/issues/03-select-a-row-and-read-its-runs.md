# 03 — Select a Row and read its Runs

**What to build:** The reason the app exists. A knitter Selects a Row and is
told what to knit — "3 white, 4 yellow, 5 brown, 3 white" — instead of counting
squares. They advance a Row at a time with a button they can hit without
looking, and jump back to any Row when they lose their place.

Knit mode is three stacked full-width bands, **no zoom in any of them**: a slim
whole-Chart overview with the Selected Row marked, the Selected Row drawn as
colour bands, and the Readout. Next and Previous Row buttons sit under the
Readout. Tapping a Row in the overview jumps to it.

**The Readout is the primary surface, not the Chart.** A phone viewport is
~360 usable CSS px; the corpus's widest chart is 112 Cells, so fit-width gives
3.2 px per Cell — a fine picture, far under the 44pt/48dp touch minimum. A
*zoomed* Row strip does not fix this, because it is also 360 px wide: it is only
zoomed if it scrolls horizontally, and at a legible 12 px per Cell that is 3.7
screen-widths per Row, 150 times over. A knitter does not read Cells, they knit
**Runs** — and 5–15 chips is vertical scroll, which is free. The layout must
span 8 to 112 columns; the corpus's narrowest chart is 8 Cells wide.

This ticket introduces the **chart-logic module** — pure functions over the
Chart contract, no DOM, no canvas, no storage — and its tests under Node's
built-in test runner. Node is a test-time requirement only, never a build step.

Reading direction is fixed left-to-right here; [ticket 04](04-construction-and-reading-direction.md)
makes it real.

**Row numbering runs bottom to top.** Knitting charts are worked from the
bottom Row upward, but `cells[0][0]` is top-left, so displayed Row 1 is the
*last* array Row and *Next Row* moves **up** the image. This is a convention
assumed while writing the spec, not a decision the knitter confirmed — check it
before building on it, because getting it backwards makes the whole app read
wrong while looking entirely plausible. It is one inversion, applied once in
the chart-logic module so nothing else in the client thinks about it.

**Blocked by:** 01 — Parse a whole image and see the Chart.

**Status:** resolved

- [x] A knitter can Select a Row and see its Readout
- [x] Each Run is a chip with a colour swatch and a Cell count, sized to be tapped, not merely read
- [x] Chips carry a positional label ("Colour A") since the service leaves Palette `name` null, and honour `name` when it is set
- [x] The Row number and the Row's total Cell count are shown
- [x] Non-stitch Runs are omitted from the Readout entirely
- [x] The Selected Row is drawn full width as colour bands
- [x] A slim whole-Chart overview shows where the Selected Row sits
- [x] Tapping a Row in the overview jumps to it
- [x] Next and Previous Row buttons advance and retreat one Row
- [x] Row numbering is bottom-to-top, confirmed against the knitter before it is relied on
- [ ] Legible and usable on both the 8-Cell-wide and 112-Cell-wide corpus charts
- [x] Chart logic lives in a module with no DOM, canvas or storage dependency
- [x] Chart-logic tests run under Node's built-in test runner with no package manifest, dependency or bundler
- [x] Runs tests cover: consecutive same-entry Cells collapsing with a count; Non-stitch Cells **splitting** Runs rather than joining across them; a single-colour Row as one Run; an alternating Row as one Run per Cell; the Row-number inversion

## Comments

Built as `web/chart.js` (the chart-logic module) with `web/chart.test.js` under
`node --test "web/*.test.js"`, plus the Knit bands in `web/index.html` and
`web/app.js`. A fresh parse now lands in Knit at Row 1; Review is ticket 05.

Row numbering was put to the knitter before anything relied on it and the
spec's assumption was confirmed: displayed Row 1 is the bottom of the image,
the last array Row, and *Next Row* moves up. It is one function, `rowIndex`,
with `rowNumber` reading it back for the overview tap.

Three decisions worth recording:

- **Both Chart canvases hold one canvas pixel per Cell and are stretched by
  CSS.** The overview and the Row band are full width at 8 columns and at 112
  with no fit arithmetic in JS, and the deliberate aspect squash is what makes
  a 150-Row overview slim. This replaced ticket 01's fit-to-canvas sizing,
  which had no caller left once no band shows the Chart at a chosen zoom.
- **The Selected-Row marker is a DOM element over the overview, not drawn into
  the bitmap.** One Row of a 150-Row chart is 0.64 px of a 6 rem overview, so a
  marker drawn in the bitmap would be invisible on the tallest corpus chart;
  the element carries `min-height: 3px`.
- **Non-stitch splits Runs by closing the open Run rather than by comparing
  neighbours.** The Readout must not join equal entries across a gap — 1 Cell,
  Non-stitch, 1 Cell of the same colour is two Runs of 1, never one Run of 2,
  or the knitter knits stitches that are not there.

Measured on the corpus, chips per Row: `112w150h` min 1, median 7, max 24;
`8w37h` min 1, median 4, max 8. The spec's 5–15 estimate holds, and the worst
Row is 24 chips of free vertical scroll.

**One box left unticked:** legibility on the 8-Cell and 112-Cell charts is
checked by eye, and the browser was not drivable from the implementing session.
The headless numbers above are the arithmetic half of it only.
