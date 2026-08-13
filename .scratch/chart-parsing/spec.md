# Chart parsing service — v1 spec

Status: ready-for-agent
Feature: chart-parsing
Collapsed from: [map.md](map.md) (all nine tickets resolved; frontier empty)

## Problem Statement

A knitter working a colorwork pattern reads a chart printed as an image — a
grid of coloured squares, usually a screenshot of a published chart with
gridlines, black shaping outlines, stitch symbols, number gutters, and lossy
compression. To knit from it they track their place by eye across hundreds of
tiny squares, counting Runs of same-coloured Cells one Row at a time. It is
error-prone, easy to lose your place in, and impossible to interact with (no
per-Row Select, no Readout, no reading-direction flip). The knitter has the
image; what they want is a Chart they can read Row by Row.

## Solution

A stateless Python parsing service. It takes a cropped chart screenshot plus
the crop rectangle the knitter drew, and returns a **Chart** as JSON: grid
dimensions, a **Palette** of the distinct colours, and a 2D array of **Cells**
as Palette indices — the exact contract in [ticket 08](issues/08-chart-contract.md).
Extraction is fully automatic; the CV pipeline recovers the lattice, samples
Cell interiors, and merges colours into a Palette with no human input. The
service retains nothing — image in, Chart JSON out — and the client persists
the Chart on-device.

Because there is no programmatic acceptance bar ([ticket 02](issues/02-acceptance-bar.md)),
the parse is not claimed to be perfect: **every parse is reviewed and corrected
by the knitter on-device**, and the contract carries the metadata that review
needs (per-Cell confidence flags, and a `source` block to re-overlay the
lattice). This spec covers **the parsing service and its output contract
only** — the correction *capabilities* it must enable are recorded under
Further Notes; the correction UI, client framework, and deployment shape are
out of scope (see Out of Scope).

The prototype at `prototype/extraction-spike/spike.py` already validates this
pipeline end-to-end across the whole corpus and is the reference for the build.

## User Stories

Actors: the **knitter** (end user, downstream of the service), and the
**client** (the on-device consumer of the Chart JSON). Stories that read from
the client's perspective describe contract requirements the service must
satisfy.

