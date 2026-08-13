# Web UI — v1 spec

Status: ready-for-agent
Feature: web-ui
Collapsed from: [decisions.md](decisions.md) (five grilling rounds, frontier empty)

Consumes the schema-1 Chart contract from
[chart-parsing ticket 08](../chart-parsing/issues/08-chart-contract.md) and the
correction vocabulary from [ticket 09](../chart-parsing/issues/09-correction-vocabulary.md).
Constrained by [ADR-0001](../../docs/adr/0001-parsing-on-the-backend.md),
[ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md) and
[ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md). Vocabulary is
`CONTEXT.md`; this spec uses it throughout.

## Problem Statement

A knitter has a colorwork chart as an image on their phone — a screenshot of a
published pattern. `parse_chart` can already turn that into a Chart, but there
is no way for a knitter to reach it: no way to upload an image, no way to draw
the crop the parser requires, no way to see or correct the result, and no way
to read a Row.

So the knitter is still working from the picture. They track their place by eye
across hundreds of tiny squares, counting Runs of same-coloured Cells one Row
at a time, on a phone screen where a Cell is a few pixels across. They lose
their place. They miscount. When they put the work down and pick it up an hour
later, nothing remembers where they were.

## Solution

A mobile-first web app, no accounts, served by the same process that parses.

The knitter uploads a chart image, drags a rectangle around the grid (or taps
*use whole image* if it is already cropped), and waits about ten seconds. What
comes back is a Chart they **Review** against the original, correct where the
parse got it wrong, and then **Knit** from.

Knit mode is the point of the app. The knitter Selects a Row and gets a
**Readout** — the Row's Runs as large chips in reading order, "3 white, 4
yellow, 5 brown, 3 white" — with big Next and Previous Row buttons. Reading
direction flips automatically each Row when the garment's **Construction** is
flat, and stays constant when it is in the round. Charts and the images they
came from are kept on the device, so the app opens straight back to the Row the
knitter stopped on, and works with no connection.

## User Stories

**Getting a chart in**

1. As a knitter, I want to pick a chart image from my phone, so that I can turn a pattern I already own into something readable.
2. As a knitter, I want to drag a rectangle around the grid, so that the number gutters are excluded and the Cell count comes out right.
3. As a knitter, I want a *use whole image* button, so that an already-cropped screenshot needs no fiddling.
4. As a knitter, I want a hint that number gutters must be outside the rectangle, so that I don't make the one mistake that quietly breaks the parse.
5. As a knitter, I want to see progress while the chart is parsing, so that I don't think the app has frozen during the ten seconds it takes.
6. As a knitter, I want an oversized image to be refused with a clear message, so that I am not left waiting on an upload that will never succeed.
7. As a knitter, I want a failed parse to tell me what went wrong and put me back on the crop step with my rectangle intact, so that I can adjust rather than start from nothing.

**Reviewing a parse**

8. As a knitter, I want every new parse to open in Review, so that I check it before I trust it.
9. As a knitter, I want the Chart's dimensions shown, so that I can compare them against what the pattern says and catch the one error that cannot be corrected.
10. As a knitter, I want the number of Palette entries shown, so that I notice when a nine-colour pattern came back as seven.
11. As a knitter, I want a warning when the parser is unsure the crop snapped cleanly, so that I Re-parse rather than knit a Chart that is a Cell out.
12. As a knitter, I want to toggle between the Chart and the image it came from, so that I can compare them directly.
13. As a knitter, I want to pinch and pan freely around the whole Chart, so that I can survey it at whatever zoom the comparison needs.
14. As a knitter, I want to pick a Palette entry and tap Cells to Repaint them, so that I can fix Cells the parser got wrong.
15. As a knitter, I want to drag across several Cells while Repainting, so that fixing a whole Run is one gesture rather than twelve taps.
16. As a knitter, I want to leave Review and start knitting, so that reviewing is a step and not a destination.
17. As a knitter, I want to return to Review from Knit at any time, so that a mistake I notice mid-project is fixable.

**Re-parsing and starting over**

18. As a knitter, I want to adjust the crop and parse again, so that a structural error — wrong dimensions — can be redone.
19. As a knitter, I want a Re-parse to produce a new Chart rather than overwrite the old one, so that twenty minutes of Repaints are not destroyed by one tap.
20. As a knitter, I want to compare the two parses in my library, so that I can tell which crop was better before deleting either.
21. As a knitter, I want to abandon a parse entirely and upload a different image, so that there is a way out when the chart simply won't parse.

