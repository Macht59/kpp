# 01 — Reproduce the Selected Row resetting to 1

**Blocked by:** None.

**Status:** ready-for-agent

**What to build:** a failing test first. This is the only defect in
[the spec](../spec.md) and the only item whose cause is still a hypothesis —
do not fix anything until a test reproduces it.

A knitter reported that after advancing several Rows, killing Safari on iOS and
reopening it, the Chart opened at Row 1. It has not reproduced on demand. The
Selected Row is written on every `drawRow` (`web/app.js:749` → `persist`,
`web/app.js:351`) and read back on open (`web/app.js:466`), and it survives a
Review↔Knit switch and a Chart switch — all of that was checked by hand and
works.

The prime suspect is `openingRow` (`web/app.js:334`):

```js
if (kept.trimmed !== undefined || !state.trimmed) return kept.selected;
return Math.max(kept.selected - view(kept.chart, state).blank.bottom, 1);
```

That branch exists for records written before Blank edges could be hidden: they
numbered the Row against the whole Chart, so reopening under the new default
has to shift it down by the blank Rows beneath. But when `blank.bottom` is at
least `kept.selected`, the `Math.max` clamps to **1**. The reopen then writes
`trimmed`, so the second open takes the first branch and behaves — which is
exactly the "happened once, cannot repeat it" shape of the report.

Write the reproduction against `openingRow`'s logic, not against Safari. The
fix, if the hypothesis holds, is that a legacy record whose shift would take the
Row below 1 should keep the Row it had rather than being clamped — a knitter who
was on Row 3 was on the pattern's Row 3, and a shift that says otherwise is
wrong about the record, not about the knitter.

Then, separately and regardless of the outcome: flush the record on `pagehide`.
`persist()` is fire-and-forget and the app's only lifecycle listener is the
`visibilitychange` handler that checks for a new service worker
(`web/app.js:1127`). iOS suspends a backgrounded page, so the last write can die
in flight. This cannot produce a reset to 1 on its own — it loses one Row
change, not all of them — so it is a second fix, not the fix.

- [ ] A test reproduces a Selected Row of 1 coming back from `openingRow` for a legacy record, before any change
- [ ] A legacy record whose blank-Row shift would go below Row 1 keeps its stored Row
- [ ] A legacy record whose shift lands at or above Row 1 still shifts, as it does today
- [ ] A record that already has `trimmed` is untouched by any of this
- [ ] The record is flushed on `pagehide`
- [ ] If the hypothesis does *not* reproduce, say so in the comments and re-open the hunt rather than shipping a speculative fix