1. As a knitter, I want to upload a screenshot of a colorwork chart and get back a digital Chart, so that I don't have to transcribe hundreds of squares by hand.
2. As a knitter, I want the Chart's grid dimensions to match the real chart's Cell count exactly, so that no Row is added or dropped before I even start knitting.
3. As a knitter, I want the parse to recover the distinct colours the chart actually uses as a Palette, so that I can map each one to a real yarn (a Colorway) later.
4. As a knitter, I want each Cell filled with the correct Palette entry, so that the Runs I read match the pattern I intend to knit.
5. As a knitter, I want to draw an approximate crop rectangle on my phone excluding the number gutters, and have the service snap it to the true grid, so that a few pixels of slop in my crop don't gain or lose a whole Row.
6. As a knitter photographing a slightly rotated screenshot, I want the service to correct small skew automatically, so that a fraction of a degree doesn't silently corrupt every Run past the midpoint.
7. As a knitter, I want a chart with non-square Cells (wider than tall) parsed correctly, so that Charts exported by tools that don't use square Cells still come out right.
8. As a knitter with a JPEG export, I want the service to read it as readily as a PNG screenshot, so that the file format my chart software produced isn't a blocker.
9. As a knitter with a noisy or scanned chart, I want colour extraction to still collapse to the true Palette, so that compression dither and scan degradation don't invent extra colours.
10. As a knitter, I want structural errors (wrong dimensions, wrong Palette size) to be the rare exception on a reasonable crop, so that I'm correcting individual Cells, not redoing the whole parse.
11. As a knitter reviewing a parse, I want the service to flag the specific Cells it was least sure about, so that my review is directed to the doubtful spots instead of a blind Cell-by-Cell scan.
12. As a knitter, I want a whole-Chart confidence signal separate from the per-Cell flags, so that I can tell "the crop looks wrong, redo it" apart from "a few Cells need a tap."
13. As a knitter, I want the Chart to remember how it was cropped and gridded (crop, pitch, origin, skew), so that the client can re-overlay the lattice on my original image when I want to re-crop or nudge the grid.
14. As a knitter, I want the Palette kept independent from the Cell grid, so that renaming a Palette entry to a real yarn, or recolouring its swatch, never disturbs the Cells.
15. As a knitter, I want every Palette entry to have a stable identity, so that the Colorway name I give a colour stays attached to it.
16. As a knitter whose chart has black shaping outlines crossing Cell boundaries, I want those outlines to barely affect the Cell fills, so that the overlay layer costs me a handful of taps, not hundreds.
17. As a knitter whose chart has stitch symbols or a "Front" label, I want those absorbed as noise rather than read as colours, so that they don't pollute the Palette.
18. As a knitter, I want the service to default every Cell to a stitch (never auto-deleting yarn as background), so that a full-rectangle chart is never silently gutted by background detection.
19. As a knitter with a garment-silhouette chart, I want Non-stitch marking to be a correction I invoke, not something guessed for me, so that real enclosed stitches (eyes, a mug) are never removed.
20. As a client, I want the Chart JSON to declare its `dimensions` redundantly alongside the `cells` array, so that I can integrity-check a parse cheaply and reject a mis-shaped one.
21. As a client, I want Cells encoded as a row-major 2D array of Palette indices in image orientation with `[0][0]` at top-left, so that I can render and index the Chart without guessing its layout.
22. As a client, I want `-1` reserved in the Cell array to mean Non-stitch (never a Palette entry), so that Non-stitch stays background-not-yarn and never appears in the list the knitter maps to Colorways.
23. As a client, I want each Palette entry as `{rgb, name}` with array index as identity and `name` null from the service, so that I can fill the Colorway label on-device without a separate id scheme.
24. As a client, I want a single top-level integer `schema_version`, so that a Chart persisted on-device can outlive the schema that produced it and be migrated later.
25. As a client, I want an optional corpus-derived `reading_direction_default`, so that I can seed the per-Row Readout toggle sensibly without baking direction into the stored Cells.
26. As a client, I want the confidence signals to be two never-averaged fields (whole-Chart scalar + sparse per-Cell list), so that structural doubt and Cell doubt stay distinguishable, per the acceptance-bar split.
27. As a client, I want the per-Cell confidence list sparse (only flagged Cells), so that it's exactly the input a "direct my eye" review UI consumes, not a dense map I have to threshold myself.
28. As a knitter, I want the parse to cost a few seconds, not minutes, so that uploading a chart feels responsive.
29. As a knitter, I want reading direction to remain a per-Row toggle I flip as I knit, never stored in the Cells, so that my reading choices never mutate the Chart.
30. As a maintainer, I want the parse verified against a corpus whose ground truth is in the filenames, so that dimension and Palette-size regressions are caught automatically with no hand-labelling.
31. As a maintainer, I want the service to emit no `-1` Cells in v1 (Non-stitch arrives only from on-device correction), so that the extraction side has no auto-Non-stitch code to maintain or mis-fire.

## Implementation Decisions

**The seam.** A single high seam: `parse_chart(image, crop) -> Chart` — the
source image (bytes or decoded array) plus the knitter's crop rectangle in, a
Chart dict matching the [ticket 08](issues/08-chart-contract.md) contract out.
This is what `prototype/extraction-spike/spike.py` already is, formalised to
emit the contract shape and serialise to JSON. No new extraction capability is
implied over the spike — only serialisation and the correction metadata.

**Pipeline stages** (each a deep, independently testable step; the spike is the
reference implementation, to be rewritten cleanly, not productionised as-is):

1. **Decode** — a real image library (Pillow), because the corpus includes a
   JPEG the stdlib PNG decoder can't read. PNG and JPEG both supported.
2. **Deskew** — estimate the skew angle that maximises combined DFT peak
   sharpness, then rotate. **Mandatory**: 0.25° skew silently returns a wrong
   pitch ([ticket 03](issues/03-lattice-recovery.md)). Estimate the angle on a
   downsampled copy — the angle-sweep (~50 full-image rotations) dominates cost
   and downsampling cuts it ~10×.
3. **Lattice recovery** — per axis, independently (Cells may be non-square):
   gradient-projection profile → dominant spatial period via zero-padded DFT
   peak with parabolic refinement (**pitch**); direct offset search over the
   gradient comb (**origin**). Do **not** trace individual gridlines: per-line
   support drops out over saturated / gridline-over-fill regions (the naive-scan
   trap). The regular pitch is extrapolated, never traced.
4. **Crop-snap** — snap the crop edges to the recovered `origin + n·pitch` comb
   and count whole Cells between them. This, not raw crop edges, gives the Cell
   count (raw edges overcount by up to 24%). Number gutters must be excluded by
   the crop; they cannot be auto-trimmed. Report the edge slop — how loose the
   crop was — as a structural confidence signal (<0.5 Cell is absorbed; beyond
   that a Row is gained/lost).
