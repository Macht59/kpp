# Separation and Blank edges — spec

Status: ready-for-agent
Feature: separation

Collapsed from a `/grilling` session, frontier empty. Two customer requests,
one spec, because they share the same machinery: both are decisions the knitter
makes about a parsed Chart on the device, not new things the parser extracts.

Constrained by [ADR-0006](../../docs/adr/0006-parse-returns-every-separation.md),
which this spec implements, and by
[ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md) (the
service stays stateless) and
[ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md) (no build step).
Extends the Chart contract from
[chart-parsing ticket 08](../chart-parsing/issues/08-chart-contract.md) to
`schema_version: 2`. Builds on the Palette recovery findings in
[ticket 04](../chart-parsing/issues/04-palette-recovery.md). Vocabulary is
`CONTEXT.md` — **Separation**, **Blank edge** and **Column** were added by the
grilling session that produced this spec, and are used throughout.

## Problem Statement

Two things a knitter hits on real charts.

**Colours that should be two entries come back as one.** A chart with a light
green and a dark green parses into a Palette where both greens are the same
entry. The Readout then says "7 green" where the pattern says 4 light and 3
dark, and the knitter knits it wrong. It is not a rare miss: the parser picks
its merge cutoff by taking the widest plateau of a threshold sweep, and on a
noisy chart that plateau sits around ΔE 20–25 — wide enough to swallow the gap
between two shades of one colour. Review shows the Palette entry count, so the
knitter can *see* that 6 came back where they can count 7 yarns, but there is
nothing they can do about it. The Chart is simply wrong and stays wrong.

**The crop catches the image's white space.** A chart screenshot usually has
white margin around the grid, and a knitter drawing a rectangle on a phone
includes some of it. Those Rows and Columns arrive as real Cells: the Chart is
two Rows taller than the pattern, Row numbers are off by two, and the Readout
for the top Row is a run of white that corresponds to no stitches at all. The
knitter's only recourse today is a Re-parse with a tighter crop, on a phone,
with a finger, repeatedly.

## Solution

**Separation.** One parse returns several answers instead of one. The parser
already sweeps the merge cutoff from ΔE 1 to 40 and counts the colours found at
each step; the count holds steady across stretches of that sweep — the
plateaus — and each plateau is a defensible answer. Today the widest one wins
and the rest are thrown away. Now the widest eight are all returned, and the
knitter picks.

In Review, a list of the available Separations, labelled by what the knitter
actually counts: *3 colours · 5 · 6 · 15*, with the current one marked. Tapping
one redraws the Chart instantly — no upload, no wait, no new Chart, no lost
corrections. The Palette entry count in Review's facts line moves with it, so
the knitter switches until the count matches the yarns in front of them. The
default is the widest plateau, which is exactly what the app returns today, so
a knitter who never touches the list sees no change.

Because the answers nest — a coarser Separation is always a grouping of a finer
one, never a re-shuffle — this costs almost nothing to carry: one grid of Cells
plus a short mapping per Separation.

**Blank edges.** The client finds Rows and Columns at the Chart's edge whose
every Cell is near-white and hides them, by default. Review states what it did
— *"112 × 148, 2 blank Rows hidden"* — and the knitter can show them again with
one tap if the pattern really does have a white edge. Nothing is deleted: the
Cells stay in the Chart, they are simply not part of the Chart being read.

Neither is a Re-parse. Both are the knitter changing how a Chart they already
have is read, and both survive being put down and picked up.

## User Stories

1. As a knitter, I want a parse to offer more than one answer for how many
   colours my chart has, so that a wrong answer is something I can correct
   rather than something I have to live with.
2. As a knitter whose light green and dark green came back as one colour, I
   want to pick a finer Separation, so that my Readout counts the two greens
   separately and I knit the pattern that was published.
3. As a knitter, I want the Separations labelled by colour count, so that I can
   choose by comparing against the yarns on the table rather than by
   interpreting a number I have no way to calibrate.
4. As a knitter, I want switching Separation to be instant, so that I can try
   three of them in ten seconds instead of waiting for three parses.
5. As a knitter, I want the Palette entry count in Review to update as I switch,
   so that I have a running answer to the only question I am asking.
6. As a knitter, I want the default Separation to be the one the app picks
   today, so that charts that already parse correctly keep parsing correctly.
7. As a knitter, I want the Separations ordered coarse to fine, so that the list
   reads like a scale rather than an arbitrary set.
8. As a knitter, I want only stable Separations offered, so that the list is
   short and every entry in it is a real answer.