**Knitting**

22. As a knitter, I want to Select a Row and see its Readout, so that I am told "3 white, 4 yellow" instead of counting squares.
23. As a knitter, I want each Run as a large chip with a colour swatch and a count, so that I can read it at arm's length with the phone propped up.
24. As a knitter, I want a large Next Row button, so that I can advance without aiming, with needles in my hands.
25. As a knitter, I want a Previous Row button, so that I can go back when I have miscounted.
26. As a knitter, I want the Selected Row drawn full width as colour bands, so that I can confirm the words match the picture at a glance.
27. As a knitter, I want a slim view of the whole Chart with my Row marked, so that I can see how far through I am.
28. As a knitter, I want to tap a Row in that overview to jump to it, so that losing my place is recoverable.
29. As a knitter, I want the Row number shown, so that I can match it against the printed pattern.
30. As a knitter, I want the Row's total Cell count shown, so that I can check my own count against it at the end of a Row.
31. As a knitter, I want to set whether the garment is knitted flat or in the round, so that the app knows whether reading direction alternates.
32. As a knitter, I want reading direction to flip automatically each Row when I am knitting flat, so that I don't perform the same mechanical toggle a hundred and fifty times.
33. As a knitter, I want to override the direction on a single Row, so that I can recover when the alternation has slipped.
34. As a knitter, I want the current reading direction shown unmistakably, so that I never knit a Row backwards.
35. As a knitter, I want Non-stitch Runs left out of the Readout, so that the counts I am following are counts of actual stitches.
36. As a knitter, I want to tap a Run chip and Repaint it, so that a Cell the parser got wrong can be fixed without leaving the Row I am knitting.
37. As a knitter, I want a stray one-Cell Run to be visible in the Readout, so that parse errors announce themselves instead of hiding among the pixels.

**Keeping charts**

38. As a knitter, I want my Charts kept on the device, so that I don't re-upload and re-crop every time I sit down.
39. As a knitter, I want the source image kept too, so that Re-parse and the Review comparison still work later.
40. As a knitter, I want a library of Charts, so that I can have more than one project on the go.
41. As a knitter, I want each Chart named from the file I uploaded, so that I recognise it without typing anything.
42. As a knitter, I want to rename a Chart, so that I can correct a meaningless filename.
43. As a knitter, I want a thumbnail of the original image in the library, so that I can find the right Chart by sight.
44. As a knitter, I want to delete a Chart, so that I can reclaim space when a project is finished.
45. As a knitter, I want to be told when device storage is full rather than silently losing a Chart, so that a corrected Chart is never destroyed behind my back.
46. As a knitter, I want the app to open a Chart at the Row I stopped on, so that picking the work back up takes no thought.
47. As a knitter, I want opening a Chart from the library to go straight to Knit, so that the app matches why I opened it.

**Away from the desk**

48. As a knitter, I want to install the app to my home screen, so that it opens like an app rather than a bookmark.
49. As a knitter, I want to Knit from a stored Chart with no connection, so that I can work on a train or in a chair away from wifi.
50. As a knitter, I want Repaint to work offline too, so that a correction is never blocked by a missing network.
51. As a knitter, I want to be told plainly that parsing needs a connection, so that an offline upload fails understandably instead of obscurely.

## Implementation Decisions

### Delivery

One process serves both the static client and the parse endpoint, same-origin.
No CORS, no second deployable, no separate origin configuration. The client is
static files, so splitting later is cheap if it is ever wanted.

The parsing package is not touched. `parse_chart(image, crop) -> Chart` remains
the seam; the web layer is a caller of it and nothing about serving reaches
inside it. New dependencies are limited to the HTTP framework, its server, and
multipart form support.

### The parse endpoint

A single `POST` taking the image as a multipart upload plus the crop rectangle
as `x`, `y`, `w`, `h`, returning the schema-1 Chart as JSON.

- **Synchronous.** Upload, block, return. One knitter at a time; a job endpoint
  with polling is infrastructure for a concurrency problem that does not exist.
  If parse time ever becomes the complaint, a job endpoint is a contained
  change behind the same button.
- **Request size limit** — 20 MB, enforced by rejecting with a 413 rather than
  truncating the body. A truncated image would parse into a plausible, wrong
  Chart, which is far worse than a refusal.
