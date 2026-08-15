# 02 — Hide Blank edges

**Blocked by:** 01 — Route the client through a Chart view, Repaints into an overlay.

**Status:** ready-for-agent

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

- [ ] Blank edge detection lives in the client, inside `view` — the parser is untouched
- [ ] Leading and trailing all-near-white Rows and Columns are hidden by default
- [ ] Trimming stops at the first non-blank line on each of the four edges
- [ ] An all-white Row or Column in the middle of the Chart is left exactly where it is
- [ ] A uniform non-white edge line is left alone
- [ ] With Blank edges hidden, Row 1 is the pattern's Row 1 and its Readout is the pattern's Runs
- [ ] A Repaint lands on the Cell the knitter touched, with Blank edges hidden
- [ ] Review's facts line states the visible size and how many Rows and Columns are hidden
- [ ] A control shows the Blank edges again, and the result is identical to the untrimmed Chart
- [ ] The show/hide decision persists per Chart and survives reopen
- [ ] A Chart that is entirely blank is refused with a message telling the knitter to re-crop, rather than returned empty
- [ ] Tests cover: leading and trailing lines on all four edges, an interior white Row surviving, a near-white entry inside the gate hidden and one outside it kept, `trimmed: false` restoring the full Chart, Row-1 numbering, and the all-blank refusal
