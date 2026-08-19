# Reading and resizing — spec

Status: done — all seven tickets built
Feature: reading-and-resizing
Collapsed from: a `/grill-with-docs` session, four rounds, frontier empty.

Constrained by [ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md)
(every knitter decision lives on the device, over an untouched parse),
[ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md) and
[ADR-0006](../../docs/adr/0006-parse-returns-every-separation.md). Resize is
governed by [ADR-0007](../../docs/adr/0007-resize-is-a-derived-view.md), written
during the session. Vocabulary is `CONTEXT.md`, which the same session amended —
**Colorway**, **Readout** and **Construction** changed meaning, **Worked row**
and **Resize** are new.

## Problem statement

Six requests came back from the customer after using the app on real patterns.
Five are the knitter wanting the Chart to speak their notation rather than the
parser's; one is the Chart being the wrong size for their gauge.

1. Palette entries are called Colour A, Colour B. The knitter's paper pattern
   calls them something else, and they cannot say so.
2. The Readout wraps to a second line and nothing says where the line continues.
3. A Repaint in Knit has no way back.
4. Some patterns are worked two rows per charted Row, so every number on screen
   is half what the knitter is counting on the needles.
5. The Selected Row was reported resetting to 1 after Safari was killed and
   reopened. Not reproducible on demand.
6. A chart drawn for someone else's gauge is the wrong number of stitches wide.

## What is already there

Three of the six collide with working code, and the collisions decide the shape
of the work:

- `palette[].name` is already in the Chart contract and `entryLabel`
  (`web/chart.js:60`) already prefers it over the letter. Nothing writes it.
- The Reading direction already has an arrow bar (`#direction`, `web/app.js:736`),
  and `runsOfRow` (`web/chart.js:99`) already returns chips in reading order.
  What has no indication is the *wrap*.
- The Selected Row is already persisted on every `drawRow` (`web/app.js:749`)
  and restored on open (`web/app.js:466`), and survives a mode switch and a
  Chart switch. So item 5 is a bug hunt, not a feature.

## Decisions

### Colorway names

A Colorway's name is free text the knitter types. Until they type one it stays
the positional letter `entryLabel` already produces. Duplicates are allowed and
nothing validates: it is their notation and both chips are on screen.

Names are stored **per Separation and per entry** — keyed `${separation},${entry}`
— in the Chart's record beside `overlay`, `trimmed` and `separation`. This is
deliberately *not* how Repaints are stored. A Repaint is about a Cell, which
exists in every Separation; a name is about a Palette entry, which does not —
name entry 3 at seven colours and at nine colours entry 3 is a different colour.
Keying by Separation costs nothing over keying by entry alone and is the only
answer that does not put a knitter's letter on a colour they never named.

The control is a plain list of `swatch + <input>` in Review, separate from the
paint-arming Palette bar. Not a long-press on the swatch: a knitter correcting
Cells who holds a beat too long would get a keyboard.

### Readout flow arrows

A `→` between chips and a `↵` at each wrap. Always those glyphs, never varying
with Reading direction — the complaint is about the wrapping and the direction
already has its own bar. Arrows that pointed left on a right-to-left Row would
contradict a list that visually runs right, which is the confusion doubled.

### Undo

Knit chip Repaints only, back through a stack of overlay snapshots held in
memory. Not persisted: the record is rewritten on every Row advance and an undo
history has no business in it. The button sits beside the Readout, disabled when
the stack is empty. The stack clears when the Separation changes or the blank
edges are toggled — those change what a Palette index means, so undoing across
one could repaint a Cell to a colour nobody picked. It does **not** clear when
the Selected Row moves: spotting a mistake one Row late is normal.

### Flat doubled

A third **Construction**, not a separate numbering setting. Some patterns are
worked out following the Chart and back repeating the previous row off the work.
Choosing it changes three things at once, which is exactly why it is one control
and not two a knitter could set into contradiction:

- Reading direction stops alternating, because the Chart is only ever read on
  the way out. `readingDirection` gains one branch.
