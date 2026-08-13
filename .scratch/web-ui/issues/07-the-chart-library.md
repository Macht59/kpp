# 07 — The Chart library on the device

**What to build:** A knitter has more than one project on the go, and they do
not want to re-upload, re-crop and re-wait every time they sit down. Charts
they have parsed stay on the device, alongside the images they came from, and
the app opens straight back to the Row they stopped on.

Charts persist on the device, not on the server
([ADR-0003](../../../docs/adr/0003-stateless-service-on-device-charts.md)).
Each stored Chart holds: the schema-1 Chart, the source image, a name
auto-filled from the uploaded filename, a thumbnail, the Construction and
starting Reading direction, and the **Selected Row**.

The source image is kept because both [ticket 05](05-review-a-parse.md)'s
comparison and [ticket 08](08-re-parse-and-start-over.md)'s Re-parse need it
later. That makes storage megabytes rather than kilobytes, which is why quota
is handled explicitly.

**Silent eviction of a corrected Chart is the worst failure this app can
have.** Browsers evict under storage pressure without asking, so persistence is
requested explicitly, remaining quota is visible, and exhaustion is reported to
the knitter rather than resolved behind their back. There is no automatic
eviction policy — the knitter deletes a Chart.

This ticket also sets the landing rules: a fresh parse opens in Review because
it is unverified; a Chart opened from the library goes straight to Knit,
because that is why the knitter opened it.

Persisting the Selected Row is **not** the Row progress tracking deferred to
v2 — that feature is history, completion marks and per-project sessions. This
is one integer remembering a cursor, and without it a knitter who stops at Row
88 reopens at Row 1.

Stored Charts outlive the service release that produced them, so
`schema_version` is checked on load.

**Blocked by:** 03 — Select a Row and read its Runs; 05 — Review a parse
against its image.

**Status:** resolved

- [x] A parsed Chart and its source image are kept on the device
- [x] The library holds many Charts and a knitter can move between them
- [x] Each Chart is named from the uploaded filename and can be renamed
- [x] Each Chart shows a thumbnail of its source image in the library
- [x] A knitter can delete a Chart
- [x] Persistent storage is requested explicitly and remaining quota is shown
- [x] Exhausted storage is reported to the knitter, who deletes a Chart — nothing is evicted silently or automatically
- [x] The Selected Row is remembered per Chart and restored on reopening
- [x] Construction and starting Reading direction are remembered per Chart
- [x] A fresh parse lands in Review; a Chart opened from the library lands in Knit
- [x] An unrecognised `schema_version` is reported on load rather than mis-read

## Comments

`library.js` is the storage concern and holds nothing else — the Chart logic it
stores is `chart.js`'s and the drawing is `app.js`'s. IndexedDB, no wrapper: the
whole surface used here is `add`, `get`, `getAll`, `put` and `delete` behind one
`run(stores, mode, work)` helper that resolves when the transaction commits, so
a failure part way through leaves nothing half-written.

**Two object stores, not one.** The Chart record is rewritten every time the
knitter advances a Row, and the source image is megabytes; keeping them in one
record would copy the image on every tap of *Next row*. `charts` holds the
Chart, the name, the thumbnail, the Selected Row and the Reading; `images` holds
the source blob under the same key. Both are written in a single transaction
when a Chart is kept, so a Chart can never exist without its image.

A parse is kept the moment it lands rather than when the knitter leaves Review:
ten minutes of reviewing and a closed tab would otherwise cost the parse and the
ten minutes both. Everything after that goes back through `remember`, called
from `drawRow` — which is the one function every change of Cells, cursor or
Reading ends with, so no state can drift out of the record without a second
place remembering to save it.

The Reading is stored whole, Flips included, rather than as the two fields the
ticket lists. It is one value in the code and the knitter who Flipped Row 88 by
hand did so because the alternation had slipped, which is still true tomorrow.

**Quota is shown, never acted on.** `navigator.storage.persist()` is called at
startup — before the first Chart exists, since a browser evicting under pressure
does not ask — and the space left sits under the library as a number the knitter
can watch fall. `QuotaExceededError` becomes a message naming the fix (delete a
chart) and saying explicitly that nothing was deleted for them. There is no
eviction path in this module at all: `forget` is only ever reached from the
delete button, behind a confirm.

`isReadable` is in `chart.js` with the other pure functions and is the one part
of this ticket under test — a stored Chart whose `schema_version` is not 1 is
refused with a message rather than drawn, because a later schema could move
Cells under these very field names and a Chart read wrong is a Chart knitted
wrong. The rest is storage and DOM, which the spec's testing decisions leave to
the eye.

Thumbnails are generated on save with `createImageBitmap` into an
`OffscreenCanvas` at 160 px, so listing the library decodes kilobytes rather
than the megabytes of every source image at once.

Landing rules are now both in place: a fresh parse calls `setMode(REVIEW)`
because nothing has checked it, and `openChart` calls `setMode(KNIT)` because
that is what the knitter opened it for.

Review turned up one path that lost a correction and it is fixed here rather
than banked: a paint drag ended by a second finger landing cleared `painting`
without redrawing, so the Repaint stayed in `chart` and never reached the
Readout or the device. Both endings now go through `stopPainting`. Also from
review: `spaceLeft` returns null rather than 0 where the browser will not
estimate, since "0 MB free" to a knitter with a half-empty phone is the same lie
in the other direction, and the library's own buttons report a storage failure
instead of doing nothing.
