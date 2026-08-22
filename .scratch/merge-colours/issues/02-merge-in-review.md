# 02 — Merge two colours in Review

**Blocked by:** 01

**Status:** claimed

The screen for [ticket 01](01-merge-in-the-view.md)'s machinery. Review only: a
Merge rewrites every Readout in the Chart, and a knitter mid-Row must not have
the counts change under them. *Review this parse* is the way back, as it is for
the Separation chooser.

**The gesture is Knit's chip.** Tap the swatch in the **Colorway list** and a
strip of the other surviving entries opens beneath the list; tap one and the two
are Merged. Tap the open swatch again to shut it. Tap a third to add it to the
group. The Colorway swatch is an inert `span` today, so nothing else claims the
tap — and the Palette above it keeps tap-to-arm for Repaint, untouched.

**Undo.** One control in Review, taking back the last Merge of this session. Its
own stack, not the Repaint one: it is reached from another mode and is kept
across a Separation switch and a Resize, because a Merge survives both. Not
persisted — a Merge is permanent once the Chart is reopened, accepted in
[ADR-0008](../../../docs/adr/0008-a-merge-is-the-knitters-own-merge-map.md).

**Holes are filtered.** Every list that shows a Palette — `palette` and
`colorway-list` in Review, `chip-palette` in Knit — shows the entries without an
`into`, at their own indices. The facts line's colour count is the same count,
so it moves as a Merge is made.

**The Separation chooser** marks *"12 colours (11 merged)"* while a Merge is in
force; the other answers keep the parse's own counts, which is what switching to
them gives.

**Persistence.** `merges` joins the view state written by `keepThisChart` and
`drawRow`, and `library.stored()`'s field list, so the library row states the
size and colours of the Chart the knitter is reading.

- [x] Tapping a Colorway swatch opens a strip of the other entries; tapping one Merges the two
- [x] Tapping the open swatch shuts the strip; tapping another swatch moves it
- [x] A third tap adds a third entry to the same group
- [x] The strip never offers the entry it was opened from, and never a hole
- [x] Merged entries are one row in the Colorway list, one swatch in both Palettes, one Run in the Readout, one colour on the Chart and on the overview
- [x] The Colorway typed against the surviving entry is the name shown after a Merge
- [x] The facts line's colour count is the count on screen
- [x] The marked Separation reads *"12 colours (11 merged)"*; the others are unchanged
- [x] Undo takes back the last Merge, and survives a Separation switch and a Resize
- [x] Undo is disabled when there is no Merge of this session to take back
- [x] An entry armed for Repaint that a Merge swallows re-points to the entry it was Merged into
- [x] Nothing appears for a Chart with one entry on screen
- [x] A Merge is written to the device and is in force on reopen, in Knit as well as Review
- [x] A stored record with no `merges` opens exactly as it does today
- [x] `npm test` green

## Comments

Built in the working tree, not yet committed. The Colorway swatch is a button
opening `#merge-palette`; `#unmerge` takes back the last Merge of the session
off its own stack. `entriesOf` filters the holes out of all three pickers and
feeds the colour count; `separationChoices` labels the marked answer.

Two decisions taken while building, neither in the ticket:

- The Merge picker's swatches are labelled *"Merge Colour A with Colour B"*
  rather than by the colour alone. A strip of swatches called "Colour B" says
  nothing to anyone who cannot see it, and this is the one picker where both
  colours are halves of the same statement.
- `drawFacts` rebuilds the Colorway list *before* the pickers, so the Merge
  picker marks a swatch that exists rather than one about to be replaced.
