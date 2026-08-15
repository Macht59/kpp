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

Correcting a Cell the parser got wrong is one operation with two handles. In
Review, tap a Palette swatch to arm it, then tap a Cell or drag across a span —
arming it is what claims the one-finger gesture, tapping it again hands that back
to pan, and a second finger ends the paint and pinches. In Knit, tap the Run chip you
are looking at and pick an entry, which repaints that whole Run of the Selected
Row. Repainting a stray Cell back to its neighbours' colour merges the three
chips into one on the next Readout.

Which way a Row is read follows the garment's Construction: flat turns the work
every Row so the direction alternates, in the round never turns so it holds, and
a single Row can be Flipped when the alternation slips. Both are the knitter's
to set — the parser cannot read them, because the gutter numbers they come from
sit outside the crop — and neither is ever written into `cells`.

A parsed Chart is kept on the device the moment it lands, in a **Chart library**
of everything the knitter has parsed: the Chart, the image it came from, a
thumbnail and the name of the file it was uploaded as, which is editable. The
image is kept because Review's comparison needs it, and because a Re-parse will.
Opening one goes straight to Knit, at the Row the knitter stopped on and reading
the way they were reading it — a fresh parse still lands in Review, because
nothing has checked it yet.

Nothing is ever removed to make room. Persistent storage is asked for before the
first Chart is written, the space left on the device is shown under the library,
and a device that fills up says so and waits for the knitter to delete a Chart —
silent eviction of a Chart that has been corrected is the worst failure this app
can have. A Chart saved by a newer release of the app is refused on load rather
than mis-read, since a later `schema_version` could move Cells under the same
field names.

A Chart that came back the wrong size cannot be corrected Cell by Cell — the
crop caught a number gutter, or missed a Row — so Review can **Re-parse**: the
stored image goes back on the crop step under the rectangle it was parsed with,
and the knitter adjusts it and parses again. *Start over* is the same path from
a blank rectangle. What comes back is a **new Chart beside the old one**, never
over it: a re-grid changes which Cell is which and so discards every Repaint,
and one tap must not be able to destroy an evening of them. Both sit in the
library, each stating its dimensions, until the knitter deletes the worse crop.
Uploading another image is how a chart that will not parse at all is abandoned.

The app installs to the home screen and opens without browser chrome, and a
service worker keeps the shell on the device, so it starts with no connection —
on a train, or in a chair away from wifi. Every Chart already parsed is fully
usable there: open it from the library, Select a Row, read it, advance, and
Repaint a Cell the parser got wrong. Parsing is the one thing that needs the
network, and it says so in a sentence rather than failing obscurely. There is no
background-sync queue to retry an offline upload later, because a knitter parses
a Chart once, at a table, on wifi.

The client is plain ES modules and a canvas in `web/` — no build step, per
[ADR-0004](docs/adr/0004-vanilla-canvas-pwa-client.md). Its pure logic is tested
under Node's own runner, a test-time requirement and never a build step:

```bash
npm test        # node --test "web/*.test.js"
```

The `package.json` those two lines imply holds the release tooling and nothing
else — no bundler, no dependency the browser ever sees.

`POST /api/parse` takes
the image as a multipart upload plus the crop as `x, y, w, h`, and returns the
schema-1 Chart. A parser `ValueError` comes back as a 400 carrying the parser's
own message, because every one of them is something the knitter can act on; an
upload over 20 MB is refused with a 413 rather than truncated and parsed into a
plausible, wrong Chart.

The corpus tests parse the four chart screenshots in `tests/examples/` (in git,
described by [the manifest](tests/examples/MANIFEST.md)); they skip if a file is
missing rather than fail.

## Releases and deployment

A push to `master` runs both suites, and semantic-release reads the
conventional-commit history to decide whether there is a version in it. A `feat`
or `fix` cuts one; a `docs` or `chore` cuts nothing. When a version is cut, the
image is built and pushed to `ghcr.io/macht59/kpp` as `X.Y.Z` and `latest` — and
only after that push succeeds does CI commit the new tag into
`deploy/prod/deployment.yaml`. FluxCD, watching this repository from a private
gitops repo, reconciles the change into the cluster within a minute. There is no
`CHANGELOG.md`; the notes are on the GitHub Release. The whole path is
[ADR-0005](docs/adr/0005-delivery-releases-images-and-flux.md).

`deploy/prod/` holds the Deployment, the Service and a `kustomization.yaml`, and
names no namespace and no hostname — both are supplied from the private repo,
which is also where the `Ingress` lives. Nothing here says where the app is
hosted.

The image runs gunicorn rather than `app.run`, because a parse is seconds of
scipy and a single-threaded server would make the app look offline to the next
request — the one thing this app must not lie about. It also stamps the release
version into the service worker's cache name at build time, so a release hands a
knitter the new shell instead of the cached old one. `python server.py` locally
is untouched by both.

Two limits are known and recorded in the tests rather than papered over.
Yarns used for a handful of Cells in a large Chart merge into their neighbours,
so the 9-colour corpus chart comes back with 7. And `confidence.chart` scores
how cleanly the crop snapped to the lattice and nothing else: a crop drawn
*inside* the Chart is a perfect crop of a smaller Chart, and only the knitter
can catch that.
