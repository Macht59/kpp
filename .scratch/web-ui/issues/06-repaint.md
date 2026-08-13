# 06 — Repaint a Cell, a span, and a Run

**What to build:** Correction is the normal flow, not a rescue — every parse is
reviewed and fixed. A knitter who spots a Cell the parser got wrong changes it,
in whichever mode they noticed it in.

This is **one** primitive with two handles, per
[ticket 09](../../chart-parsing/issues/09-correction-vocabulary.md): repaint a
selection, where the selection is a Cell or a contiguous span of Cells. It is
one ticket because it is one operation — building it twice would be testing the
same function twice.

- **In Review**: Palette-bar-first. Pick an entry, then tap a Cell or drag
  across several. Palette-bar-first is what makes span repaint natural — choose
  the colour once, drag across the wrong Run — and it keeps Repaint from
  competing with pan for the same gesture.
- **In Knit**: the Selected Row only, through the **Run chip**. Knit mode has
  no zoom, so no Cell is tappable; a chip is. Tap a chip, pick an entry. The
  correction a knitter actually makes is the one they are looking straight at,
  and forcing a mode switch for it means it does not get made.

A useful property to preserve rather than design around: a single mis-sampled
Cell mid-Run shows up as a stray one-Cell chip between two chips of the same
colour, so the Readout makes the common parse error conspicuous. Repainting it
merges it back into its neighbours on the next Readout.

Repainting to `-1` (Non-stitch) is possible in principle — it is just a
paintable value — but v1 exposes no control for it, in step with flood-fill
being out of scope.

**Blocked by:** 03 — Select a Row and read its Runs; 05 — Review a parse
against its image.

**Status:** resolved

- [x] In Review, a knitter picks a Palette entry then taps a Cell to Repaint it
- [x] In Review, dragging across several Cells Repaints the whole span in one gesture
- [x] Repaint and pan do not compete for the same gesture
- [x] In Knit, tapping a Run chip and picking an entry Repaints that Run
- [x] In Knit, Repaint is confined to the Selected Row
- [x] Repainting so two neighbouring Runs share a colour merges them in the next Readout
- [x] Repaint tests cover: a single Cell; a span; the returned Chart being a new value rather than a mutation; neighbouring Runs merging; indices outside the Chart being rejected rather than silently clamped

## Comments

`repaint(chart, {row, from, to}, entry)` in `chart.js` is the whole primitive:
one Row, a span given in either order because a knitter drags both ways, and a
single Cell as the span where `from === to`. It returns a new Chart with the
untouched Rows shared rather than copied, which is what makes a paint *drag*
cheap: every pointer move recomputes the span from the Chart as it was when the
finger went down, so a drag that doubles back leaves painted only what the
finger is currently over, with no undo stack to keep.

Indices outside the Chart throw rather than clamp, and are checked for being
whole numbers rather than merely in range — Row 1.5 is in range and is no Row,
and would otherwise come back as a Chart with nothing painted. Clamping is the
tempting one-liner and it is wrong at exactly the moment it matters: it would
paint Cells the knitter never touched and say nothing. The *pointer* is clamped,
one layer up in `cellAt`, because a finger dragged off the edge means "to the
edge" — but a pointer that goes down outside the canvas is not painted at all,
because a Chart shorter than the viewport is centred and the blank band beside
it is not the edge Cell.

The Palette bar Review already showed as its colour-count defence is the same
bar that arms the paint, so Palette-bar-first cost no new surface. Arming an
entry is what claims the one-finger gesture; tapping it again hands it back to
pan. A second finger ends the paint and becomes a pinch, so Repaint takes the
one gesture pan can spare and never the one it cannot. The hint line says which
of the two the finger currently does, because a mode the knitter cannot see is a
mode they paint by accident.

A paint drag redraws one Row of one canvas per pointer move, not the Chart: a
full redraw is 112×150 Cells twice over plus a rebuilt Readout, for one Row's
worth of difference, and the Readout is not even on screen in Review. The full
redraw happens once, when the finger lifts.

In Knit the handle is the Run chip, which needed the one thing the Readout did
not carry: where a Run starts. `runsOfRow` now returns `at` alongside `entry`
and `count`, in image orientation and so unreversed — the reading direction
reverses the *order* of the chips, never which Cells one of them stands for.
Repaint in Knit is therefore confined to the Selected Row by construction, not
by a check: the chips are that Row's, and there is no other Row to reach.

The stray one-Cell chip the spec leans on is now a closed loop, and there is a
test that states it as one: `[1,1,0,1,1]` reads as three chips, tapping the
middle one and picking its neighbours' colour gives back a single chip of five.
