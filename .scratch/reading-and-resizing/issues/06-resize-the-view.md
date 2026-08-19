# 06 — Resize as a stage of the Chart view

**Blocked by:** None. Conflicts with 05 — see that ticket.

**Status:** ready-for-agent

**What to build:** nothing the knitter can see yet. This is the logic half of
Resize; ticket 07 puts a control on it. Split because the pipeline change is
where the correctness lives and it is testable without a browser.

Governed by [ADR-0007](../../../docs/adr/0007-resize-is-a-derived-view.md), which
should be read before this ticket.

`scale: {rows, cols}` joins `separation`, `trimmed` and `overlay` as a knitter
decision in the Chart's record, and `view()` (`web/chart.js`) grows a stage that
resamples to it. Absent or equal to the Chart's own size, nothing happens and
the view is what it is today.

**Nearest-neighbour, no interpolation.** Averaging would invent colours that are
in no Palette entry and in no knitter's yarn basket.

**After the trim, not before.** `view()` currently applies Repaints, derives the
Palette, then slices the Blank edges off last. The resample goes after that
slice, so a knitter who types "20 rows" gets twenty rows of the Chart they can
*see* rather than twenty including four blank ones. This inverts part of the
existing order — it is a change to the pipeline, not a step bolted on the end.

Because Repaints are applied at parse resolution before the resample, a Resize
is a true round trip: 40 → 20 → 40 returns Cell-for-Cell what was there,
Repaints included. That reversibility is the whole reason Resize is derived
rather than baked into a new Chart, and it is the property most worth a test.

Resizing down discards Repaints silently — a single-Cell correction has a
coin-flip chance of not surviving a halving. Accepted: nothing is lost
permanently, and warning on every downward step would fire mostly on knitters
who have made no corrections at all.

Non-stitch Cells resample like any other Cell; they carry `-1`, and
nearest-neighbour replicates it without special-casing.

`blankEdgesOf` and `countsOf` cache against `chart.cells` and are measured from
the parse, so they are unaffected — the resample happens downstream of both.

- [ ] `view()` accepts `scale: {rows, cols}` and returns a Chart of that size
- [ ] Rows and Columns resize independently
- [ ] The resample is nearest-neighbour — no colour appears that is not a Palette entry
- [ ] The resample runs after the Blank-edge trim, so the size asked for is the size returned
- [ ] Non-stitch Cells survive a resize in both directions
- [ ] A round trip down and back up returns the original Cells exactly, Repaints included
- [ ] No `scale`, or a `scale` equal to the current size, leaves the view byte-identical to today's
- [ ] A `scale` of zero or negative Rows or Columns is refused, not clamped
- [ ] Tests cover: doubling, halving, non-square scaling in each direction, the round trip, Non-stitch survival, Repaint survival across a round trip, and the interaction with `trimmed: true`
