# 01 — Parse a whole image and see the Chart

**What to build:** A knitter opens the app on their phone, picks a chart image
from their photos, taps *use whole image*, waits while it parses, and sees the
parsed Chart drawn on screen. This is the tracer bullet: one narrow path
through serving, upload, parsing and rendering, demoable end to end.

One process serves both the static client and the parse endpoint, same-origin.
The endpoint takes the image as a multipart upload plus the crop rectangle as
`x`, `y`, `w`, `h`, and returns the schema-1 Chart from
[ticket 08](../../chart-parsing/issues/08-chart-contract.md). *Use whole image*
is simply the full image bounds as the crop, which the parser accepts.

The parsing package is not modified. `parse_chart(image, crop) -> Chart` is the
seam; the web layer calls it and nothing about serving reaches inside it.
Client is plain ES modules and a canvas, no framework and no build step, per
[ADR-0004](../../../docs/adr/0004-vanilla-canvas-pwa-client.md).

Failures matter as much as the happy path here, because the two the parser
raises are both things the knitter can act on — the crop fell outside the
image, was too small, or held no recoverable grid.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] One command starts a server that serves the client and the parse endpoint from the same origin
- [x] A knitter can pick an image from their device and see it on screen
- [x] *Use whole image* parses the full image and draws the resulting Chart on a canvas
- [x] Progress is shown while parsing; the client gives up after 30 seconds with a clear message
- [x] A parser `ValueError` returns 400 with the parser's own message, shown to the knitter — never a 500
- [x] An upload over 20 MB is rejected with 413 rather than truncated and parsed
- [x] A request missing the image or any crop field is rejected
- [x] A successful response is the schema-1 contract, unchanged from what `parse_chart` produced
- [x] The deskew downsample from [ticket 05](../../chart-parsing/issues/05-extraction-spike.md) is applied
- [x] Endpoint tests exist, follow the existing corpus test's conventions, and skip rather than fail when corpus images are absent
- [x] The parsing package is unchanged

## Comments

Built as `server.py` (Flask) plus `web/index.html` and `web/app.js`, with
`tests/test_parse_endpoint.py` at the endpoint seam.

Flask rather than FastAPI: the HTTP framework, its dev server, multipart form
support, the 20 MB limit and a test client are all one dependency, where the
FastAPI route is three plus middleware for the 413.

Two things worth recording:

- **The deskew downsample was already in the parsing package** — `_decimate`
  runs the coarse angle sweep on a decimated central window, which is the
  ticket-05 measurement applied. Nothing was added, and the package is
  unchanged as required. Measured through the endpoint: 6.7 s for the
  1074×1428 nine-colour chart, 1.3 s for the smallest, both well inside the
  client's 30 s timeout.
- **An undecodable upload returns 400, not the 500 the ticket's rule implies.**
  Pillow raises `UnidentifiedImageError`, not `ValueError`, but a knitter who
  picked the wrong file is exactly as able to act on it as one who drew a bad
  crop. Caught by that specific type, so no genuine server error is masked.
