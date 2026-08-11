# The correction vocabulary

Type: grilling
Status: open

## Question

Graduated from the map's *Not yet specified* once [Automatic extraction spike](05-extraction-spike.md) showed which errors extraction actually produces. [Acceptance bar for automatic extraction](02-acceptance-bar.md) made correction the **normal flow** — every parse is reviewed and fixed — so what the user can *do* is now first-class and on the critical path of the first user journey.

Decide the set of correction capabilities v1 needs (the *capability*, not the UI — readout/UI design is out of scope). The spike's error classes are the evidence, not imagination:

1. **Repaint a Cell / a Run.** The common case — an individual misfilled Cell, or a whole Run to recolour. The Run is the unit the user consumes; is Run-level repaint worth it over Cell-by-Cell?
2. **Merge / split Palette entries.** The plateau merge was exact on the corpus, but provenance varies; a chart that over- or under-merges needs a manual fix that remaps without touching the grid.
3. **Re-crop and nudge the grid.** The spike's sharpest caveat: pitch is exact but Cell count is only as good as the crop, and number gutters must be excluded by the crop. Crop assistance (snap-to-lattice) plus a manual grid nudge is a **v1 requirement**, not a nicety — a wrong crop is a structural error, which cannot be corrected Cell-by-Cell, only redone.
4. **Mark Cells Non-stitch.** Depends on [Decide how Non-stitch Cells are identified](07-non-stitch-rule.md): if v1 delegates glyph-marked Non-stitch to manual correction, "mark this Cell Non-stitch" must exist as a tool.
5. **Start over.** The escape hatch for a structural failure.

**Resolved when** there is a decided list of v1 correction capabilities, each justified by an error class the spike (or 06/07) actually produces, with the structural-vs-Cell distinction respected — structural errors need redo-level tools (re-crop, nudge, merge/split), Cell errors need repaint.

## Comments

Overlaps [Chart JSON contract](08-chart-contract.md) (the contract must expose crop rect, pitch, and Palette so correction can re-overlay and remap) and [07](07-non-stitch-rule.md) (whether Non-stitch marking is a manual tool). Not blocked by them — the core vocabulary is specifiable now — but grill with both in view.
