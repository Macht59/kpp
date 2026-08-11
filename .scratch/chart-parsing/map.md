# Chart parsing strategy

Label: `wayfinder:map`

## Destination

Decide the chart-parsing strategy for kpp — how a screenshot of a colorwork chart becomes a Chart of Cells, running on a stateless Python backend — to the point where a v1 build can be planned.

The map is done when nothing is left to decide before `/to-spec` can collapse it into a buildable plan. It does not build the thing.

## Notes

**Domain.** Read `CONTEXT.md` before any session. The vocabulary is settled: Chart, Cell, Row, Run, Palette, Colorway, Select, Non-stitch. Do not reintroduce "section" (superseded by Run) or "pixel" for Cell (image pixels and chart Cells are different things at different scales, and this project converts between them).

**Skills every session should consult.** `/grilling` and `/domain-modeling` for grilling tickets; `/research` for research tickets; `/prototype` for prototype tickets. Prototypes are kept as primary sources on `prototype/<name>` branches and linked from their ticket, not pasted into it.

**Settled before charting — constraints, not route.** These came out of the charting grill and are inputs to every ticket. The first three are recorded as ADRs; read those for the reasoning rather than relitigating them here:

- Parsing runs on a **backend**, not in the browser — [ADR-0001](../../docs/adr/0001-parsing-on-the-backend.md). The user initially preferred no backend and reversed that deliberately.
- The backend is **Python**, chosen over the house .NET stack — [ADR-0002](../../docs/adr/0002-python-for-the-parsing-service.md) — because the central risk of this map is CV feasibility and the CV ecosystem (OpenCV, scikit-image, NumPy) is deepest there.
- The service is **stateless**: image in, Chart JSON out, nothing retained. Charts persist **on the device** (IndexedDB). No accounts. [ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md).
- ~~Extraction is **fully automatic** on the happy path; correction exists only as a rescue when it fails.~~ **Superseded** by [Acceptance bar for automatic extraction](issues/02-acceptance-bar.md): there is no programmatic bar, so **every parse is reviewed and corrected by the user**. Correction is the normal flow, not a rescue. Extraction is still automatic — it is the *acceptance* that is human.
- The user crops to a **rectangle**; Cells inside it that are background are marked **Non-stitch** and render transparent. ~~The rule is flood-fill from the rectangle's outer edge~~ — resolved by [Decide how Non-stitch Cells are identified](issues/07-non-stitch-rule.md): automatic flood-fill silently deletes real stitches on rectangular charts, so **v1 auto-detects no Non-stitch** (default: every Cell a stitch) and ships flood-fill as a **user-tap correction tool**. Both wild mechanisms (silhouette, X glyphs) go through the same manual gesture; no glyph detection.
- Readout direction is a **per-row toggle**, flipped as you knit, affecting readout text only — never the stored Chart.
- v1 target input is **screenshots of published charts**: gridlines drawn over fills, black outlines crossing Cell boundaries, stitch symbols, garment shaping, lossy compression.

**The test corpus is the arbiter.** Four charts in [`tests/examples/`](../../tests/examples/), described in [`MANIFEST.md`](../../tests/examples/MANIFEST.md), with ground-truth Cell dimensions in each filename. Any claim about extraction is measured against it. It has already falsified two research findings and one design rule — see [Assemble a test corpus of chart screenshots](issues/01-test-corpus.md). Three facts from it apply to every ticket below:

- **Number gutters are the norm.** Three of four charts print row or column numbers outside the grid. They must be excluded from the crop, they make naive `image_size / pitch` overcount by up to 24%, and they are the strongest independent check on a parse's Cell count.
- **Charts declare their own reading direction.** Two of four number columns right-to-left. The per-row readout toggle has a machine-readable default available.
- **Fine pitch is the rare case, not the typical one.** The new charts are 24.9–40.6 px against the original's 8.85. The map was charted assuming the opposite.

**Facts established while charting** (from the example chart, now `tests/examples/112w150h.png`, 1074×1428):

