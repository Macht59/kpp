# 02 — Hide Blank edges

**Blocked by:** 01 — Route the client through a Chart view, Repaints into an overlay.

**Status:** resolved

**What to build:** the second of the customer's two requests, whole and
shippable on its own — including on Charts already sitting in a knitter's
library, because this needs no parser change.

A chart screenshot carries white space around the grid, and a knitter drawing a
crop rectangle on a phone catches some of it. Those Rows and Columns arrive as
real Cells: the Chart is two Rows taller than the pattern, every Row number is
off by two, and the top Row's Readout is a run of white matching no stitches.
Today the only escape is a Re-parse with a tighter crop, on a phone, with a
finger, repeatedly.

The client finds those lines and hides them, by default. A **Blank edge** is a
Row or Column at the Chart's edge whose every Cell maps to a near-white Palette
entry — near-white meaning Lab `L*` at or above 95. Trim inward from each of the
four edges until a non-blank line is met. A blank line through the *middle* of
the pattern is never touched, and a uniform black or coloured edge line is never
touched either: only white counts, deliberately, so that a solid edging round is
not silently deleted from someone's pattern.

Nothing is removed from the Chart — the Cells stay, they are simply not part of
the Chart being read. Review states what it did, in the facts line alongside the
size: *"112 × 148, 2 blank Rows hidden"*. A control beside that statement shows
them again, and that decision is kept with the Chart, so reopening does not
silently re-hide them.

The `L* >= 95` gate has no chart to fit it against — see the spec's Out of
Scope. Mark it with a `ponytail:` comment naming that it is unfitted and that
production is the first check.

- [x] Blank edge detection lives in the client, inside `view` — the parser is untouched
- [x] Leading and trailing all-near-white Rows and Columns are hidden by default
- [x] Trimming stops at the first non-blank line on each of the four edges
- [x] An all-white Row or Column in the middle of the Chart is left exactly where it is
- [x] A uniform non-white edge line is left alone
- [x] With Blank edges hidden, Row 1 is the pattern's Row 1 and its Readout is the pattern's Runs
- [x] A Repaint lands on the Cell the knitter touched, with Blank edges hidden
- [x] Review's facts line states the visible size and how many Rows and Columns are hidden
- [x] A control shows the Blank edges again, and the result is identical to the untrimmed Chart
- [x] The show/hide decision persists per Chart and survives reopen
- [x] A Chart that is entirely blank is refused with a message telling the knitter to re-crop, rather than returned empty
- [x] Tests cover: leading and trailing lines on all four edges, an interior white Row surviving, a near-white entry inside the gate hidden and one outside it kept, `trimmed: false` restoring the full Chart, Row-1 numbering, and the all-blank refusal

## Comments

**Shipped** in `feat(web): Hide the white space the crop caught`, with
`fix(web): Keep the Blank edges a fact of the parse, not of the Repaints` after it.

`blankEdges` in `web/chart.js` is client-side — the parser never learned about
this. Lightness is Lab `L*` from the entry's RGB, gated at `BLANK_ABOVE = 95`
with the `ponytail:` comment saying it is unfitted and production is the first
check. Trimming walks inward from each of the four edges and stops at the first
non-blank line, so an interior white Row is never reached, and a uniform
non-white edge is never blank whatever its colour. It repeats until nothing
shrinks: cutting white Rows can leave a Column white down its whole remaining
length.

Review's facts line says the visible size and what is hidden, with `Show them` /
`Hide them again` beside it; the decision persists per Chart with the rest of the
view state. A Chart that trims to nothing is refused with the re-crop message,
and `drawTheChart` falls back to showing the edges so the way out — Re-parse,
which lives in Review — stays on screen.

The edges are measured from the parse rather than the Repaints over it, so
tidying a speck off a white edge Column does not make that Column vanish and
renumber the Chart under the knitter.
