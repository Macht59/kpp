# 08 — Re-parse and start over

**What to build:** Some parses come back structurally wrong — the dimensions
are off because the crop caught a number gutter or missed a Row. That cannot be
fixed Cell by Cell; it has to be redone. A knitter who sees it in Review
adjusts the crop on the stored source image and parses again, without hunting
for the original file. And when a chart simply will not parse, they abandon it
and upload something else.

**Re-parse writes a new Chart into the library rather than overwriting the
original.** [Ticket 09](../../chart-parsing/issues/09-correction-vocabulary.md)
discards Repaints across a re-grid by design, because re-gridding changes which
Cell is which — so a knitter who has spent twenty minutes correcting Cells
could destroy that work with one tap. With a library already built, making the
operation non-destructive costs nothing, and it lets the knitter compare two
crops before deleting either.

*Start over* is the same path from a blank crop, kept as a named escape hatch.

This is the structural-tier correction from the vocabulary; the Cell-tier one
is [ticket 06](06-repaint.md). The distinction is load-bearing: structural
errors are redone, Cell errors are repainted.

**Blocked by:** 02 — Draw the crop rectangle; 05 — Review a parse against its
image; 07 — The Chart library on the device.

**Status:** ready-for-agent

- [ ] From Review, a knitter can adjust the crop against the stored source image and parse again
- [ ] Re-parse produces a **new** Chart in the library; the original is untouched
- [ ] Both Charts are distinguishable in the library so the knitter can tell which crop was better
- [ ] A knitter can delete whichever they do not want
- [ ] A knitter can abandon a parse entirely and upload a different image
- [ ] The knitter is not asked to find the original file again — the stored image is used
