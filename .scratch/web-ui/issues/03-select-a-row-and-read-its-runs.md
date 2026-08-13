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

**Status:** ready-for-agent

- [ ] A knitter can Select a Row and see its Readout
- [ ] Each Run is a chip with a colour swatch and a Cell count, sized to be tapped, not merely read
- [ ] Chips carry a positional label ("Colour A") since the service leaves Palette `name` null, and honour `name` when it is set
- [ ] The Row number and the Row's total Cell count are shown
- [ ] Non-stitch Runs are omitted from the Readout entirely
- [ ] The Selected Row is drawn full width as colour bands
- [ ] A slim whole-Chart overview shows where the Selected Row sits
- [ ] Tapping a Row in the overview jumps to it
- [ ] Next and Previous Row buttons advance and retreat one Row
- [ ] Row numbering is bottom-to-top, confirmed against the knitter before it is relied on
- [ ] Legible and usable on both the 8-Cell-wide and 112-Cell-wide corpus charts
- [ ] Chart logic lives in a module with no DOM, canvas or storage dependency
- [ ] Chart-logic tests run under Node's built-in test runner with no package manifest, dependency or bundler
- [ ] Runs tests cover: consecutive same-entry Cells collapsing with a count; Non-stitch Cells **splitting** Runs rather than joining across them; a single-colour Row as one Run; an alternating Row as one Run per Cell; the Row-number inversion