9. As a knitter with a two-colour chart, I want no Separation list cluttering
   Review when there is only one answer, so that the screen shows me controls
   that do something.
10. As a knitter, I want my Repaints to survive a Separation switch, so that
    correcting Cells and choosing a colour count are independent and I never
    have to choose which one to redo.
11. As a knitter, I want a Cell I marked as Non-stitch to stay Non-stitch across
    a Separation switch, so that the silhouette I traced is not undone by a
    colour decision.
12. As a knitter, I want my chosen Separation kept with the Chart, so that
    reopening it tomorrow shows the colours I settled on rather than the
    default.
13. As a knitter, I want the Separation list only in Review, so that the
    Readout I am mid-row on cannot change under me.
14. As a knitter who notices a merged colour while knitting, I want to reach the
    Separation list through *Review this parse*, so that the way back is the one
    I already know.
15. As a knitter, I want the white space my crop caught removed from the Chart
    by default, so that the Chart I read is the pattern and nothing else.
16. As a knitter, I want Blank edges hidden rather than deleted, so that a
    mistake costs one tap instead of a re-parse.
17. As a knitter, I want Review to tell me how many Blank edges were hidden, so
    that a Chart two Rows smaller than I expected is explained rather than
    suspicious.
18. As a knitter whose pattern genuinely has a white edge Row, I want to show
    the Blank edges again, so that hiding is a default and not a rule.
19. As a knitter, I want my decision to show Blank edges kept with the Chart,
    so that reopening does not silently hide them again.
20. As a knitter, I want Row 1 to be the first Row of the pattern once Blank
    edges are hidden, so that my Row counts match the published pattern's.
21. As a knitter, I want Blank edges to stay consistent with the Separation I
    have chosen, so that a hidden Row is never a Row I can see has colour in it.
22. As a knitter, I want a crop that caught nothing but white space refused with
    a message, so that I re-crop instead of staring at an empty Chart.
23. As a knitter, I want only white to count as blank, so that a black border
    Row or a solid-coloured edging round is never silently removed from my
    pattern.
24. As a knitter, I want only edges trimmed, so that a white Row through the
    middle of my pattern is left exactly where it is.
25. As a knitter, I want Charts already in my library to keep opening after this
    ships, so that an app update does not cost me the charts I have parsed.
26. As a knitter, I want a Chart parsed before this feature to still work, even
    though it only has one Separation, so that old and new Charts behave the
    same everywhere except the list.
27. As a knitter, I want the Cells flagged for review to keep pointing my eye at
    the doubtful ones, so that Review still works the way it did.
28. As a knitter, I want Repaint to keep working on the Chart I can see, so that
    hidden Blank edges do not shift which Cell my finger lands on.
29. As a knitter, I want the Chart size in Review to describe the Chart I am
    going to knit, so that comparing it against the pattern's stated size is a
    real check.
30. As a developer, I want the parser to stay a stateless function of image and
    crop, so that ADR-0003 holds and Separations add no server state.
31. As a developer, I want Separations to nest rather than each carry their own
    grid, so that the payload and the on-device storage stay close to what they
    are today.
32. As a developer, I want the Chart contract versioned when its fields change
    meaning, so that a Chart on a device is never read under the wrong
    assumptions.
33. As a developer, I want Blank edge detection on the client, so that a
    presentation decision does not enter the parser and the parser keeps one
    job.
34. As a developer, I want the client's existing Chart functions to keep working
    unchanged, so that Separation and Blank edges are one new concept rather
    than a change to every reader.

## Implementation Decisions

### The contract goes to `schema_version: 2`

`palette` changes meaning — it becomes the *finest* Separation, which can be
15–40 near-duplicate entries and is a base for the merge maps rather than
something to show a knitter. A field keeping its name while changing what it
holds is what the version number exists for.

```jsonc
{
  "schema_version": 2,
  "dimensions": { "rows": 150, "cols": 112 },
  "palette": [ {"rgb": [255,255,255], "name": null}, … ],  // the FINEST Separation
  "cells":   [ [0,0,1,2], … ],                             // indices into the finest palette
  "separations": [                                         // ordered coarse -> fine
    { "colours": 3,  "merge": [0,0,1,1,2,2,…] },           //   finest index -> this one's index
    { "colours": 5,  "merge": [0,1,1,2,3,4,…] },
    { "colours": 15, "merge": [0,1,2,3,4,5,…] }            //   identity at the finest
  ],
  "default_separation": 0,                                 // index into separations
  "source":     { …, "separation_thresholds": [22.5, 15.0, 6.0] },
  "confidence": { "chart": 0.92, "cells": [ … ] }          // computed at default_separation
}
```

