# Test corpus — colorwork chart screenshots

Working fixtures for [Automatic extraction spike](../../.scratch/chart-parsing/issues/05-extraction-spike.md).

**Filenames encode ground truth**: `<width>w<height>h` in Cells. `74w38h.png` is 74 Cells wide, 38 tall. That is the scoring key — a parse that returns different dimensions is wrong before its Palette is even examined.

**Licensing.** These are third-party charts held as test fixtures. Provenance is recorded per chart below where known. Whether they stay in git is a call to revisit before this repo goes public.

## The charts

### `112w150h.png` — 1074×1428 px, pitch 8.852
The chart every finding on this map was originally measured against. Garment shaping with non-stitch background, black outlines crossing Cell boundaries, stitch symbols, the word "Front". **10 Palette entries**, three of them structural. The only chart in the corpus with a non-rectangular silhouette, and so the only one that exercises the Non-stitch rule at all.

Formerly `Screenshot 2026-08-10 at 9.16.47 PM.png` at the repo root; renamed because the original filename contained a U+202F narrow no-break space that broke Python's `open()` while the Read tool handled it fine.

### `8w37h.png` — 402×1526 px, pitch ~40.6
The corpus's hardest chart, and the one that breaks the most assumptions.

- **Cyan gridlines**, not grey. Any predicate tuned to grey lines fails here.
- **Non-stitch Cells are marked with an X glyph**, not by background colour. This is a different mechanism from `112w150h.png` entirely.
- **Row numbers 1–37 in a right-hand gutter** (~77 px) that is not chart.
- **Extremely noisy**: 234,881 distinct RGB values in 613,452 pixels — 38% of pixels are unique. Dithered or repeatedly recompressed. Only **0.1%** of pixels have a strictly-constant 3×3 neighbourhood.

### `74w38h.png` — 1880×1014 px, pitch ~24.9
A **scan**, not a screen capture — degraded, noisy, faintly skewed. The corpus's deskew test case.

- 2 colours only (reads as `102,102,102` on `252,252,252` — "black" is mid-grey after scanning).
- Column numbers along the **bottom**, running 70→5 **right-to-left**.
- Row numbers 1–38 on the right.
- Heavy every-5 gridlines over hairline every-1.

### `66w55h.jpg` — 1905×1187 px
Clean machine export from chart-minder.com; navy on white, captioned "fish bag art.png by / Created on chart-minder.com".

- **Numbers on all four sides** — rows on both (evens left, odds right), columns top and bottom, numbered 66→1 right-to-left.
- **The only JPEG.** The stdlib PNG decoder used for verification on this map cannot read it; the spike needs a real image library regardless, but this chart is what forces it.
- Cell aspect ratio is **unverified** — margins suggest cells wider than tall, but that was eyeballed, not measured, and both PNGs measured square.

## What the corpus already proved

Measured before the spike was written, using the techniques from the two resolved research tickets:

| | `8w37h` | `74w38h` |
|---|---|---|
| DFT pitch, x / y | 40.63 / 40.59 | 24.91 / 24.96 |
| Cells recovered vs ground truth | 8×37 exact | 74×38 exact |
| Flat-pixel palette harvest | **fails** — 24 values, all near-white | 6 values → 2 correct |
| Cell-median palette, ΔE<3 | 40 clusters (true ~3) | — |
| Cell-median palette, ΔE 20–25 | 3 clusters — correct | — |

Two conclusions, both recorded on the map:

1. **Lattice recovery generalises.** Gradient-projection DFT returned square pitch on both and exact Cell counts on both. It survived the 38%-unique-pixel noise of `8w37h` and the scan degradation of `74w38h`.
2. **The fixed ΔE 3.0 merge threshold does not.** It is an artefact of one crisp chart. See [Palette recovery from anti-aliased, lossy charts](../../.scratch/chart-parsing/issues/04-palette-recovery.md).

## Gaps

Passing on this corpus is real evidence but not complete evidence. Uncovered axes from the original ticket:

- **No chart without gridlines at all.**
- **No deliberately rescaled screenshot** (non-integer pitch from resampling rather than from layout).
- **Fine pitch is thin** — `112w150h` at 8.85 px is the only one under 24 px, and it is also the only chart with shaping, so those two variables are confounded.
- **Only one chart per provenance.** Compression artefacts differ by source and n=1 per source cannot separate "this software" from "this chart".
- **Palette size tops out at 10** and three of the four charts are 2–3 colours.

Adding charts here does not need a ticket — drop the file in, name it `<w>w<h>h`, add a section above.