- Every Row is two **Worked rows**. `#row-label` reads `Rows 5 and 6 of 40` for
  Chart Row 3 of a 20-Row Chart.
- The Readout doubles. Two lists, each with its own arrow bar and heading: the
  second is the first reversed, under the opposite Reading direction. Chips in
  both are live Repaint handles — they stand for the same Cells, and `run.at` is
  in unreversed image orientation (`web/chart.js:104`), so the reversed list
  hands `paintRun` identical coordinates for free.

One colour band and one Chart marker, not two. The marker marks a Chart Row and
there is one of those; a mirrored second band tells the eye nothing.

The Chart itself does not change. `rowCount` stays 20.

### Resize

Fully specified by [ADR-0007](../../docs/adr/0007-resize-is-a-derived-view.md).
In short: `scale: {rows, cols}` joins the knitter's other decisions in the
record, `view()` resamples nearest-neighbour from the untouched parse, and the
resample happens **after** the blank-edge trim so "20 rows" means twenty of the
Chart the knitter can see. Repaints are applied at parse resolution before the
resample, so they survive a round trip. The control is two number inputs and a
keep-proportions checkbox, in Review only, beside the Separation chooser.

Two things were chosen against my recommendation and are built as asked:
Selecting returns to Row 1 after a Resize, and there is no upper size bound.
Both are recorded in the ADR's consequences.

Two things read the view and turned out *not* to be resize-blind, against what
the ADR's "needs no change" list said, and were fixed in 07: `repaint`, which
maps the knitter's finger back to the parse and now inverts the resample the way
it already inverted the trim; and `frameTheImage`, which measured a Cell of the
crop off the view rather than off the parse and mis-framed the image comparison
on a resized Chart with Blank edges hidden.

### The Selected Row

No new feature — no reopening the last Chart on launch. One suspected cause,
which needs reproducing before it is fixed:

```js
// web/app.js:334
if (kept.trimmed !== undefined || !state.trimmed) return kept.selected;
return Math.max(kept.selected - view(kept.chart, state).blank.bottom, 1);
```

A record written before the `trimmed` field existed takes the second branch. If
the Chart has more blank rows beneath Row 1 than the Row the knitter stopped on,
that `Math.max` clamps to exactly 1 — and the reopen then writes `trimmed`, so
the next open behaves. That "once and then never again" is the shape of the
report.

Second candidate, weaker: `persist()` is fire-and-forget (`web/app.js:749`) and
the app has no `pagehide` or `freeze` listener — the only lifecycle handler is
`visibilitychange` for the service worker (`web/app.js:1127`). iOS suspends a
backgrounded page, so an in-flight IndexedDB write dies. That loses the *last*
Row change, not all of them, so it does not explain landing on 1 — but it is
worth a flush on `pagehide` regardless.

## Out of scope

- Reopening the last Chart on launch. Startup shows the library, as now.
- A yarn library shared across Charts. A Colorway name belongs to one Chart.
- Undo for Review paint drags, Separation switches, Flips or trim toggles.
- Anything in `kpp/parser.py`. The parse is correct and stays untouched.

## Tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | [Reproduce the Selected Row resetting to 1](issues/01-selected-row-resets.md) | — |
| 02 | [Name a Colorway](issues/02-name-a-colorway.md) | — |
| 03 | [Show where the Readout continues](issues/03-readout-flow-arrows.md) | — |
| 04 | [Undo the last Repaint in Knit](issues/04-undo-a-repaint.md) | — |
| 05 | [Flat doubled: two Worked rows per Row](issues/05-flat-doubled.md) | — |
| 06 | [Resize as a stage of the Chart view](issues/06-resize-the-view.md) | — |
| 07 | [Resize a Chart in Review](issues/07-resize-in-review.md) | 06 |

01 first: it is the only one that is a defect, and the only one whose cause is
still a hypothesis. 06 and 05 both rewrite parts of `drawRow`/`view`, so running
them in parallel will conflict — take them in either order, not at once.
