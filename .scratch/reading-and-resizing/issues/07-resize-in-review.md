# 07 — Resize a Chart in Review

**Blocked by:** 06 — Resize as a stage of the Chart view.

**Status:** done

**What to build:** the control the knitter reaches for when a chart was drawn
for someone else's gauge.

Two number inputs — rows and columns — and a `keep proportions` checkbox that
drives the other field when one is typed into. Not a percentage slider: a
knitter resizing for gauge is thinking "I need 140 stitches wide", which is a
number.

**Review only**, beside the Separation chooser and the blank-edge toggle, for
the same reason `drawSeparations` is Review-only (`web/app.js:561`): a knitter
mid Row must not have the Chart change size under them. Re-parse and Start over
already live there, so "change what this Chart is" stays in one place.

The fields open showing the current size, so a knitter can always read what they
have. The Chart redraws on change, through `adopt` (`web/app.js:595`) like every
other decision about how the Chart is read — which already handles the failed
derivation, the error message, the frame and the redraw.

Two behaviours were chosen against my recommendation and are built as asked;
both are recorded in [ADR-0007](../../../docs/adr/0007-resize-is-a-derived-view.md):

- **Selecting returns to Row 1** after a Resize, rather than tracking the
  knitter's place proportionally through `rowAfterAdopting`. It is the one place
  in the app that discards the Selected Row on purpose.
- **No upper bound.** `drawCells` fills one rect per Cell and a paint drag
  re-derives on every pointer move, so a large enough number will make the app
  stop responding with no way out but closing it. Ship uncapped, with a
  `ponytail:` comment naming the ceiling and that production is where it gets
  fitted.

The library's size line needs no change: `sized` (`web/app.js:427`) already
measures through the view, so a resized Chart states its resized size.

- [x] Rows and Columns fields sit in Review, showing the current size
- [x] Typing a number resizes the Chart on screen without a parse or a connection
- [x] `keep proportions` drives the other field; unchecked, the two are independent
- [x] The size persists with the Chart and survives reopen
- [x] The library's size line states the resized size
- [x] Resizing back to the parsed size returns the Chart exactly, Repaints included
- [x] Selecting returns to Row 1 after a Resize
- [x] A `ponytail:` comment marks the missing size cap and names the failure it allows

## Comments

**Found while building 06 — a Repaint on a resized Chart lands on the wrong
Cell.** ADR-0007 lists what reads the resized view unchanged — `measured`,
`runsOfRow`, the library's size line, `frameTheImage` — and `repaint` is not on
it, but it takes the same view. It maps the knitter's finger back to the parse
through `offset(shown)` and `rowIndex(shown, row)` (`web/chart.js`), neither of
which knows about the resample: on a Chart read at twice its size, Row 8 maps to
array Row 0 and Column 7 to a Column the parse does not have, so the overlay key
written is either the wrong Cell or one nothing ever reads.

Harmless while Resize is only a `view()` stage, because nothing sets `scale`.
The moment this ticket puts the control on screen a knitter can Resize and then
Repaint, so it wants either a fix here — invert the nearest-neighbour mapping in
`repaint`, the way `offset` already inverts the trim — or its own ticket taken
before this one ships.

**Built.** The control sits in Review under the Blank-edge toggle: two number
boxes filled from the Chart on screen, a `keep proportions` checkbox that drives
the other box from the parsed size, and a `change` listener that goes through
`adopt`. `scale` joins the other decisions in `keptView`, in the record `persist`
writes, and in the fields `stored` hands the library list, so a resized Chart
states its resized size on the shelf and opens at that size.

The Repaint bug found while building 06 was fixed here rather than taken as its
own ticket: `repaint` now maps the knitter's Row and Columns back through the
resample — `nearest`, lifted out of `resampled` and read backwards — before it
maps them back through the Blank edges. A Chart read larger has several Cells
standing for one of the parse's, so painting any of them paints all of them;
there is no finer Cell to record the correction against.

**Review fixes.** Four things a review caught, all of them the Resize control's
own: the Blank-edge toggle renumbered the Selected Row on a resized Chart, where
the resample fills the same Rows and nothing is renumbered (`rowAfterAdopting`
now takes the scale); re-typing the size already on screen counted as a Resize
and sent the knitter to Row 1 (an unresized Chart is read at its own size, and
that is what the comparison is against now); a refused size stayed in the box, so
`change` never fired again on a retype (the boxes go back to the Chart on
screen); and a paint drag on a Chart read larger left the Rows either side of the
finger stale, because one parse Cell is several shown Rows (the canvas is redrawn
whole while a scale is set, marked `ponytail:` with the cheaper fix).

Two the review raised are older than this ticket and are not taken here: Undo
does not know about Review paint drags (04's), and a Colorway keystroke costs a
full redraw and a record write (02's). One is accepted as written: `blankWords`
counts the Blank edges in the parse's Rows, which is what the crop caught,
whatever size the Chart is read at.