A Separation's own Palette is **derived**, not stored: average the finest
entries it merges. Storing a colour list per Separation would be a second
source of truth for the same colours.

`dimensions` continues to state the full parsed grid. Blank edges are a client
decision and never touch it.

### Parser: `parse_chart` keeps its signature

No sensitivity argument. The threshold sweep in `_plateau_threshold` already
computes everything needed — it walks ΔE 1→40 in 0.5 steps and records the
cluster count at each. Instead of returning one threshold, it returns the runs:
each maximal stretch of constant count is a plateau, and each plateau is a
candidate Separation.

- Take the **widest eight** plateaus by cutoff span. Plateau width is the only
  evidence of which answers are real; a count that survives one step out of 80
  is noise with a colour count attached.
- `default_separation` is the widest, which is today's answer.
- Order `separations` coarse to fine.
- Cut at the **finest** selected plateau to produce `palette` and `cells`; every
  other Separation's `merge` is derived by re-cutting the same linkage tree at
  its threshold and mapping finest cluster → coarser cluster. The tree is
  hierarchical, so this mapping always exists and is always a strict grouping.
- `confidence.cells` is computed once, at `default_separation`. Its
  between-two-entries signal is genuinely Separation-dependent; after a switch
  it points at slightly the wrong Cells. Accepted — the list steers the eye and
  never touches the Chart.

### Client: one new function in `web/chart.js`

```
view(chart, { separation, trimmed, overlay }) -> Chart
```

Returns a derived Chart in the shape every existing reader already consumes:
`palette` is the chosen Separation's derived colours, `cells` are indices into
it, with Repaints applied and Blank edges cut away. `rowCount`, `colCount`,
`cellsOfRow`, `runsOfRow`, `rowIndex`, `rowNumber`, `entryLabel` and
`readingDirection` are untouched and operate on the view.

The view state is three fields, stored per Chart in the library alongside
`selected` and `reading`:

- `separation` — index into `separations`; defaults to `default_separation`
- `trimmed` — boolean, defaults true
- `overlay` — sparse map of Cell → chosen finest-Palette entry or Non-stitch

**Repaint becomes state, not a Chart.** `repaint` today returns a new Chart with
`cells` rewritten. It changes to return new view state with `overlay` updated,
because a Repaint has to outlive a Separation switch and an index into a Palette
that is about to change cannot. Its coordinates stay the ones the knitter sees —
`view` co-ordinates — and it maps them back through the Blank edge offset. Its
existing guards (integers, in bounds, refuse rather than clamp) carry over
unchanged and now apply against the view's bounds.

A Repaint records a colour at the **finest** Separation, so it survives a switch
in both directions. Non-stitch is Separation-independent by nature — it is
"not yarn", not "which yarn" — and is stored as the same sentinel it is today.

**Blank edge rule.** An edge Row or Column is blank when every one of its Cells
maps to a Palette entry whose Lab `L*` is at or above 95. Trim inward from each
of the four edges until a non-blank line is met; interior blank lines are never
touched. Recomputed against the Separation in force, so hidden lines always
agree with the colours on screen — the knitter's decision to show them is
sticky, their extent is not.

The `L* >= 95` gate is a starting value with no chart to fit it against
(see Out of Scope). Mark it with a `ponytail:` comment naming that.

A Chart whose every Row or every Column is blank is refused with a message
telling the knitter to re-crop — the same shape of failure as the parser's own
crop errors, on the client because the rule is on the client.

### Client: v1 Charts are lifted, not refused

`isReadable` accepts 1 and 2. A v1 Chart is exactly a v2 Chart with one
Separation, so `view` treats a missing `separations` as a single identity
mapping over `palette`. Refusing them would tell knitters their existing library
was "saved by a newer version of this app", which is both wrong and expensive.

### Client: UI

- The Separation list lives in **Review only**, near the facts line, labelled by
  colour count with the current one marked. Hidden entirely when there is one
  Separation. Not in Knit: switching rewrites every Readout in the Chart, and
  *Review this parse* is already the way back at any Row.
- Review's facts line states the visible size and the trim:
  *"112 × 148, 2 blank Rows hidden"*. Size is the trimmed size, because that is
  the Chart being knitted and the number worth comparing against the pattern.
- The Palette entry count stays the current Separation's full count, unfiltered.
  That number moving as the knitter switches *is* the feedback loop.
- A control to show Blank edges again, adjacent to the trim statement.

### Not touched

`server.py` passes the parser's dict through unchanged. `library.js` already
persists arbitrary fields through `remember`. `crop.js` is unaffected.

