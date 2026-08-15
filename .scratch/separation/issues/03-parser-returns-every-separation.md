# 03 — Parser returns every Separation; client reads v2

**Blocked by:** 01 — Route the client through a Chart view, Repaints into an overlay.

**Status:** ready-for-agent

**What to build:** again nothing the knitter can see, deliberately. This lays the
data ticket 04 needs and proves it changed nothing on the way.

The parser recovers a Palette by clustering Cell colours and choosing a merge
cutoff at the widest plateau of a threshold sweep. The sweep already walks ΔE 1
to 40 and records how many colours come out at each step; the count holds steady
across stretches of that sweep, and each such stretch — each **plateau** — is a
defensible answer. Today the widest wins and every other answer is discarded.
Now the widest eight are all returned. See
[ADR-0006](../../../docs/adr/0006-parse-returns-every-separation.md) for why this
is a set of answers rather than a sensitivity setting.

Because the clustering is hierarchical, coarser answers are strict groupings of
finer ones and never a re-shuffle. So this costs one grid of Cells at the finest
answer plus a short mapping per Separation, rather than eight grids.

The contract goes to `schema_version: 2`, because `palette` changes meaning — it
becomes the *finest* Separation, which can hold 15–40 near-duplicate entries and
is a base for the merge maps rather than something to show a knitter. A
Separation's own Palette is derived by averaging the finest entries it merges,
never stored. Shape (from the spec, which is the decision record):

```jsonc
{
  "schema_version": 2,
  "palette": [ … ],                                       // the FINEST Separation
  "cells":   [ [0,0,1,2], … ],                            // indices into the finest palette
  "separations": [                                        // ordered coarse -> fine
    { "colours": 3,  "merge": [0,0,1,1,2,2,…] },          //   finest index -> this one's index
    { "colours": 15, "merge": [0,1,2,3,4,5,…] }           //   identity at the finest
  ],
  "default_separation": 0,                                // index into separations
  "source": { …, "separation_thresholds": [22.5, 6.0] }
}
```

`parse_chart` keeps its signature — no sensitivity argument, ever. Plateaus are
selected by **width**, because width is the only evidence that an answer is
real; a colour count that survives one step out of eighty is noise. They are
*ordered* coarse to fine, which is a different ordering of the same set and
matters when only some plateaus make the cut of eight. `default_separation` is
the widest, which is exactly the answer the parser returns today.

`confidence.cells` is computed once, at the default Separation, and left alone.
Its between-two-entries signal genuinely depends on the Separation, so after a
switch it points at slightly the wrong Cells — accepted, because that list only
steers the eye during Review and never touches the Chart.

On the client, the version check accepts both 1 and 2, and `view` treats a Chart
with no `separations` as a single identity Separation over its `palette`.
Refusing v1 Charts would tell knitters their existing library was "saved by a
newer version of this app", which is both wrong and expensive. The client
renders the default Separation, so a knitter sees precisely what they see today.

- [ ] `parse_chart` keeps its signature — image and crop, nothing else
- [ ] Parses return `schema_version: 2` with a non-empty `separations`, `default_separation`, and one threshold per Separation in `source`
- [ ] At most eight Separations, chosen by plateau width, ordered coarse to fine
- [ ] `palette` and `cells` are cut at the finest selected Separation
- [ ] Every `merge` has one entry per finest Palette entry, and its distinct values are exactly `0..colours-1` — a gap would be a Palette with a hole
- [ ] Separations nest: two finest entries merged at one Separation are never split apart at a coarser one
- [ ] The colour count at `default_separation` equals the corpus ground truth — the existing Palette-size assertion, re-pointed
- [ ] The corpus ground-truth colour count appears among the offered Separations
- [ ] A chart whose sweep yields one plateau returns exactly one Separation — covered synthetically, since the corpus has no such case
- [ ] `confidence.cells` is unchanged in shape and computed at the default Separation
- [ ] The client accepts `schema_version` 1 and 2, and refuses anything higher with the existing message
- [ ] A v1 Chart lifts to a single-Separation view and opens exactly as it did before
- [ ] A freshly parsed v2 Chart renders identically to what the app renders today