- **`ValueError` from the parser maps to 400**, with the parser's own message
  passed through. Both parser failures are user-actionable — the crop was
  outside the image, too small, or contained no recoverable grid — so the
  message is the useful thing to show. Anything else is a 500.
- **Client-side timeout of 30 s**, against a measured ~10 s parse.
- The deskew downsample measured in
  [ticket 05](../chart-parsing/issues/05-extraction-spike.md) is applied, taking
  the parse from ~10 s toward ~1 s.

### Client architecture

Plain ES modules, a canvas, and a service worker. No framework, no bundler, no
package manifest — reasoned in [ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md).
The UI is a canvas plus a handful of controls over a single Chart object; a
framework's leverage is diffing an element tree this app does not have.

Structure separates three concerns:

- **Chart logic** — pure functions over the Chart contract, no DOM, no canvas,
  no storage. This is the module under test (see Testing Decisions).
- **Rendering and gesture handling** — canvas drawing and hit-testing.
- **Storage** — the Chart library.

### The two modes

A Chart is either being **Reviewed** or **Knit**. They differ in navigation
model, not merely in which tools are enabled.

| | Knit | Review |
|---|---|---|
| Movement | one Row at a time | free pan |
| Zoom | none | pinch, whole Chart |
| Chart shown | slim overview + Selected Row | whole Chart at chosen zoom |
| Primary surface | the Readout | the Chart |
| Repaint handle | the Run chip | the Cell, tap or drag |

A fresh parse lands in Review — it is unverified, and Review *is* the accept
step required by [ticket 02](../chart-parsing/issues/02-acceptance-bar.md)'s
"every parse is reviewed". Opening a Chart from the library lands in Knit. A
persistent switch moves between them.

### Knit mode layout

Three stacked full-width bands, no zoom in any of them: the slim whole-Chart
overview with the Selected Row marked; the Selected Row drawn as colour bands;
the Readout. Next and Previous Row buttons sit under the Readout, sized to be
hit without looking. Tapping a Row in the overview jumps to it.

**The Readout is the primary surface, not the Chart.** This is the spec's least
obvious decision and the arithmetic behind it is load-bearing:

A phone viewport is ~360 usable CSS px. Against the corpus's widest chart, 112
Cells, fit-width gives **3.2 px per Cell** — a fine picture, far under the
44pt/48dp touch minimum. A *zoomed* strip of the Selected Row does not fix
this, because the strip is also 360 px wide: it is only zoomed if it scrolls
horizontally, and at a merely legible 12 px per Cell that is 1,344 px — 3.7
screen-widths per Row, 150 times over. At a tappable 44 px it is 13.7.

The premise is wrong: a knitter does not read Cells, they knit **Runs**. A Row
of 112 Cells is typically 5–15 Runs, and fifteen 44 px chips is 660 px of
*vertical* scroll, which is free on a phone. What does not fit horizontally
fits trivially once Cells stop being the rendered unit. The layout must also
span 8 to 112 columns — the corpus's narrowest chart is 8 Cells wide — and
bands and chips handle both ends where a Cell-based strip handles neither.

A consequence worth keeping: the common parse error is *more* visible as a
Readout than as a Chart. A single mis-sampled Cell mid-Run appears as a stray
`1` chip between two chips of the same colour — conspicuous among eight, one
dot among 112 as pixels. One tap merges it back. (A wrong Cell at a Run
boundary only shifts a count and is invisible either way.)

### Row numbering and orientation

The contract stores `cells` in **image orientation**, `cells[0][0]` top-left.
Knitting charts are conventionally worked **bottom to top**, so displayed Row 1
is the *last* array Row, and *Next Row* moves **up** the image. The mapping
between knitter Row number and array index is a single inversion and belongs in
the chart-logic module, applied once, so nothing else in the client has to
think about it. See Further Notes — this is a convention, not a decision the
knitter confirmed.

### Construction and reading direction

A Chart carries a **Construction** (`flat` | `in the round`) and a starting
**Reading direction**. Flat turns the work every Row, so direction alternates
as the knitter advances; in the round never turns, so it stays constant. A
per-Row manual override survives for when the alternation slips.

Both are client-side and per-Chart. The service cannot supply them:
`reading_direction_default` is deliberately omitted by the parser, because the
gutter numbers it would be read from sit outside the knitter's crop. Defaults
are `flat` and right-to-left, set at the Review step and changeable in Knit.

