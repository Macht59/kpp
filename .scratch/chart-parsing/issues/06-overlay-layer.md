# Overlay layer: outlines and symbols

Type: prototype
Status: open
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
