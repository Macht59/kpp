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

**Status:** ready-for-agent

- [ ] A fresh parse opens in Review
- [ ] A knitter can pinch to zoom and pan freely around the whole Chart
- [ ] A knitter can toggle between the Chart and the source image it was parsed from
- [ ] The Chart's dimensions are shown
- [ ] The number of Palette entries is shown, plainly enough that a knitter who knows their pattern uses nine colours notices seven
- [ ] A low `confidence.chart` shows a warning that the crop may be off by a Cell
- [ ] A knitter can leave Review and start knitting
- [ ] A knitter can return to Review from Knit at any time
- [ ] Review has no Row strip and Knit has no zoom — the two navigation models stay distinct
