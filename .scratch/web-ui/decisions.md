# Web UI — grilling decisions

Feature: web-ui
Status: frontier empty, ready for `/to-spec`
Source: a `/grill-with-docs` session, five rounds, 28 questions

The client half of kpp: upload a chart screenshot, parse it, Knit from it.
The parsing half is already settled — see [the parsing spec](../chart-parsing/spec.md)
and [ticket 08](../chart-parsing/issues/08-chart-contract.md) for the contract
this consumes.

## Shape

One FastAPI app serves the static client and `POST /parse` same-origin. The
client is a no-build vanilla + canvas PWA ([ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md)).
Charts and their source images live in IndexedDB per [ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md).

Layout: `kpp/` keeps the parser untouched, `kpp/web/` holds the FastAPI app,
`web/` holds static files mounted with `StaticFiles`. New dependencies:
`fastapi`, `uvicorn`, `python-multipart`. `parse_chart` stays the seam —
nothing about serving reaches into it.

## The two modes

A Chart is either being **Reviewed** or **Knit**. Both terms are now in
`CONTEXT.md`, along with **Construction**, **Reading direction**, **Repaint**,
**Re-parse** and **Chart library** — the terms [ticket 09](../chart-parsing/issues/09-correction-vocabulary.md)
deliberately banked "for when the build effort starts".

**Review** — whole-Chart pan/zoom canvas with a toggle to the stored source
image. This is both the accept step after a parse and a mode returnable to
later; they are one surface, not two. Dimensions, Palette swatch count and
`confidence.chart` are on screen here, because [ticket 05](../chart-parsing/issues/05-extraction-spike.md)
established those are the errors that cannot be corrected, only redone — and
this is the one moment the knitter is comparing against the original rather
than knitting. Repaint is Palette-bar-first: pick an entry, then tap or drag
across Cells.

**Knit** — three stacked bands, all fit-width, **no zoom anywhere**:

1. a slim whole-Chart overview with the Selected Row marked — orientation, a
   sense of how far through you are, and the tap target for jumping Rows;
2. the Selected Row, fit-width, rendered as colour **bands** rather than Cells;
3. the **Readout**, the primary surface: the Row's Runs as large chips in
   reading order, swatch plus count, with a cursor on the current Run.

Advance is a pair of large Next/Previous Row buttons under the Readout; a
knitter advancing 150 times needs a target they can hit without looking, and a
swipe would fight the overview's scroll. Tap a Row in the overview to jump.

Repaint is allowed **on the Selected Row only**, and reaches it through the
**Run chip** rather than the Cell — tap a chip, pick a Palette entry. Knit mode
has no zoom, so no Cell is tappable; a chip is. This is the same ticket 09
primitive ("a Cell *or a contiguous span*") with a different handle. The
correction a knitter actually makes is the one they are looking straight at,
and forcing a mode switch for it means it doesn't get made.

The two modes differ in **navigation model**, not just in which tools are
enabled: Knit moves a Row at a time and never zooms, because the counts are in
words and detail is never needed. Review pans and zooms freely and has no Row
strip, because it is a survey, not a position.

A fresh parse lands in Review; opening a Chart from the library lands in Knit.

### Why Knit mode is Readout-primary

Recorded because the obvious design fails on arithmetic, and the next person
to look at this will propose it again.

A phone viewport is ~360 usable CSS px. The corpus's hard case is
`112w150h.png`: fit-width gives **3.2 px per Cell** — fine as a picture,
far below the 44pt/48dp touch minimum. The tempting fix is a *zoomed* strip of
the Selected Row, but a strip is also 360px wide, so it isn't zoomed at all
unless it scrolls horizontally — and at a merely legible 12px per Cell that is
1,344px, **3.7 screen-widths per Row, 150 times**. At a tappable 44px it is
13.7 screen-widths.

The premise behind that design is wrong: a knitter does not read Cells, they
knit **Runs**. A Row of 112 Cells is typically 5–15 Runs; fifteen 44px chips
is 660px of *vertical* scroll, which is free on a phone. What does not fit
horizontally fits trivially once Cells stop being the rendered unit.

A side effect worth keeping: the common parse error is **more** visible as a
Readout than as a Chart. A single mis-sampled Cell mid-Run appears as a stray
`1` chip between two chips of the same colour — conspicuous among eight, one
dot among 112 as pixels. One tap merges it back. (A wrong Cell *at* a Run
boundary only shifts a count, and is invisible either way.)

Note the layout must span **8 → 112 columns** — `8w37h.png` is eight Cells
across. Bands and chips handle both; a Cell-based strip handles neither end
well.

## Reading direction and Construction

`parser.py` deliberately omits `reading_direction_default` — the gutter numbers
it would be read from sit outside the knitter's crop — so the client decides.

