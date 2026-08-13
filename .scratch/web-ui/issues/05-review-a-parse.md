# 05 — Review a parse against its image

**What to build:** Every parse is Reviewed before it is trusted — there is no
programmatic acceptance bar
([ticket 02](../../chart-parsing/issues/02-acceptance-bar.md)), so the knitter
is the bar. A fresh parse opens in Review, where they pinch and pan around the
whole Chart, toggle to the image it came from, compare the two, and decide
whether to knit from it or redo it.

Review is a survey, so its navigation model is the opposite of Knit's: free pan
and pinch over the whole Chart at any zoom, no Row strip, no Row-at-a-time
movement. This ticket adds the mode switch, since this is the first point at
which a second mode exists.

Three signals are on screen, because they are three different problems:

- **Dimensions and Palette count**, shown plainly. These are the errors that
  cannot be corrected, only redone
  ([ticket 05](../../chart-parsing/issues/05-extraction-spike.md)), and Review
  is the one moment the knitter is comparing against the original rather than
  knitting. The Palette count in particular is the only defence against the
  silent failure the README records — rare yarns merging into their
  neighbours, so the nine-colour corpus chart returns seven, with no error and
  no low confidence.
- **A low `confidence.chart` warning**, meaning a Chart came back but the crop
  may be off by a Cell.
- **Hard parser failures**, which never reach Review at all — ticket 01 keeps
  the knitter on the crop step for those.

**Blocked by:** 01 — Parse a whole image and see the Chart.

**Status:** resolved

- [x] A fresh parse opens in Review
- [x] A knitter can pinch to zoom and pan freely around the whole Chart
- [x] A knitter can toggle between the Chart and the source image it was parsed from
- [x] The Chart's dimensions are shown
- [x] The number of Palette entries is shown, plainly enough that a knitter who knows their pattern uses nine colours notices seven
- [x] A low `confidence.chart` shows a warning that the crop may be off by a Cell
- [x] A knitter can leave Review and start knitting
- [x] A knitter can return to Review from Knit at any time
- [x] Review has no Row strip and Knit has no zoom — the two navigation models stay distinct

## Comments

A `#review` section joins `#knit`, and a single mode switch above both moves
between them: *Knit this chart* and *Review this parse*. Only one section is on
screen at a time, so the two navigation models cannot bleed into each other —
Review has no Row strip because the Row strip lives in Knit's DOM, and Knit has
no zoom because the pan and pinch handlers are bound to Review's viewport.

Pan and pinch are one gesture, not two. Keeping whatever the fingers landed on
under the fingers is the same sum for a one-finger drag and a two-finger pinch,
so both fall out of one formula, with the pinch contributing a scale factor of
1 while only one finger is down. Lifting one finger of a pinch re-bases the
grip rather than jumping the Chart across the screen, and the pan is clamped to
the viewport: at any zoom the Chart still covers it, because panning off into
blank space is how a knitter gets lost.

The low-`confidence.chart` threshold was fitted to measurements rather than
guessed, and the measurement changed the answer. The four corpus crops — drawn
a few px off by hand, as a knitter's would be — score **0.06, 0.26, 0.31 and
0.8**, and every one of them parsed to the right dimensions. A warning at
half-confidence, the obvious threshold and the one the parser uses for per-Cell
doubt, would therefore have cried wolf on three parses in four. It is set at
0.2, reserving the banner for the coin-flip end, and is marked `ponytail:` in
`chart.js` as a guess fitted to four crops.

That leaves the Chart's size and its colour count as the real defence, which is
what [ticket 05 of the parsing map](../../chart-parsing/issues/05-extraction-spike.md)
already said: those are the errors that cannot be corrected, only parsed again.
Both are rendered large, with the Palette drawn as swatches beside the count so
seven where the pattern says nine is something the eye catches rather than
something the knitter has to think to check.

Three things came out of review rather than out of the build:

- **The zoom floor is the whole Chart, not fit-width.** The narrowest corpus
  chart is eight Cells across and thirty-seven tall, so fit-width shows a
  sliver of it and no amount of pinching out gets further. Review opens at the
  zoom that fits the Chart in the viewport and stops there on the way out.
- **The image is shown through a window the shape of the crop**, scaled so the
  crop fills it, using `source.crop` and `source.image_width` from the
  contract. Toggling between two differently framed pictures is not the
  comparison Review exists for. Deskew is not undone: `skew_deg` is a fraction
  of a degree across the corpus.
- **Construction and the starting Reading direction moved out of Knit** into a
  block belonging to neither mode, because the spec has them "set at the Review
  step and changeable in Knit" and ticket 04 could only put them where a Chart
  was on screen.

The Chart's size is stated from `cells` rather than from the contract's
`dimensions`. The two agree, and are declared separately as an integrity check,
but only one of them is the Chart that gets knitted.
