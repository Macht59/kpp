# Chart JSON contract

Type: grilling
Status: resolved
Blocked by: 06, 07

## Question

The stateless service takes an image and returns a Chart. That JSON is the seam between the Python parser and the on-device client, and it is the last thing this map has to settle — once it exists, `/to-spec` has a buildable plan.

It comes last deliberately: what the contract *can* carry depends on what [Automatic extraction spike](05-extraction-spike.md), [Overlay layer: outlines and symbols](06-overlay-layer.md), and [Validate the Non-stitch flood-fill rule](07-non-stitch-rule.md) prove extractable.

Settle:

1. **Cell encoding.** A 2D array of Palette indices is the obvious shape — compact, and it keeps Palette and Cells independent so a Colorway can be remapped without touching the grid. Confirm, and decide how **Non-stitch** is represented: a reserved index, a null, or a parallel mask.
2. **Palette representation.** RGB per entry, plus what else? An entry needs identity stable enough that a user renaming it to a real yarn — the Colorway mapping — survives.
3. **Confidence, if it exists.** If [Acceptance bar for automatic extraction](02-acceptance-bar.md) established a self-detection signal and the spike produced one, the contract must carry it, per-Chart or per-Cell. This is the difference between the client being able to flag a doubtful parse and the user discovering it mid-row.
4. **What the client needs that isn't Cells.** Grid dimensions are implied by the array, but the crop rectangle, source image dimensions, and pitch may be needed to overlay the parse back onto the original for correction.
5. **Versioning.** Charts persist on-device across future releases of the service, so a stored Chart will outlive the schema that produced it. Decide the versioning approach now — it is cheap now and expensive later.

**Resolved when** the JSON contract is written down concretely enough to implement on both sides, and the on-device storage shape sitting in the map's fog can graduate.

## Answer

The contract is settled and concrete on both sides. It is the shape the spike ([05](05-extraction-spike.md)) already emits, formalised — no new extraction capability is implied, only a serialisation and the metadata correction needs.

### The contract

```jsonc
{
  "schema_version": 1,                          // Q5 — single integer, starts at 1

  "dimensions": { "rows": 150, "cols": 112 },   // integrity check: MUST equal cells shape.
                                                //   Wrong dims is the one error that fails a chart
                                                //   outright (05), so it is declared, not just implied.

  "palette": [                                  // Q2 — array index IS the identity; -1 is NOT in here
    { "rgb": [255, 255, 255], "name": null },   //   idx 0   (name = Colorway label: null from the
    { "rgb": [20, 20, 20],    "name": null },   //   idx 1    stateless service, filled on-device)
    { "rgb": [178, 96, 72],   "name": null }    //   idx 2
  ],

  "cells": [                                    // Q1 — row-major, image orientation, [0][0] = top-left
    [0, 0, 1, 2, 2, 1],                         //   value >=0 -> palette index
    [0, -1, -1, 2, 2, 1]                        //   -1 -> Non-stitch
  ],

  "reading_direction_default": "rtl",           // Q4 — optional; corpus-derived, seeds the readout
                                                //   toggle, never baked into cells

  "source": {                                   // Q4 — lets the client re-overlay the parse for correction
    "image_width": 1074,
    "image_height": 1428,
    "crop":   [x, y, w, h],
    "pitch":  [8.85, 8.85],                     //   per-axis (the JPEG chart is non-square)
    "origin": [ox, oy],                         //   top-left lattice origin in source px
    "skew_deg": 0.35                            //   deskew applied
  },

  "confidence": {                               // Q3 — optional; two signals, never averaged (02)
    "chart": 0.92,                              //   structural/crop confidence, whole-Chart
    "cells": [ { "r": 44, "c": 17, "score": 0.31 } ]  //   sparse: only Cells flagged for review
  }
}
```

### The five decisions

1. **Cell encoding + Non-stitch.** `cells: int[][]`, row-major in image orientation, `cells[0][0]` = top-left. Reading direction is never stored — it is the per-row readout toggle. **Non-stitch is a reserved sentinel `-1`** in the array: value `>=0` is a Palette index, `-1` is Non-stitch. Not a Palette entry (Non-stitch is *background, not yarn* per `CONTEXT.md`, so it must not appear in the list the user maps to Colorways); not a parallel mask (a second array to keep in sync, and — since v1 auto-detects zero Non-stitch, [07](07-non-stitch-rule.md) — almost entirely empty). The service emits no `-1` in v1; they appear only after the user's on-device flood-fill/tap corrections.

2. **Palette + Colorway identity.** Each entry `{ rgb: [r,g,b], name: string|null }`. **Array index is the identity**; Cells reference the index; `name` is the Colorway label (null from the stateless service, filled on-device). A merge/split rewrites grid + Palette + name-map together atomically on the client, so no separate stable-id scheme is needed. `ponytail:` index-as-identity — add an explicit `id` only if atomic rewrite proves impractical on-device.

3. **Confidence.** Carried, optional, as **two signals that are never averaged** (respecting [02](02-acceptance-bar.md)'s structural-vs-Cell split): `confidence.chart`, a whole-Chart scalar for crop/structural confidence (the sharpest failure mode, [05](05-extraction-spike.md)), and `confidence.cells`, a **sparse** list `[{r, c, score}]` of only the Cells to flag for review. Sparse because most Cells are confident and the list is exactly what a "direct my eye during review" UI consumes. Whether to *render* it is a build/UI call; the contract only carries it. Non-stitch Cells carry no confidence entry.

4. **Provenance beyond Cells.** A `source` block — `image_width`, `image_height`, `crop [x,y,w,h]`, `pitch [px_x, px_y]` (per-axis, the JPEG is non-square), `origin [ox,oy]`, `skew_deg` — so the client can re-overlay the lattice on the original image for the re-crop and grid-nudge corrections ([09](09-correction-vocabulary.md)). Plus optional top-level `reading_direction_default` (`"ltr"|"rtl"`): corpus-derived data the client can't re-derive, seeding the readout toggle without touching `cells`.

5. **Versioning.** A single top-level integer `schema_version`, starting at `1`. The one thing that cannot be added retroactively is the version field itself. On-device migration is a client concern. `ponytail:` skip semver / per-field versions / content negotiation until a second version actually ships.

`dimensions` is stated redundantly (derivable from `cells`) as a cheap integrity check, because wrong dimensions is the one error that fails a chart outright ([05](05-extraction-spike.md)).

### What this hands forward

- **The map's spine is complete** — the parsing strategy now has a concrete seam between the Python parser and the on-device client.
- **[09](09-correction-vocabulary.md)** gets the fields its capabilities need: `crop` + `pitch` + `origin` + `skew_deg` for re-crop/grid-nudge overlay, the `palette` array for merge/split remapping, and the `-1` sentinel for the mark-Non-stitch tool.
- **On-device storage shape** is ruled out of scope — the contract (schema + `schema_version`) gives the client everything it needs; the IndexedDB schema / eviction is a build decision, symmetric with client-framework and readout-UI which are already out of scope.
- **App-surfaces-uncertainty** collapses: the contract-carrying half is decided here (Q3); the rendering half is a build/UI call.

No new tickets, no ADR (the design is recorded here; the load-bearing constraints already have ADRs 0001–0003). `CONTEXT.md` unchanged — the contract is implementation, and its domain terms (Non-stitch, Colorway, Palette, Cell) are already in the glossary.
