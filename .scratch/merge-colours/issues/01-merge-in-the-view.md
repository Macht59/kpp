# 01 — Compose the knitter's Merge into the view

**Blocked by:** None — can start immediately.

**Status:** resolved

Nothing the knitter can see. This is the whole of the Merge machinery, in
`web/chart.js`, behind a fifth field of the view state — the screen comes in
[ticket 02](02-merge-in-review.md).

`view(chart, { separation, trimmed, overlay, names, scale, merges })`.

`merges` is a sparse map over **finest** Palette entries, finest entry → the
entry its Merge group is rooted at, stored flat so every member points at the
same root. The same shape a Separation's `merge` is, one level down. See
[ADR-0008](../../../docs/adr/0008-a-merge-is-the-knitters-own-merge-map.md) for
why it is recorded at the finest Palette and why the Palette does not renumber.

Composition, in this order:

1. The Separation's `merge`, as today.
2. **Blank edges, unchanged** — measured against the Separation's own Palette,
   before Merges, cache keyed by Separation index alone. A Merge must not move
   a hidden line or a Row number.
3. Coarse entries sharing a finest Merge group are united. Each class is read as
   the entry of its **most-used** member — most Cells in the parse, ties to the
   lowest index — and the class's other entries become **holes**.
4. The Palette is the Separation's, at unchanged length: a surviving entry is
   the Cell-count-weighted average of every finest entry in its class, which is
   what `paletteOf` already does for the parser's merges; a hole keeps what it
   held and gains an `into` field naming the entry it is read as.
5. `named` over that, keyed as today — so the surviving slot keeps its own
   Colorway and a swallowed one is still there if the Merge is dropped.

`read` becomes `into[merge[cell]]`. Nothing downstream changes: `runsOfRow`,
`rowCount`, `cellsOfRow`, `entryLabel` and the resample all operate on the view
and never learn a Merge exists.

`repaint` searches the **class** rather than the Separation's entry for the
most-used finest entry to store, so painting a Merged colour stores the shade it
mostly was. Repainting to a hole is refused by the existing message, because no
finest entry is read as one.

- [x] `view` with no `merges` returns exactly what it returns today
- [x] Merging two entries: Palette length unchanged, class on the most-used member's slot, other slot carries `into`, surviving colour is the Cell-count-weighted average of the class's finest entries
- [x] `runsOfRow` joins adjacent Runs of Merged entries into one, both Reading directions
- [x] A Merge is in force at every Separation, and Merging two coarse entries collapses the union of the finest entries behind them
- [x] A third entry Merged into a group joins it; Merging is idempotent and order-independent
- [x] Colorway names: survivor keeps its own, the swallowed one returns when the Merge is dropped
- [x] Blank edges and Row numbers are identical before and after a Merge, including a Merge whose colour crosses the near-white gate
- [x] A Repaint to a Merged entry stores the class's most-used finest entry and survives a Separation switch
- [x] A Repaint to a hole is refused with the existing message
- [x] A Merge survives a Resize; a Resize down and back up is unchanged by it
- [x] A v1 Chart accepts a Merge over its single Separation
- [x] `npm test` green

## Comments

**Shipped** in `feat(web): Call two colours one yarn`. `mergedInto`,
`mergedPalette` and `entriesOf` in `web/chart.js`, composed by `view` and read by
`repaint`; `mergeEntries` beside `repaint` as the primitive the screen calls.

One thing the ticket did not say and the tests now do: a Merged entry carries no
`name` out of the parse, the same as an entry the parser's own merging produced —
several colours averaged have no one name. The knitter's Colorway is unaffected,
because it is keyed by slot and lives in the view state.
