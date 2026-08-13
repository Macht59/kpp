# kpp

Knitting Pattern Parser is a tool for converting image patterns into interactive ones.

## The parsing service

`kpp.parse_chart(image, crop)` takes a chart screenshot plus the rectangle the
knitter cropped (`x, y, w, h`, number gutters excluded) and returns a Chart as a
JSON-ready dict: grid dimensions, a Palette of the distinct colours, and Cells as
Palette indices. It is stateless — image in, Chart out, nothing retained — and
every parse is reviewed and corrected on-device, so the Chart also carries the
confidence signals and the `source` block that review needs.

The contract is [ticket 08](.scratch/chart-parsing/issues/08-chart-contract.md);
the plan is [the spec](.scratch/chart-parsing/spec.md).

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/
```

The corpus tests need the chart screenshots in `tests/examples/` (not in git —
see [the manifest](tests/examples/MANIFEST.md)); they skip without them.

Two limits are known and recorded in the tests rather than papered over.
Yarns used for a handful of Cells in a large Chart merge into their neighbours,
so the 9-colour corpus chart comes back with 7. And `confidence.chart` scores
how cleanly the crop snapped to the lattice and nothing else: a crop drawn
*inside* the Chart is a perfect crop of a smaller Chart, and only the knitter
can catch that.
