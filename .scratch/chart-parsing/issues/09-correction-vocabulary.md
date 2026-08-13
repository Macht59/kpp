# The correction vocabulary

Type: grilling
Status: resolved

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

## Answer

**The five candidate capabilities collapse to three primitives, plus one inherited accelerator, one attention signal, and one escape hatch.** The collapse is the point: repaint-Cell vs repaint-Run, mark-Non-stitch, and merge/split were never separate mechanisms — they are one paint primitive plus Palette-entry housekeeping. Each item is justified by an error class the spike (05), 06, or 07 actually produces, and each respects the structural-vs-Cell distinction from [02](02-acceptance-bar.md).

**Cell-tier capabilities** (correct in place; the parse survives):

1. **Repaint a selection** → any Palette entry, or `-1` (Non-stitch). The selection is a Cell or a contiguous span of Cells (a Run); "repaint a Cell" and "repaint a Run" are *one* tool at different selection sizes, not two. Non-stitch is **not** a separate tool — `-1` is just a paintable value (contract 08: `-1` is a Cell value, never a Palette entry). Covers spike error class #1 and folds in #4.
2. **Flood-fill-from-tap** (inherited verbatim from [07](07-non-stitch-rule.md)) — bulk accelerator that paints a connected region to `-1` (or an entry) from a user tap. The silhouette Non-stitch case (07 proved auto-detection deletes real stitches; a user seed traced the `112w150h` vest exactly). Not new vocabulary — 07 already decided it; 09 places it as the accelerator for capability 1.
3. **Review the flagged Cells** — consumes 08's **sparse per-Cell review list** to route the user to the Cells the parser is unsure about. This is what makes "every parse is reviewed" ([02](02-acceptance-bar.md)) tractable instead of a blind Cell-by-Cell scan. *That* it is consumed is a v1 capability; *how* it is surfaced is UI (out of scope). Without this, 08's review list has no v1 consumer.

**Structural-tier capabilities** (error cannot be fixed Cell-by-Cell — redo-level):

4. **Palette entry add / remove / recolour-swatch.** Merge and split are *not* dedicated tools — they fall out of this + repaint: **merge** = repaint all of entry B → A, then remove the emptied entry (fixes under-merge, which is only cosmetic — a yarn shown as two swatches still reads correctly); **split** = add a new entry, repaint selected Cells into it (fixes over-merge, the genuinely mis-colouring case). **Recolour-swatch** fixes a wrong swatch RGB without touching any Cell. Covers spike error class #2. Non-destructive to the grid — a Palette remap that never re-samples.
5. **Adjust `source` and re-parse.** One operation covering re-crop *and* grid-nudge: adjust the `source` block (crop rect / pitch / origin / count / skew — all exposed by [08](08-chart-contract.md) for exactly this) and re-run the stateless parse. Because the service is stateless (image in, Chart out), any re-sampling is a fresh backend call and there is no cheap in-place nudge; re-gridding changes Cell identities, so **Cell-level edits are discarded by design** — correct per the structural-vs-Cell rule, since a wrong crop is a structural error that can only be redone. Snap-to-lattice crop assist lives *inside* this operation. Covers spike error class #3, the spike's sharpest caveat (crop precision, not extraction, is the fragile part).
6. **Start over** — the escape hatch (discard parse, re-upload). The zero case of #5 (a blank crop), kept as a named capability per spike error class #5, not a distinct mechanism.

**Deferred to v2** (banked, not required): edit-preservation across a re-grid (#5 discards Cell edits; if that annoys, preserve edits as per-Cell overrides when count is unchanged).

**Domain-modeling note.** The correction verbs this ticket introduces — **Repaint**, **Re-parse**, and the `source` block — are deliberately **not** added to `CONTEXT.md`. The ubiquitous language describes the *artifact the parser produces* (Chart, Cell, Row, Run, Palette, Colorway, Select, Non-stitch — all nouns); these are *operation verbs* on that artifact, symmetric with readout-UI terms that are out of scope. They are candidate terms for when the build effort starts, not this map's vocabulary.

**This is the last open ticket.** With it resolved the frontier is empty; the only in-scope item left on the map is the **deployment shape** fog in *Not yet specified*, which 09 does not make specifiable (it waits on hosting decisions, not on the correction vocabulary).