5. **Cell sampling** — interior-median (central 50%) RGB per Cell. Also compute
   within-Cell spread (median absolute deviation) — a free per-Cell confidence
   signal. Interior-median is what caps overlay-outline corruption at ≤0.4% of
   Cells ([ticket 06](issues/06-overlay-layer.md)); no dedicated overlay code.
6. **Palette recovery** — cluster the *unique* Cell medians (sample-first,
   cluster-second) by CIEDE2000 complete-linkage; **sweep the merge threshold
   (≈1–41) and select the count at the widest plateau**; reassign every Cell to
   its nearest centroid. Record the assignment margin (ΔE to 2nd-nearest) as a
   second per-Cell confidence signal. Do **not** use a fixed ΔE 3.0 threshold
   (garbage on the corpus: 127/5/15/49 vs the correct 9/2/2/2). Do **not** run a
   Lab-collinearity blend-rejection pass (dropped: unnecessary — the plateau
   already merges blends — and harmful, it over-removed a rare real yarn 9→8).
7. **Serialise** — emit the contract-08 JSON (below).

**Output contract** (verbatim from [ticket 08](issues/08-chart-contract.md);
this is the only interface the client sees):

- `schema_version`: single integer, starts at `1`.
- `dimensions: {rows, cols}` — declared redundantly; MUST equal the `cells`
  shape. Wrong dimensions is the one error that fails a chart outright.
- `palette`: array of `{rgb: [r,g,b], name: string|null}`. **Array index is the
  identity.** `name` is null from the stateless service (the Colorway label is
  filled on-device). `-1` is never in this list.
- `cells`: `int[][]`, row-major, image orientation, `cells[0][0]` = top-left.
  Value `>=0` is a Palette index; `-1` is Non-stitch. **The service emits no
  `-1` in v1** (default: every Cell a stitch, [ticket 07](issues/07-non-stitch-rule.md));
  `-1` appears only after on-device correction.
- `source`: `{image_width, image_height, crop [x,y,w,h], pitch [px_x,px_y],
  origin [ox,oy], skew_deg}` — lets the client re-overlay the lattice for
  re-crop / grid-nudge correction.
- `confidence` (optional): two never-averaged signals — `chart`, a whole-Chart
  scalar for crop/structural confidence (derived from crop edge slop + DFT peak
  strength); and `cells`, a **sparse** `[{r, c, score}]` list of only the Cells
  flagged for review (from within-Cell spread + assignment margin). Non-stitch
  Cells carry no confidence entry.
- `reading_direction_default` (optional, `"ltr"|"rtl"`): corpus-derived, seeds
  the Readout toggle, never baked into `cells`. Emitted only when the service
  can determine it; omitted otherwise (gutter numbers are typically outside the
  crop, so v1 may routinely omit it).

**No auto-detection of Non-stitch, no glyph/symbol reading, no overlay-masking
code.** All three were measured and ruled unnecessary or harmful for v1
(tickets 06/07). They live entirely in the (out-of-scope) correction UI or are
deferred to v2.

**Dependencies:** numpy, scipy, scikit-image, pillow (all with current wheels).

## Testing Decisions

**What makes a good test here:** assert on the **contract output** — external
behaviour the client depends on — not on pipeline internals. Dimensions,
Palette size, and contract well-formedness are behaviour. Intermediate pitch,
origin, skew, and DFT peak values are provenance in the `source` block: they
may drift within tolerance and should not be asserted exactly (pin them, if at
all, only as loose regression bounds).

**The seam under test:** `parse_chart(image, crop) -> Chart`, exercised against
the four-chart corpus in `tests/examples/` ([MANIFEST](../../tests/examples/MANIFEST.md)).

**Ground truth is in the filenames** (`<w>w<h>h-<n>colors`), so the structural
score needs no annotation:

- **Structural asserts (automatable, per chart):** `dimensions` equals the
  filename's `w×h`; `len(palette)` equals the filename's colour count. One
  structural failure fails the chart outright — dims and Palette size are
  reported pass/fail, never as a percentage ([ticket 02](issues/02-acceptance-bar.md)).
  Target: all four charts pass (the spike already achieves 112×150/9, 66×55/2,
  74×38/2, 8×37/2).
- **Contract well-formedness asserts:** `dimensions` equals the `cells` shape;
  every Cell value is in `[0, len(palette))` (no `-1` emitted by the service in
  v1); `palette` entries have `name: null`; `schema_version == 1`; `source`
  fields present.
- **Crop robustness:** use the deliberately-imperfect crops in
  `prototype/extraction-spike/crops.json` (a few px off, gutters excluded — they
  simulate a hand-drawn phone crop). Assert the reported crop edge slop stays
  under the 0.5-Cell snap tolerance, so snapping absorbs it.
