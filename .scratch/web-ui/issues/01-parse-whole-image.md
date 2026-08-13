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

**Status:** ready-for-agent

- [ ] One command starts a server that serves the client and the parse endpoint from the same origin
- [ ] A knitter can pick an image from their device and see it on screen
- [ ] *Use whole image* parses the full image and draws the resulting Chart on a canvas
- [ ] Progress is shown while parsing; the client gives up after 30 seconds with a clear message
- [ ] A parser `ValueError` returns 400 with the parser's own message, shown to the knitter — never a 500
- [ ] An upload over 20 MB is rejected with 413 rather than truncated and parsed
- [ ] A request missing the image or any crop field is rejected
- [ ] A successful response is the schema-1 contract, unchanged from what `parse_chart` produced
- [ ] The deskew downsample from [ticket 05](../../chart-parsing/issues/05-extraction-spike.md) is applied
- [ ] Endpoint tests exist, follow the existing corpus test's conventions, and skip rather than fail when corpus images are absent
- [ ] The parsing package is unchanged
