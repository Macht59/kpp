# 04 — Undo the last Repaint in Knit

**Blocked by:** None.

**Status:** done

**What to build:** a way back from a Repaint made while knitting.

Tapping a chip in Knit opens the Palette and `paintRun` (`web/app.js:782`)
repaints the whole Run it stands for. A knitter who taps the wrong swatch — or
the wrong chip — has no way back except finding the original colour by eye and
repainting over it, which is guesswork once two near colours are in play.

Keep a stack of `chosenView.overlay` snapshots. Push before each `paintRun`;
Undo pops and redraws. The button sits beside the Readout and is disabled when
the stack is empty.

**Knit chip Repaints only.** Review's finger-drag paints are out of scope, as
are Separation switches, Flips and the trim toggle — this is not a general undo
system and building one for this would be building the wrong thing.

**In memory only, gone on reload.** The record is rewritten on every Row advance
(see the note at the top of `web/library.js`) and an undo history has no
business riding along on that write.

**Cleared when the Separation changes or the Blank edges are toggled.** Those
change what a Palette index means, so undoing across one could repaint a Cell to
a colour the knitter never picked. Note this barely bites in practice: the
Separation chooser is Review-only by design (`web/app.js:561`).

**Not cleared when the Selected Row moves.** Spotting a mistake one Row late is
ordinary, and a knitter who has advanced should still be able to take it back.

- [x] An Undo button sits beside the Readout in Knit
- [x] It is disabled when there is nothing to undo
- [x] Undoing restores the Cells exactly as they were before the last chip Repaint
- [x] Undoing repeatedly walks back through the whole session's chip Repaints
- [x] The stack empties on reload
- [x] The stack empties when the Separation changes or the Blank edges are toggled
- [x] The stack survives moving the Selected Row
- [x] An undone Repaint is written back to the device like any other change
