# 02 — Merge two colours in Review

**Blocked by:** 01

**Status:** resolved

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
them gives. What a Merge has done is written onto the marked button rather than
into the answers themselves — the answers are what the list is rebuilt against,
and a suffix that moves from one button to another as the knitter switches would
rebuild the list under their finger at every tap.

**Persistence.** `merges` joins the view state written by `keepThisChart` and
`drawRow`, which is the whole of it: the library row states a Chart's size, and
by this feature's own rule a Merge cannot change one — Blank edges are measured
before Merges and the resample is downstream of neither. So `library.stored()`'s
field list is left alone.

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

**Shipped** in `feat(web): Call two colours one yarn`, reviewed and corrected in
`fix(web): Keep the knitter's place in the Separation list under a Merge`. The
Colorway swatch is a button opening `#merge-palette`; `#unmerge` takes back the last Merge of the session
off its own stack. `entriesOf` filters the holes out of all three pickers and
feeds the colour count; `separationChoices` labels the marked answer.

Two decisions taken while building, neither in the ticket:

- The Merge picker's swatches are labelled *"Merge Colour A with Colour B"*
  rather than by the colour alone. A strip of swatches called "Colour B" says
  nothing to anyone who cannot see it, and this is the one picker where both
  colours are halves of the same statement.
- `drawFacts` rebuilds the Colorway list *before* the pickers, so the Merge
  picker marks a swatch that exists rather than one about to be replaced.

**Reviewed** at `high`, four findings, all four fixed:

- The Separation chooser's `(N merged)` suffix rode inside the labels, so with a
  Merge in force the label array changed on every switch and the list was rebuilt
  under the knitter's finger — the focus loss the rebuild guard exists to
  prevent. `separationChoices` now returns `merged` beside the labels, the guard
  compares `dataset.answer`, and the words are written onto the marked button.
- A Chart with one colour on screen marked its Colorway swatch `aria-expanded`
  over an empty strip, outlining it red with nothing beneath. Marked from the
  picker now, not from the tap.
- With the picker shut, `drawMerging` was filling it with live buttons behind
  `hidden` — churn on every keystroke in a Colorway box, and a Merge against
  `null` waiting for anything that ever showed the element. Emptied instead.
- `merges` in `library.stored()`'s field list changed nothing the row states.
  Dropped.
