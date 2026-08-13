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

**Status:** ready-for-agent

- [ ] In Review, a knitter picks a Palette entry then taps a Cell to Repaint it
- [ ] In Review, dragging across several Cells Repaints the whole span in one gesture
- [ ] Repaint and pan do not compete for the same gesture
- [ ] In Knit, tapping a Run chip and picking an entry Repaints that Run
- [ ] In Knit, Repaint is confined to the Selected Row
- [ ] Repainting so two neighbouring Runs share a colour merges them in the next Readout
- [ ] Repaint tests cover: a single Cell; a span; the returned Chart being a new value rather than a mutation; neighbouring Runs merging; indices outside the Chart being rejected rather than silently clamped
