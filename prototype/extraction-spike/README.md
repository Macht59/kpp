# Automatic extraction spike — findings

Throwaway spike for wayfinder ticket 05. Answers: **does fully-automatic extraction work on real charts?** Scored on *correction burden*, not accuracy (ticket 02).

Run: `python3 spike.py` (deps: numpy, scipy, scikit-image, pillow — all have cp314 wheels). Crops in `crops.json`, outputs in `out/` (`*.recon.png`, `*.compare.png`, `results.txt`).

## Verdict: viable. Automatic extraction works on the whole corpus.

Structural score — **all four charts pass dims AND Palette size** with a reasonable crop:

| chart | pitch x/y | dims | Palette | notes |
|---|---|---|---|---|
| `112w150h-9colors` | 8.85 / 8.85 | 112×150 ✓ | 9 ✓ | fine pitch, shaping, richest Palette |
| `66w55h-2colors` (JPEG) | 25.66 / 19.00 | 66×55 ✓ | 2 ✓ | **non-square Cells confirmed**; JPEG loaded via Pillow |
| `74w38h-2colors` | 24.92 / 24.93 | 74×38 ✓ | 2 ✓ | scan, 0.35° skew auto-corrected |
| `8w37h-2colors` | 41.15 / 40.57 | 8×37 ✓ | 2 ✓ | cyan gridlines, X-glyph Non-stitch, 38%-unique-pixel noise |

Cell-level burden (eyeballed from `out/*.compare.png`): **low**. Reconstructions are faithful; the only visible misfills come from the *overlay layer* (ticket 06 — black outlines, window, scalloped line) and *Non-stitch* (ticket 07 — garment silhouette, X-glyphs), neither of which this spike handles. Fills themselves are essentially right — a handful of taps on a 16,800-Cell chart, not hundreds.

## What held, what changed

- **Lattice (ticket 03) held completely.** Gradient-projection → DFT peak (parabolic-refined) for pitch, offset search for origin, per-axis. Recovered exact known pitches (8.85, 40.6, 24.9) and the **non-square** 25.66×19.0 on the JPEG. Deskew mandatory and effective (0.35° on the scan). *Note:* I recover origin by a direct offset search over the gradient comb rather than DFT phase — equivalent, more robust with a Hanning window, fewer lines.
- **Plateau merge (ticket 04) held and is decisive.** Threshold-sweep + widest-plateau gave **9 / 2 / 2 / 2 — exact on all four**. Fixed ΔE 3.0 gave 127 / 5 / 15 / 49 — confirmed garbage, as the amendment predicted.
- **Two ticket-04 figures were wrong; the filenames win.** `8w37h` is **2 colours**, not the "3" ticket 04 recorded; `112w150h` is **9**, not "10". The spike recovers 2 and 9.
- **Lab-collinearity blend rejection (ticket 04) was dropped — unnecessary and harmful.** Plateau selection already merges gridline blends via the threshold; running the collinearity test on top over-removed a rare-but-real yarn (9→8), because a genuine <1%-area entry can sit coincidentally collinear between two others. Plateau stands alone.
- **Comb-support grid-trimming was tried and rejected** — it reintroduced the exact naive-scan failure ticket 03 warned about (gridline support drops out across saturated / gridline-over-fill regions, collapsing the extent to 8×1). The lattice must be *extrapolated*, not traced.

## The real caveats (feed the map's fog)

1. **Crop precision, not extraction, is the fragile part.** Pitch is exact, but final Cell count is only as good as the crop: at 8.85px pitch a **4px crop error flips a row** (`crop edge slop` in `results.txt` shows the sensitivity). Snapping absorbs <0.5-cell error; beyond that you gain/lose a line. **Number gutters must be excluded by the crop** — they cannot be auto-trimmed by lattice support without reintroducing the naive-scan trap. So *crop assistance* (snap + a gutter-aware assist) is a v1 requirement, not a nicety.
2. **A confidence signal falls out for free.** Within-Cell spread (median MAD: 0.58 on the crisp chart, ~5 on the noisy scans) and cluster assignment margin (ΔE 13.5–63.5) both flag ambiguous Cells with no extra work. Confidence highlighting is buildable if wanted.
3. **Cost:** full pipeline on the 1074×1428 chart ≈ **10 s, 176 MB peak**. The deskew angle-sweep (≈50 full-image rotations) dominates; estimating skew on a downsampled copy would cut this by ~10×. Fine for a backend; the map's deployment-shape fog can assume ~1 s/chart with that optimisation.
4. **Non-stitch (07) and overlay (06) are unhandled** and account for essentially all visible Cell errors. They are the next real work, not a tuning problem here.