## Testing Decisions

A good test here asserts on what a caller can observe — the Chart that comes
back, the view that comes out — never on how the sweep or the merge was
computed. Both existing seams are already tested this way and the new tests join
them. **No new test seams.**

### `tests/test_parse_chart.py` — the parser, against the corpus

Prior art is the file itself: ground truth comes from corpus filenames
(`<w>w<h>h-<n>colors`), tests skip when the images are absent, and assertions
are on the contract output only.

- `schema_version` is 2 and `separations` is present and non-empty
- Every `merge` has one entry per finest Palette entry, and its distinct values
  are exactly `0..colours-1` — a mapping with a gap is a Palette with a hole
- `separations` is ordered coarse to fine and holds at most 8
- Each Separation nests inside the next finer one: two finest entries merged at
  a coarse Separation are never split apart at a coarser one
- `default_separation` indexes a real Separation, and the colour count there
  equals the corpus filename's — the existing Palette-size assertion, re-pointed
- The ground-truth colour count appears among the offered Separations
- `source.separation_thresholds` has one threshold per Separation, descending
- `cells` indexes the finest Palette, and `confidence.cells` is unchanged in
  shape

`tests/test_synthetic_chart.py` covers the degenerate shapes the corpus lacks: a
chart whose sweep yields one plateau must return exactly one Separation.

### `web/chart.test.js` — the view, in Node

Prior art is the file itself: pure functions over a literal Chart, `node --test`,
no DOM.

- `view` at the default Separation of a v2 Chart returns the same Chart today's
  functions would have consumed — `runsOfRow` over it is unchanged
- Switching Separation changes the Palette size and merges Runs accordingly: two
  greens are one Run at the coarse Separation and two at the fine one, which is
  the customer's bug expressed as a test
- A v1 Chart (no `separations`) lifts to a single-Separation view, and
  `isReadable` accepts both 1 and 2
- Blank edges: leading and trailing all-white Rows and Columns are hidden; an
  all-white Row in the *middle* is kept; a near-white entry inside the gate is
  hidden and one outside it is not
- `trimmed: false` shows them again, and the Chart is byte-identical to the
  untrimmed view
- Blank edge extent recomputes with the Separation — a chart where white and
  off-white merge at a coarse Separation hides a different number of lines than
  at a fine one
- Row numbering: with two Blank Rows hidden, view Row 1 is the pattern's Row 1,
  and `runsOfRow` on it returns the pattern's Runs
- Repaint: a Repaint made at one Separation is still there after switching to
  another, in both directions; a Repaint to Non-stitch survives equally; a
  Repaint uses view coordinates and lands on the Cell the knitter touched with
  Blank edges hidden; the existing out-of-bounds and non-integer guards still
  refuse
- A Chart that is entirely blank is refused rather than returned empty

## Out of Scope

- **No corpus chart for either feature.** Three of the four charts in
  `tests/examples/` are two-colour, and none reproduces the merged-greens case.
  The customer's failing image was not obtained. The `L* >= 95` gate is
  therefore unfitted, and there is no test that proves two real greens separate
  on a real image — only on a synthetic one. Both were knowingly accepted; the
  first check is production. Recorded in ADR-0006.
- **No sensitivity setting and no re-parse for colour count.** Rejected in
  ADR-0006 — an absolute scale was already falsified by the corpus, and a
  re-parse costs the knitter every Repaint.
- **No Separation switching in Knit.**
- **No per-Separation `confidence.cells`.**
- **No non-white Blank edges.** A uniform black or coloured edge line is left
  alone, deliberately.
- **No automatic Non-stitch detection.** Unchanged from v1; Non-stitch still
  arrives only from the knitter's corrections.
- **No Colorway changes.** Naming a Palette entry is untouched; how a name
  follows a Separation switch is not addressed here.
- **No migration of stored Charts.** v1 Charts are lifted on read, not
  rewritten on device.

## Further Notes

The two features arrived as separate customer requests and share no code, but
they share a shape and had to be designed together: both are the knitter
deciding how an already-parsed Chart is read, both live in the view state, both
persist per Chart, and Blank edge extent depends on the Separation in force. A
spec for either alone would have had to invent the other's machinery.

The Separation ordering is deliberately coarse-to-fine while the plateau
*selection* is by width. Those are different orderings of the same set and the
distinction matters when only some plateaus make the cut of eight.

`palette` holding 15–40 near-duplicate entries under v2 is the sharp edge of
this design. Anything that shows `palette` to a knitter without going through a
Separation is a bug, and it will look like working code.
