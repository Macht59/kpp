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

**Status:** ready-for-agent

- [ ] A parsed Chart and its source image are kept on the device
- [ ] The library holds many Charts and a knitter can move between them
- [ ] Each Chart is named from the uploaded filename and can be renamed
- [ ] Each Chart shows a thumbnail of its source image in the library
- [ ] A knitter can delete a Chart
- [ ] Persistent storage is requested explicitly and remaining quota is shown
- [ ] Exhausted storage is reported to the knitter, who deletes a Chart — nothing is evicted silently or automatically
- [ ] The Selected Row is remembered per Chart and restored on reopening
- [ ] Construction and starting Reading direction are remembered per Chart
- [ ] A fresh parse lands in Review; a Chart opened from the library lands in Knit
- [ ] An unrecognised `schema_version` is reported on load rather than mis-read
