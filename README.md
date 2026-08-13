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

## The app

`python server.py` serves the client and the parse endpoint from one process on
`http://localhost:8000`, same-origin. Pick a chart image, drag a rectangle around
the grid — the number gutters have to stay outside it, or the Cell count comes
out wrong — and the parsed Chart is drawn on a canvas. *Use whole image* is the
shortcut for a screenshot that is already cropped.

A fresh parse opens in **Review**, because nothing has checked it yet. Review is
a survey: it opens on the whole Chart, pans and pinches freely from there, and
toggles to the image it was parsed from — shown through a window the shape of
the crop, so the two are the same picture and the toggle is a comparison. Above
them are the two facts no correction can fix: the Chart's size and how many
Palette entries came back. Both have to be parsed again rather than repainted,
and the count of entries is the only defence against a Palette that merged
silently. A crop the parser was unsure of adds a banner. *Knit this chart*
leaves Review; *Review this parse* comes back, at any Row, at any time.

Which way a Row is read follows the garment's Construction: flat turns the work
every Row so the direction alternates, in the round never turns so it holds, and
a single Row can be Flipped when the alternation slips. Both are the knitter's
to set — the parser cannot read them, because the gutter numbers they come from
sit outside the crop — and neither is ever written into `cells`.

The client is plain ES modules and a canvas in `web/` — no build step, per
[ADR-0004](docs/adr/0004-vanilla-canvas-pwa-client.md). Its pure logic is tested
under Node's own runner, a test-time requirement and never a build step:

```bash
node --test "web/*.test.js"
```

`POST /api/parse` takes
the image as a multipart upload plus the crop as `x, y, w, h`, and returns the
schema-1 Chart. A parser `ValueError` comes back as a 400 carrying the parser's
own message, because every one of them is something the knitter can act on; an
upload over 20 MB is refused with a 413 rather than truncated and parsed into a
plausible, wrong Chart.

The corpus tests need the chart screenshots in `tests/examples/` (not in git —
see [the manifest](tests/examples/MANIFEST.md)); they skip without them.

Two limits are known and recorded in the tests rather than papered over.
Yarns used for a handful of Cells in a large Chart merge into their neighbours,
so the 9-colour corpus chart comes back with 7. And `confidence.chart` scores
how cleanly the crop snapped to the lattice and nothing else: a crop drawn
*inside* the Chart is a perfect crop of a smaller Chart, and only the knitter
can catch that.