- Grid pitch is regular at **~8.852 px**, and the Chart is **112 × 150** Cells. ~~median 9.0; roughly 112 × 152~~ — the charting figure was a **rounding artefact** of integer-rasterised spacings and is corrected by [Lattice recovery techniques](issues/03-lattice-recovery.md). Using 9.0 drifts ~1.87 Cells across the Chart, corrupting every Run past the midpoint. Treat integer-looking pitches with suspicion.
- The image holds **121,369 distinct RGB values**. Quantized to a 24-step lattice: 187 buckets, 43 above 0.2%. ~~The design Palette is plausibly 12–16.~~ **Superseded** by [Palette recovery from anti-aliased, lossy charts](issues/04-palette-recovery.md): the Palette is **10**, three of them structural (white background, black outlines, off-white) rather than yarn.
- A naive "find grey gridlines" pass recovers horizontal lines only down to y=717, failing across the saturated (flames, wall) region. **The diagnosis was wrong**, per [Lattice recovery techniques](issues/03-lattice-recovery.md): saturation is not the obstacle — gradient-based methods measure a pitch spread of 0.014% across those same bands. The naive scan failed because it used an absolute *colour* predicate where a *differential* one was needed. Lattice recovery must still extrapolate a pitch rather than trace every line.
- The chart carries a second layer that is not Cell color: black outlines crossing Cell boundaries diagonally, stitch symbols near the armholes, and the word "Front".

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Lattice recovery techniques](issues/03-lattice-recovery.md) — gradient projection → DFT peak for pitch, DFT phase for origin; 0.029 Cells of error at Cell 112, ~60 ms. Hough is the fallback, checkerboard detection is ruled out. **Corrected the charting pitch from 9.0 to 8.852**, and made deskew mandatory (0.25° skew fails silently). Verified independently.
- [Palette recovery from anti-aliased, lossy charts](issues/04-palette-recovery.md) — sample Cell interiors first, cluster second. The ordering holds; **both recommended mechanisms were later falsified by the corpus**. Flat-pixel harvesting collapses on noisy charts (0.1% of pixels, all margin, zero yarn colours), and the fixed ΔE 3.0 merge over-segments 13× on `8w37h`. Replaced by a **threshold sweep with plateau selection**, plus a Lab-collinearity test to reject gridline blends.
- [Assemble a test corpus of chart screenshots](issues/01-test-corpus.md) — four charts in `tests/examples/`, ground truth in the filenames, [manifest](../../tests/examples/MANIFEST.md) listing what each one breaks and which axes remain uncovered. Resolved short of the 8–12 asked for, deliberately.
- [Acceptance bar for automatic extraction](issues/02-acceptance-bar.md) — **there is no programmatic bar**; the user reviews and fixes every parse. This makes correction the normal flow rather than a rescue, and re-scores [Automatic extraction spike](issues/05-extraction-spike.md) on **correction burden** rather than accuracy. Structural errors (dimensions, Palette size) stay categorically worse than Cell errors, because they cannot be corrected — only redone.
- [Automatic extraction spike](issues/05-extraction-spike.md) — **the spine holds: automatic extraction is viable across the whole corpus.** All four charts pass dims + Palette size with a reasonable crop (incl. the non-square JPEG); Cell burden is low, confined to the still-unhandled overlay/Non-stitch layers. Plateau merge nailed 9/2/2/2 (fixed ΔE 3.0 gave garbage); collinearity blend-reject dropped as harmful. **Corrected two figures: `8w37h` is 2 colours not 3, `112w150h` is 9 not 10** (filenames are the arbiter). The fragile part is **crop precision**, not extraction — a free confidence signal exists, and cost is ~10s (~1s optimised). Unblocks 06 and 07.
- [Decide how Non-stitch Cells are identified](issues/07-non-stitch-rule.md) — **v1 auto-detects no Non-stitch; flood-fill ships as a user-tap correction tool, glyphs manual.** The prototype (`prototype/non-stitch-rule`) proved failure mode #2 is decisive: automatic border flood-fill deleted **2500/3630 real stitches** on the full-rectangle `66w55h` and mis-seeded the dark colour as background on the scan, because "background colour touching the edge" describes ordinary background yarn as well as true Non-stitch and connectivity can't separate them. Seeded from a user tap it works — traced the `112w150h` vest exactly, preserved enclosed yarn. Glyph-via-spread detection ruled out (confounded with scan noise). Hands the flood-fill-from-tap gesture to [09](issues/09-correction-vocabulary.md) and a per-Cell Non-stitch field to [08](issues/08-chart-contract.md).
- [Overlay layer](issues/06-overlay-layer.md) — **near-non-problem; v1 handles it with the correction path alone, no dedicated overlay code.** Measured on the corpus (prototype on `prototype/overlay-layer`): the interior-median already in the pipeline caps corruption at **59/16,800 Cells (0.4%)** on the only chart with a real overlay, **0** on the other three; naive mean would corrupt 382. Damage concentrates at Run **edges** (43 of 59) — outlines trace shape boundaries — so only 16 Cells hit the expensive split-a-Run case. Morphological masking / black-as-reassignable-entry **ruled unnecessary**. Symbols and "Front" text are not a distinct corruption source (cropped or median-absorbed). Banked for the build, not required: median→per-pixel-plurality resample is strictly more robust if the 59 taps ever annoy.

## Not yet specified

- **Whether the app surfaces its own uncertainty.** No longer load-bearing — nothing routes on it now that the human is the acceptance test. The spike **confirmed a usable signal falls out for free** (within-Cell spread + cluster assignment margin), so confidence highlighting is cheap if wanted; carrying it in the contract is [Chart JSON contract](issues/08-chart-contract.md) Q3, and whether to render it is a build/UI call.
- **Deployment shape of the parsing service.** Hosting, cold-start tolerance, request size limits, and how a mobile client uploads a multi-megabyte screenshot. Pipeline cost is now known — ~10s / 176 MB on a 1074×1428 chart, ~1s with the deskew sweep downsampled — so this waits only on the hosting decisions, not on measurement.
- **Whether the symbol layer ever becomes semantic.** Increase/decrease symbols are noise for v1, but a knitting app that eventually reads shaping instructions would want them. [Overlay layer](issues/06-overlay-layer.md) has now measured them: symbols don't corrupt Cell colour enough to matter, so for v1 they're simply absorbed as noise. Reading them *as* increases/decreases stays out of v1, in scope for the project — a v2 effort, not a live decision here.
- **On-device Chart storage shape.** Schema, versioning, and eviction for IndexedDB-persisted Charts. Waits on [Chart JSON contract](issues/08-chart-contract.md).

## Out of scope

Work consciously ruled beyond this destination. Returns only if the destination is redrawn, and then as a fresh effort.

- **Browser-side parsing.** Decided in favour of a backend during charting.
- **Accounts, cross-device sync, sharing, and server-side storage.** The stateless-service + on-device-persistence decision rules these out; the cost is that clearing browser data loses the Charts, accepted knowingly.
- **Photos of paper charts.** Perspective and illumination correction is a materially different problem.
- **Client framework choice and readout UI design.** Build decisions, not parsing-strategy decisions.
- **Row progress tracking.** A v2 feature that does not shape the parsing strategy.
- **Generating the readout text itself.** Once a Chart yields Runs, turning Runs into words is a build detail.
