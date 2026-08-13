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

**Status:** ready-for-agent

- [ ] A knitter can set a Chart's Construction to flat or in the round
- [ ] A knitter can set the starting Reading direction
- [ ] Under flat, direction alternates as the knitter advances or retreats a Row
- [ ] Under in the round, direction is the same on every Row
- [ ] A knitter can override the direction of a single Row, and the override wins over the Construction
- [ ] The current direction is shown unmistakably on the Readout
- [ ] The Readout's Runs appear in the direction being read
- [ ] `cells` is never rewritten by a direction change
- [ ] Direction tests cover: alternation under flat; constancy under in the round; a per-Row override beating both; retreating a Row giving the same direction as arriving at it forwards
