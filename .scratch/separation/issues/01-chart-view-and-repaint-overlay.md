# 01 — Route the client through a Chart view, Repaints into an overlay

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**What to build:** nothing the knitter can see. This is the prefactor both
features in [the spec](../spec.md) sit on — "make the change easy, then make the
easy change".

Today the client reads the parsed Chart directly and a Repaint rewrites its
`cells`. Both of the customer's requests are the knitter deciding how an
already-parsed Chart is *read*, which means the Chart the client draws has to
become a derived thing rather than the stored one.

Introduce a single function in the chart module:

```
view(chart, { separation, trimmed, overlay }) -> Chart
```

It returns a Chart in exactly the shape today's readers already consume, so
`rowCount`, `colCount`, `cellsOfRow`, `runsOfRow`, `rowIndex`, `rowNumber`,
`entryLabel` and `readingDirection` keep working untouched — they simply operate
on a Chart that happens to be derived. Everything in the client that draws,
reads out, or counts goes through `view`.

In this ticket the state is inert: `separation` is always 0, `trimmed` is always
false, and the only field doing work is `overlay`. Separations arrive in ticket
03 and Blank edges in ticket 02.

`repaint` changes from returning a new Chart to returning new view state with
`overlay` updated. A Repaint has to outlive a Separation switch, and an index
into a Palette that is about to change cannot do that. Its coordinates stay the
ones the knitter sees, and its existing guards — integers, in bounds, refuse
rather than clamp — carry over unchanged.

The three view-state fields persist per Chart in the library alongside
`selected` and `reading`. The library's record already takes arbitrary fields,
so this is the client deciding to write them.

- [ ] `view(chart, state)` returns a Chart the existing chart functions consume unchanged
- [ ] Every place the client draws, reads out or counts goes through `view`, not the stored Chart
- [ ] `repaint` returns view state with `overlay` updated, not a rewritten Chart
- [ ] A Repaint's coordinates are the ones the knitter sees
- [ ] `repaint`'s existing guards still refuse a non-integer Row, an out-of-bounds span, and an unknown Palette entry — with the same messages
- [ ] A Repaint to Non-stitch is stored in the overlay like any other
- [ ] `separation`, `trimmed` and `overlay` persist per Chart and come back on reopen
- [ ] A Chart Repainted, closed and reopened shows the same Cells it did before
- [ ] The existing test suites stay green — this ticket changes no behaviour
- [ ] New tests cover the overlay round-trip through `view`, and that `runsOfRow` over a view matches what it returned over the raw Chart
