# 04 — Construction and automatic reading direction

**What to build:** A knitter tells the app whether the garment is knitted flat
or in the round, and from then on the Readout reads the right way round by
itself. Flat turns the work every Row, so the direction alternates as they
advance; in the round never turns, so it holds. When the alternation slips —
they frogged a Row, or started on the wrong side — they flip a single Row by
hand without disturbing the pattern.

Getting this wrong means knitting a Row backwards, so the current direction is
shown unmistakably rather than implied.

Both **Construction** and the starting **Reading direction** are client-side
and per-Chart. The service cannot supply them: `parse_chart` deliberately omits
`reading_direction_default`, because the gutter numbers it would be read from
sit outside the knitter's crop.

Reading direction affects the Readout only. It is **never** written into
`cells` — the stored Chart is orientation-free by contract.

Defaults are `flat` and right-to-left, set at Review and changeable in Knit.
Right-to-left matches both the knitting convention and the corpus, where two of
four charts number that way. **Flat is the weaker half of that guess** —
stranded colorwork is often worked in the round — so treat it as a default
worth revisiting, not a finding.

**Blocked by:** 03 — Select a Row and read its Runs.

**Status:** resolved

- [x] A knitter can set a Chart's Construction to flat or in the round
- [x] A knitter can set the starting Reading direction
- [x] Under flat, direction alternates as the knitter advances or retreats a Row
- [x] Under in the round, direction is the same on every Row
- [x] A knitter can override the direction of a single Row, and the override wins over the Construction
- [x] The current direction is shown unmistakably on the Readout
- [x] The Readout's Runs appear in the direction being read
- [x] `cells` is never rewritten by a direction change
- [x] Direction tests cover: alternation under flat; constancy under in the round; a per-Row override beating both; retreating a Row giving the same direction as arriving at it forwards

## Comments

`readingDirection({construction, start, flips}, row)` joins the chart-logic
module, and `runsOfRow` takes the direction and reverses the Runs for a Row read
right to left. In the client: a Construction select, a *Row 1 reads* select, a
*Flip this row* button, and a direction bar between the Row band and the
Readout. The Chart itself is untouched — the only thing reading direction does
is reverse a list of Runs on the way to the chips.

The per-Row override is called a **Flip** and is now in `CONTEXT.md`. It is the
one genuinely new concept here, and it had four names across the code before it
had one in the glossary.

Three decisions worth recording:

- **Direction is a function of the Row number, never of how the knitter got
  there.** Next and Previous only move `selected`; nothing toggles. That is what
  makes retreating to a Row read the same as arriving at it forwards, and it is
  why the test states both walks against one hand-written sequence — a toggling
  implementation passes the climb and fails the descent.
- **`runsOfRow` refuses a missing direction rather than defaulting.** A default
  would silently read a Row one way round, which is exactly the mistake this
  ticket exists to prevent, and the wrong-way Readout looks entirely plausible.
- **A Flip survives a change of Construction.** The knitter set that Row by hand
  to correct the alternation; a change of Construction is not evidence they
  changed their mind about it. *Flip this row* on a Flipped Row hands it back.

**A tension the spec settles but does not remove:** the chips reverse, the Row
band does not — "Reading direction affects the Readout only. It is never written
into `cells`." So on a right-to-left Row the chips run opposite to the picture
above them, and story 26's at-a-glance check is only true if the knitter reads
the band in the arrow's direction. The bar sits directly under the band for that
reason. Mirroring the band render is one CSS transform if it turns out to read
wrong in the hand — it does not touch `cells` — but it was not taken here.

Checked by eye at 390×844 on both corpus extremes, driving the real page in
headless Chrome over CDP. `8w37h` and `112w150h` both: Row 1 right to left, Row
2 flipping to left to right under flat with the chips reversing to match
(`18 Colour B, 1 Colour D, 50 Colour G, 43 Colour B` becoming
`43, 50, 1, 18`), *Flip this row* winning and labelling itself "flipped by
hand", Previous and Next returning to the same directions, in the round holding
one direction across Rows, and the starting-direction select flipping every
unflipped Row at once. No horizontal scroll in any state.