Reading direction affects the Readout only. It is never written into `cells`.

### The Readout

One chip per Run in reading order: colour swatch plus Cell count. Chips are
sized to be tapped, not merely read. Row number and Row total are shown.

**Non-stitch Runs are omitted entirely** — they are background, not yarn, so
speaking them corrupts the count the knitter is following.

Palette entries carry a `name` for the Colorway, but nothing in v1 sets it
(Palette editing is deferred, below), so the service's `null` stands and chips
render a positional label — "Colour A" — beside the swatch. The chip honours
`name` when present, so a later Colorway feature needs no Readout change.

### Repaint

One primitive, two handles, per
[ticket 09](../chart-parsing/issues/09-correction-vocabulary.md)'s "a Cell *or
a contiguous span*":

- **Review**: Palette-bar-first. Pick an entry, then tap a Cell or drag across
  several. Palette-bar-first is what makes span repaint natural — choose the
  colour once, drag across the wrong Run — and it keeps Repaint and pan from
  competing for the same gesture.
- **Knit**: the Selected Row only, through the **Run chip**. Knit mode has no
  zoom, so no Cell is tappable; a chip is. Tap a chip, pick an entry.

Repainting `-1` (Non-stitch) is possible in principle since it is just a
paintable value, but v1 exposes no control for it — see Out of Scope.

### Re-parse and start over

**Re-parse writes a new Chart into the library** rather than replacing the
original. Ticket 09 discards Repaints across a re-grid by design, because
re-gridding changes which Cell is which; with a library that costs nothing to
make non-destructive, and it lets the knitter compare two crops before deleting
either. *Start over* is the same operation from a blank crop.

### Storage

Charts and their source images live on the device
([ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md)),
keyed per Chart, holding: the schema-1 Chart, the source image, a name
auto-filled from the uploaded filename, a thumbnail, the Construction and
starting Reading direction, and the **Selected Row**.

Persistent storage is requested explicitly and remaining quota is shown. There
is no automatic eviction policy: on exhaustion the app says so and the knitter
deletes a Chart. Silent eviction of a corrected Chart is the worst failure this
app can have, and is the specific thing this avoids.

Charts stored on-device outlive the service release that produced them, so
`schema_version` is checked on load and an unrecognised version is reported
rather than mis-read.

### Offline

A service worker caches the app shell. Every stored Chart is fully usable
offline — Select, Readout, advance, Repaint. Parsing requires the network and
says so plainly. No background-sync queue: it is infrastructure for a
once-per-Chart operation.

A web app manifest makes the app installable to the home screen.

### Failure and doubt

Three distinct cases, surfaced three different ways, because they are not the
same kind of problem:

- **Hard failure** — the parser raised. Show the message, return to the crop
  step with the rectangle intact.
- **Low `confidence.chart`** — a Chart came back, but the crop may be off by a
  Cell. Banner on the Chart linking to Re-parse.
- **Silently merged Palette** — the README records rare yarns merging into
  their neighbours; the nine-colour corpus chart returns seven, with no error
  and no low confidence. Nothing automatic is possible, so Review shows the
  swatch count plainly where a knitter who knows their pattern will notice.

Dimensions and Palette size are both on screen at the Review step because
[ticket 05](../chart-parsing/issues/05-extraction-spike.md) established those
are the errors that cannot be corrected, only redone — and Review is the one
moment the knitter is comparing against the original rather than knitting.

## Testing Decisions

**What makes a good test here:** assert on external behaviour — what the
knitter or the client depends on — never on internals. For the endpoint that
means status codes and contract shape, not how the framework parsed the form.
For the chart logic it means the Runs that come out of a Row, not how they were
accumulated. Canvas pixels, gesture handling and storage are deliberately
untested; nothing in the correction vocabulary depends on asserting a pixel,
and they are cheap to check by eye.

**Two seams, and they cannot be collapsed into one.**

### Seam 1 — the parse endpoint (Python)

Exercised with the framework's test client. `parse_chart` is already covered
against the corpus, so this seam tests only what the endpoint adds:

- a well-formed request returns the schema-1 contract, unchanged from what
  `parse_chart` produced;
- a crop outside the image, or too small, returns 400 with the parser's
  message — not a 500;
- an image with no recoverable grid returns 400, not a 500;
- an oversize body is rejected with 413 rather than truncated and parsed;
- a request missing the image or any crop field is rejected.

