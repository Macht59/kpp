# 05 — Flat doubled: two Worked rows per Row

**Blocked by:** None. Conflicts with 06 — both rewrite parts of `drawRow`, so
take them in sequence rather than in parallel.

**Status:** ready-for-agent

**What to build:** a third **Construction**, for patterns worked out following
the Chart and back repeating the previous row off the work.

The customer first asked for this as "number the rows 1, 3, 5" — a display-only
setting. It is not display-only, and grilling turned it into something better:
it is a fact about how the garment is knitted, so it belongs in Construction
beside *Flat* and *In the round* rather than as a fourth control a knitter could
set into contradiction with them.

Add to `#construction` (`web/index.html:231`):

```html
<option value="flat doubled">Flat, doubled — each row is worked twice, out and back</option>
```

Choosing it changes three things, together:

**Reading direction stops alternating.** `readingDirection` (`web/chart.js:26`)
alternates on Flat because the work is turned. Under Flat doubled the work is
still turned, but the way back is knitted off the previous row, not off the
Chart — so the Chart is only ever read on the way out and the direction holds,
as it does In the round. One extra branch. Flip still works, for the knitter
who has slipped.

**Every Row is two Worked rows.** `#row-label` reads `Rows 5 and 6 of 40` for
Chart Row 3 of a 20-Row Chart: Row *n* is Worked rows `2n-1` and `2n`, and the
total is `2 × rowCount`. Under the other two Constructions the label is
unchanged.

**The Readout doubles.** Two lists, stacked, each a full Readout with its own
arrow bar and its own `Row 5` / `Row 6` heading. The second is the first
reversed, under the opposite Reading direction — the same stitches worked back.
Both are live Repaint handles: they stand for the same Cells, and `run.at` is in
unreversed image orientation (`web/chart.js:104`), so the reversed list hands
`paintRun` identical coordinates with no extra work. Repainting from either
updates both, because they are one Row.

One colour band and one Chart marker, not two — the marker marks a Chart Row and
there is exactly one of those, and a mirrored second band tells the eye nothing
the reversed chip list has not already said.

The Chart does not change. `rowCount` stays 20, Previous and Next still step one
Chart Row, and tapping a Row in the overview still selects a Chart Row.

The Construction is already persisted per Chart in `reading` (`web/app.js:354`),
so the new value rides along with no storage change. A record holding one of the
two old values keeps behaving exactly as it does today.

- [ ] `Flat, doubled` is a third option on the Construction control
- [ ] Under it, Reading direction is the same for every Row
- [ ] Flip still overrides one Row's direction under it
- [ ] `#row-label` reads `Rows 5 and 6 of 40` for Chart Row 3 of a 20-Row Chart
- [ ] Two Readouts are shown, the second the first reversed, each with its own arrow bar and heading
- [ ] A chip tap in either Readout repaints the same Cells and both lists update
- [ ] One colour band and one marker
- [ ] `rowCount`, Previous/Next and overview tapping are unchanged
- [ ] The other two Constructions behave exactly as before — one Readout, one Row number, alternation intact for Flat
- [ ] The choice persists with the Chart
- [ ] Tests cover: `readingDirection` under the new Construction with and without a Flip, the Worked-row label arithmetic at Row 1, a middle Row and the last Row, and the second Readout being the first reversed
