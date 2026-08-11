# Overlay layer: outlines and symbols

Type: prototype
Status: resolved
Blocked by: 05

## Question

Charts carry a second layer that is not Cell colour. The example has black outlines tracing the dog, the flames, and the neckline, crossing Cell boundaries diagonally rather than following the lattice; stitch symbols near the armholes; and the word "Front". Sampling a Cell that an outline passes through returns a colour the knitter would never knit.

With the spike from [Automatic extraction spike](05-extraction-spike.md) able to sample Cells, this becomes measurable rather than speculative:

1. **How bad is it?** What fraction of Cells does the overlay actually corrupt, and does robust per-Cell sampling (interior region, median or trimmed mode) already absorb most of it? This may turn out to be a non-problem, and that is a perfectly good answer.
2. **Does it corrupt Runs disproportionately?** A single corrupted Cell mid-Run splits one Run into three. If outlines trace shape boundaries — exactly where colours change — the damage may concentrate at Run edges where it matters least, or at Run interiors where it matters most.
3. **What's the mitigation, if one is needed?** Candidates: treat outline-black as a Palette entry to be reassigned by neighbourhood vote; detect and mask thin dark strokes morphologically before sampling; or accept the corruption and rely on the correction path.
4. **Symbols and text specifically.** Chart labels like "Front" sit outside the stitch area and may be handled by cropping alone. Stitch symbols sit *inside* it and cannot.

**Resolved when** the corruption rate is measured on the corpus and a mitigation is either chosen or explicitly ruled unnecessary.

Note for later: whether symbols eventually become *semantic* — read as increases and decreases rather than scrubbed as noise — is v2 and sits in the map's fog. This ticket only decides how to stop them corrupting Cell colour.

## Answer

**The overlay is a near-non-problem, and v1 handles it with nothing but the correction path — no dedicated overlay code.** Decided with the human.

Measured on the corpus by extending the ticket-05 spike ([`prototype/extraction-spike/overlay.py`](../../../prototype/extraction-spike/overlay.py) on branch `prototype/overlay-layer`; heatmaps at `prototype/extraction-spike/out/*.overlay.png`, red = corrupted, yellow = overlay-touched-but-survived). Truth proxy is a per-pixel **plurality vote** over the Cell interior (a thin stroke is a minority of interior pixels, so the plurality is the yarn the knitter would knit); the pipeline's interior-**median** and a naive **mean** are scored against it, and each corrupted Cell is classified Run-edge vs Run-interior.

### Scored result

| chart | Cells | overlay-touched | corrupt (naive mean) | **corrupt (median = pipeline)** | edge / interior |
|---|---|---|---|---|---|
| `112w150h` | 16,800 | 1,612 (9.6%) | 382 | **59 (0.4%)** | 43 / 16 |
| `74w38h` | 2,812 | 186 (6.6%) | 0 | **0** | — |
| `8w37h` | 296 | 28 (9.5%) | 0 | **0** | — |
| `66w55h` | 3,630 | 61 (1.7%) | 0 | **0** | — |

### The four questions, answered

1. **How bad is it?** ~1 in 10 Cells is *touched* by overlay ink on the rich chart, but the interior-median already in the pipeline absorbs almost all of it: naive mean would corrupt 382 Cells, **median corrupts 59 (0.4%)**. Robust sampling already does the heavy lifting — this is the "non-problem" the ticket invited. On the three overlay-free charts, median corrupts **zero** despite touched Cells (gridlines, cyan grid, X-glyphs all survive), so the metric isn't crying wolf.
2. **Does it corrupt Runs disproportionately?** No — the opposite. Damage concentrates at Run **edges** (43 of 59), because outlines trace shape boundaries, which is exactly where colours (and Runs) change anyway. Only **16 Cells** on the whole 16,800-Cell chart land in a Run interior (the expensive split-one-Run-into-three case). A Run-edge corruption is a 1-Cell shift; cheap.
3. **What's the mitigation?** **None, for v1.** The heavy candidates are ruled unnecessary by the data: morphological stroke masking and treating outline-black as a reassignable Palette entry both buy nothing the median hasn't already delivered, and (per ticket 04's experience) risk over-removing a rare real dark yarn. Since ticket 02 established the human reviews and corrects **every** parse, 59 mostly-edge taps on a 16,800-Cell chart is inside the correction budget. **Banked for the build, not required:** swapping the sampler from interior-median to per-pixel **plurality** is strictly more robust (removes the 59 by construction, also hardens against compression speckle) at the cost of a palette-first two-pass resample — a build-time sampler choice, not a strategy decision.
4. **Symbols and text specifically.** The word "Front" and the stitch symbols do **not** appear as a distinct corruption cluster — they are either excluded by the crop or median-absorbed. The entire visible corruption is the *outline* layer. This confirms the ticket's split: text/symbols outside the stitch area are a crop concern (already covered by the crop-assist requirement from 05), and symbols inside it don't corrupt colour enough to matter for v1.

**Resolved:** corruption rate measured (0.4% worst case, 0% elsewhere), mitigation chosen (rely on correction; no dedicated overlay handling in v1). Symbols-as-semantic remains v2 fog, unchanged.