A Chart carries a **Construction** (`flat` | `in the round`) and a starting
Reading direction. Flat turns the work every Row, so direction alternates as
you advance; in the round never turns, so it stays constant. The per-Row
toggle survives as a manual override for when the alternation slips.

Naming: `ReadingDirection` was proposed for the flat/in-the-round rule and
rejected — ticket 08's contract already uses *reading direction* for ltr/rtl,
so one name would have had two valid answers and the per-Row override would
have been unnameable. **Construction** names the real-world cause and is the
knitter's own word.

## Readout

One **chip per Run**, in reading order: coloured swatch plus count, with the
Colorway name where set and a positional label ("Colour A") where not — the
service emits `name: null`. Chips are the primary surface of Knit mode and the
Repaint handle, so they are sized to be tapped (44pt/48dp floor), not sized to
be read. Row number and Row total shown.

**Non-stitch Runs are skipped entirely**: they aren't stitches, so speaking
them corrupts the count the knitter is following.

## Upload, crop, parse

Crop is a mandatory drag-a-rectangle step, with a *use whole image* button for
an already-cropped screenshot — that is just `crop = (0, 0, W, H)`, which
`_validated_crop` accepts. A one-line hint about excluding number gutters;
no snap-to-lattice assist.

`ponytail:` no crop assist — `_recover_lattice` already snaps the crop to the
comb internally and `confidence.chart` reports how well it landed. Add snap
only if that number routinely disappoints on real use.

`POST /parse` is synchronous: upload, block ~10s, return the Chart, with an
honest progress state, a 30s timeout, and a 20 MB request limit that rejects
rather than truncates. One user at a time — a job endpoint is infrastructure
for a concurrency problem that doesn't exist. Apply the deskew downsample
[ticket 05](../chart-parsing/issues/05-extraction-spike.md) measured (~10s → ~1s).

## Failure and doubt

Three distinct cases, surfaced three ways:

- **Hard failure** — `_validated_crop` or `_recover_lattice` raises. Show the
  message, return to the crop step unmodified.
- **Low `confidence.chart`** — a Chart came back but the crop may be off by a
  Cell. Banner on the Chart linking to Re-parse.
- **Silently merged Palette** — the README records rare yarns merging into
  neighbours (the 9-colour corpus chart returns 7). No error, no low
  confidence. Nothing automatic is possible, so Review shows the swatch count
  plainly where a knitter who knows their pattern will notice.

## Persistence

A **Chart library**: many Charts, each with its source image kept for
Re-parse and for the Review-mode comparison. Auto-named from the uploaded
filename, editable, thumbnailed from the stored image. Call
`navigator.storage.persist()` and show remaining quota — silent eviction of a
corrected Chart is the worst failure this app has. No automatic eviction: on
quota exhaustion, say so and let the knitter delete a Chart.

**Re-parse writes a new Chart into the library** rather than replacing the old
one. [Ticket 09](../chart-parsing/issues/09-correction-vocabulary.md) §5 discards
Repaints across a re-grid by design; with a library that costs nothing to make
non-destructive, and it lets the knitter compare two crops.

The **Selected Row persists per Chart**. This is explicitly *not* the Row
progress tracking the parsing map defers to v2 — that feature is history,
completion marks and per-project sessions. This is one integer remembering a
cursor, and without it a knitter who stops at Row 88 reopens at Row 1.

## Offline

Service worker caches the app shell. Every stored Chart is fully usable
offline — Select, Readout, advance, Repaint. Parsing needs the network and
says so. No background-sync queue for a once-per-Chart operation.

## Scope: three of ticket 09's six capabilities

Shipping **1** (Repaint a selection), **5** (adjust `source` and Re-parse) and
**6** (start over). Repaint is the ask; Re-parse is non-negotiable because
crop is the fragile step and structural errors have no other fix; start over
is the zero case of 5.

Deferred, explicitly and not silently: **2** flood-fill-from-tap (needs the
Non-stitch story, which Knitting from a Readout does not), **3** the sparse
per-Cell review list (an optimisation over looking at the Chart — note the
whole-Chart `confidence.chart` scalar is a different signal and *is* shipping),
**4** Palette add/remove/recolour (matters once Colorways are being mapped).

## Not yet decided

**Hosting.** Deliberately deferred: the build runs locally, and nothing in the
client changes between hosting choices, so this is not on the critical path.
When it is committed to, an always-on small instance beats scale-to-zero — a
cold start pulling a SciPy image on top of a 10s parse is a long wait for the
one request a knitter makes per Chart. **Write ADR-0005 then**, not now; an
ADR for an uncommitted decision is a guess with a number on it.

**Chip sizing and how many fit before scrolling.** Tuning, not design — done
in `/implement` with a real corpus chart on screen. The layout question this
replaces (an unreadable Cell-based Row strip) was resolved by arithmetic
rather than by prototype; see *Why Knit mode is Readout-primary* above.
