# 07 — Resize a Chart in Review

**Blocked by:** 06 — Resize as a stage of the Chart view.

**Status:** ready-for-agent

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

- [ ] Rows and Columns fields sit in Review, showing the current size
- [ ] Typing a number resizes the Chart on screen without a parse or a connection
- [ ] `keep proportions` drives the other field; unchecked, the two are independent
- [ ] The size persists with the Chart and survives reopen
- [ ] The library's size line states the resized size
- [ ] Resizing back to the parsed size returns the Chart exactly, Repaints included
- [ ] Selecting returns to Row 1 after a Resize
- [ ] A `ponytail:` comment marks the missing size cap and names the failure it allows