Prior art: the existing corpus test asserts at the contract and skips when
corpus images are absent. This seam follows both conventions — a corpus image
is the natural fixture for the success case, and its absence should skip rather
than fail.

### Seam 2 — chart logic (JavaScript)

A single module of pure functions over the Chart contract, run under Node's
built-in test runner. No package manifest, no dependency, no bundler: ES
modules run natively and the runner ships with the platform. Node is a
**test-time** requirement only and never a build step, which is what keeps this
consistent with [ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md).

This logic cannot move to Python: stored Charts are fully usable offline, so it
runs on the device.

Roughly three functions, tested against hand-written Chart fixtures small
enough to read in the test file:

- **Runs of a Row** — consecutive Cells sharing a Palette entry collapse into
  one Run with a count; right-to-left reverses the order; Non-stitch Cells are
  omitted and, critically, **split the Runs around them rather than joining
  across** them; a Row of one colour is one Run; a Row of alternating colours
  is a Run per Cell.
- **Reading direction of a Row** — derived from Construction, the starting
  direction, and the Row number; alternates under flat, constant under in the
  round; a per-Row override wins over both.
- **Repaint** — a Cell or a span takes a new Palette entry; the returned Chart
  is a new value rather than a mutation; a Repaint that makes two neighbouring
  Runs the same colour merges them in the next Readout; indices outside the
  Chart are rejected rather than silently clamped.

Row-number inversion (displayed Row 1 is the bottom of the image) is part of
this module and is tested here, once, so no other test needs to know about it.

## Out of Scope

- **Three of ticket 09's six correction capabilities**, deferred explicitly
  rather than silently: **flood-fill-from-tap**, which needs the Non-stitch
  story that Knitting from a Readout does not; the **sparse per-Cell review
  list**, an optimisation over looking at the Chart — note the whole-Chart
  `confidence.chart` scalar is a different signal and *is* in scope; and
  **Palette add / remove / recolour**, which matters once Colorways are being
  mapped and not before. Repaint to `-1` has no control for the same reason
  flood-fill does not.
- **Colorway naming.** The contract carries `name`; nothing in v1 writes it.
- **Browser and end-to-end tests.** Canvas rendering, pinch-zoom and tap
  hit-testing are expensive to drive and cheap to eyeball.
- **Hosting and deployment.** The build runs locally. Nothing in the client
  changes between hosting choices, so this is not on the critical path; see
  Further Notes.
- **Row progress tracking** — history, completion marks, per-project sessions.
  Remains the v2 feature the parsing map deferred. Persisting the Selected Row
  is a cursor, not this.
- **Accounts, sync, sharing, server-side storage.** Ruled out by
  [ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md).
- **Automatic Non-stitch detection** and **reading the symbol layer as
  shaping** — both already out of scope on the parsing map.
- **Edit preservation across a Re-parse.** Ticket 09 banked this for v2; the
  new-Chart-per-Re-parse decision makes it much less pressing.

## Further Notes

**Two assumptions made rather than confirmed.** Both are stated here so they
are visible rather than buried in code:

1. **Row numbering runs bottom to top.** Knitting charts are conventionally
   worked from the bottom Row upward, so displayed Row 1 is the last array Row
   and *Next Row* moves up the image. This was not put to the knitter during
   grilling — it surfaced while writing the spec. It is a single inversion in
   one module, so reversing it is cheap, but it is worth confirming before
   `/implement` because getting it backwards makes the whole app read wrong.
2. **Construction defaults to flat, starting direction to right-to-left.**
   Right-to-left matches both the knitting convention and the corpus, where two
   of four charts number right-to-left. Flat is the weaker half of the guess —
   stranded colorwork is often worked in the round — but it is one control the
   knitter sets at Review.

**Hosting, when it is committed to.** An always-on small instance beats
scale-to-zero here: a cold start pulling a SciPy-sized image on top of a ten
second parse is a long wait for the one request a knitter makes per Chart. That
is a real trade-off with a surprising answer, so it earns an ADR — but only
once it is actually chosen. An ADR for an uncommitted decision is a guess with
a number on it.

**Chip sizing** — how large a chip is, how many fit before scrolling — is
tuning, done during implementation with a real corpus chart on screen, not a
design question needing a prototype. The layout question it replaces was
resolved by arithmetic; see *Knit mode layout*.