- **Cell fidelity:** eyeballed via reconstruction (render `palette[cells]` and
  compare to the original), **not** hand-labelled — the no-hand-labelling call
  was made and upheld in [ticket 05](issues/05-extraction-spike.md). The
  remaining visible misfills are the overlay and Non-stitch layers, which the
  service deliberately doesn't handle.

**Modules tested:** the top-level `parse_chart` seam (integration, against the
corpus) is the primary and ideally the only seam. Lattice recovery and Palette
recovery are the two stages most worth a focused check if a unit-level test is
warranted — but prefer asserting their effect through the seam (recovered dims,
recovered Palette size) over asserting their internals.

**Prior art:** `prototype/extraction-spike/spike.py` is the reference harness —
its `_report` structural score (pass/fail dims + Palette, with the free
confidence diagnostics) is the template for the corpus test. The corpus's
own `MANIFEST.md` already records pre-spike measurements to check against.

## Out of Scope

- **Correction UI and the client framework.** The correction *capabilities*
  (ticket 09) are requirements the contract satisfies (see Further Notes), but
  building the repaint / flood-fill / Palette-edit / re-parse UI, and choosing
  the client framework, are a separate build.
- **The HTTP endpoint and deployment shape.** Hosting, cold-start, request-size
  limits, and how a phone uploads a multi-megabyte screenshot are unspecified
  fog in the map, waiting on hosting decisions, not on this service. The seam is
  the `parse_chart` function; a thin HTTP wrapper is deferred.
- **On-device Chart storage shape** (IndexedDB schema, eviction). The contract
  gives the client its full payload plus `schema_version`; how it stores/evicts
  is a build decision.
- **Readout UI and Readout text generation.** Turning Runs into words, and the
  per-Row Select / toggle UI, are build details downstream of the Chart.
- **Auto-detection of Non-stitch, glyph/symbol detection, overlay-masking
  code.** Ruled unnecessary or harmful for v1 (tickets 06/07).
- **Reading the symbol layer as semantics** (increases/decreases). A v2 effort;
  symbols are absorbed as noise in v1.
- **Accounts, cross-device sync, sharing, server-side storage.** Ruled out by
  the stateless-service / on-device-persistence decision ([ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md)).
- **Photos of paper charts.** Perspective/illumination correction is a
  materially different problem; v1 targets screenshots of published charts.
- **Browser-side parsing.** Decided in favour of a backend ([ADR-0001](../../docs/adr/0001-parsing-on-the-backend.md)),
  Python ([ADR-0002](../../docs/adr/0002-python-for-the-parsing-service.md)).

## Further Notes

**Correction capabilities the contract must enable** (ticket 09 — built later,
in the out-of-scope client, but the service's output must make them possible):
repaint a Cell/Run to any Palette entry or `-1`; flood-fill-from-tap to `-1`;
review the flagged Cells (consumes `confidence.cells`); Palette entry
add/remove/recolour (merge/split fall out of this + repaint); adjust the
`source` block and re-parse (one op for re-crop and grid-nudge, since the
service is stateless); start over. The contract deliberately carries `source`
(for re-overlay), the `palette` array (for remap), `-1` (for mark-Non-stitch),
and `confidence.cells` (for directed review) to serve exactly these.

**The correction verbs (Repaint, Re-parse) and the `source` block are NOT in
`CONTEXT.md`** — the ubiquitous language names the artifact (Chart, Cell, Row,
Run, Palette, Colorway, Select, Readout, Non-stitch), not operations on it.
They become candidate terms if/when the client build starts.

**Whether to render confidence** (highlight flagged Cells) is a UI call; the
contract only carries it.

**The spike is throwaway but kept**, not to be productionised in place — v1 is a
clean write informed by it. Its findings (`prototype/extraction-spike/README.md`)
and the Non-stitch prototype (`README-nonstitch.md`) are the primary sources.

**Cost, for the deployment decision that follows:** ~10 s / 176 MB peak on the
1074×1428 chart; the deskew angle-sweep dominates and drops ~10× (~1 s) with
downsampled skew estimation. Fine for a backend.

**Corpus gaps** (real evidence, not complete — [MANIFEST](../../tests/examples/MANIFEST.md)):
no gridline-less chart; no deliberately rescaled screenshot; fine pitch is thin
and confounded with shaping (only `112w150h` is under 24 px, and it's also the
only shaped chart); one chart per provenance; Palette size tops out at 10. New
corpus charts need no ticket — drop the file in, name it `<w>w<h>h-<n>colors`.
