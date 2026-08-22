# Merging Palette entries — spec

Status: done
Feature: merge-colours

Collapsed from a `/grilling` session, frontier empty. One customer request: a
way to say, once and for the whole Chart, that two Palette entries are the same
yarn.

Constrained by [ADR-0006](../../docs/adr/0006-parse-returns-every-separation.md)
(a parse returns every Separation, and a Separation *is* a merge map),
[ADR-0007](../../docs/adr/0007-resize-is-a-derived-view.md) (knitter decisions
are recorded against an untouched parse and derived on every read),
[ADR-0003](../../docs/adr/0003-stateless-service-on-device-charts.md) (the
service stays stateless) and
[ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md) (no build step).
Decided by [ADR-0008](../../docs/adr/0008-a-merge-is-the-knitters-own-merge-map.md),
which this spec implements. Vocabulary is `CONTEXT.md` — **Merge** was added by
the grilling session that produced this spec.

## Problem Statement

A knitter switches Separations until the colour count matches the yarns on the
table, and lands on one that is nearly right: twelve colours, of which two are
yellows a few levels apart that they know are one yarn. The parser cannot know
that — the two yellows really are two clusters in the image, because the chart
was drawn, screenshotted or scanned that way.

Nothing in the app answers that. The coarser Separation is a different answer
to a different question: it may well merge the two yellows, but it merges four
other things at the same time, so the knitter trades one wrong colour count for
another. Repaint reaches individual Cells and spans, which is the wrong size of
tool — the two yellows are scattered over a hundred Cells across forty Rows,
and painting them by hand on a phone is not a thing anyone finishes.

So the Readout says "4 yellow, 3 yellow" where the knitter will work seven
stitches of one yarn, and every Row of the Chart carries the same split.

## Solution

**Merge.** In Review, the knitter taps a colour in the Colorway list; a strip of
the other colours opens beneath it; they tap the one it is the same as. The two
become one entry everywhere — one swatch in both Palettes, one Colorway name,
one Run in every Readout, one colour on the Chart. Tapping a third adds it to
the same group.

It is the knitter's statement about yarn, not a correction to the parse, so it
joins Separation, Blank edges, Repaints and Resize as a decision recorded
against an untouched Chart and applied on every derivation. It persists per
Chart, and it is in force in Knit — which is the whole point of it.

A Merge is recorded at the **finest** Palette, so it survives a Separation
switch. Merging two twelve-colour entries records the union of the finest
entries behind them: switch to twenty colours afterwards and every shade inside
that union is one colour too. That is the intended reading — the knitter said
those yellows are one yarn, so the shades inside them are one yarn as well.

The Palette does not renumber. A Merged group lands on the slot of its
most-used member, and the other slots stay where they are, holding what they
held, simply not part of the Chart being read. So a Colorway typed before a
Merge still names the colour it was typed against, and the swallowed name comes
back if the Merge is undone.

Review only, like the Separation chooser: a Merge rewrites every Readout in the
Chart, and a knitter mid-Row must not have the counts change under them.

## User Stories

1. As a knitter looking at two colours I will knit in one yarn, I want to
   declare them one colour, so that my Readouts count them as the one yarn
   they are.
2. As a knitter, I want a Merge to apply to the whole Chart at once, so that I
   am not painting a hundred scattered Cells by hand.
3. As a knitter, I want to Merge by tapping one colour and then the colour it
   matches, so that the gesture is the one I already know from repainting a Run
   in Knit.
4. As a knitter, I want to add a third and fourth colour to a group, so that a
   chart with four near-identical greys is as easy as one with two.
5. As a knitter, I want the Merged swatch to show the colour the group actually
   is, so that the list still reads as the yarns on my table.
6. As a knitter, I want my Merges in force while I knit, so that the Readout I
   work from is the one I settled on in Review.
7. As a knitter, I want my Merges kept with the Chart, so that reopening it
   tomorrow shows the colours I settled on.
8. As a knitter, I want a Merge to survive a Separation switch, so that
   choosing a colour count and declaring a yarn are independent decisions.
9. As a knitter, I want to take back a Merge I just made, so that trying one is
   cheap.
10. As a knitter, I want the Colorway names I typed to survive a Merge, so that
    declaring a yarn does not cost me my notation.
11. As a knitter, I want the Separation chooser to tell me I am reading fewer
    colours than the Separation offers, so that the count on screen is never
    unexplained.
12. As a knitter, I want my Row numbers to hold across a Merge, so that
    declaring two off-whites one colour never renumbers the Chart under me.
13. As a knitter, I want a Merge to survive a Resize, so that the two decisions
    are independent.
14. As a knitter with a Chart whose colours are all distinct, I want Merging to
    stay out of the way, so that Review shows me controls I have a use for.
15. As a developer, I want a Merge to be a merge map like a Separation's, so
    that this is one new decision rather than a new mechanism.
16. As a developer, I want the Palette not to renumber, so that everything
    already keyed by Palette index — Colorway names, the armed entry — stays
    valid.
17. As a developer, I want Blank edge detection untouched by Merges, so that
    hidden lines and Row numbers cannot move for a reason the knitter did not
    ask for.
18. As a developer, I want Charts already in the library to open unchanged, so
    that a record written before Merges existed lands on the same defaults a
    fresh parse does.

## Implementation Decisions

### `merges` is a fifth field of the view state

```
view(chart, { separation, trimmed, overlay, names, scale, merges }) -> Chart
```

`merges` is a sparse map over **finest** Palette entries — finest entry → the
entry its Merge group is rooted at — stored flat, so every member of a group
points at the same root. Exactly the shape a Separation's `merge` is, one level
down, and JSON as it stands, so `library.js` persists it with the rest.

Composition inside `view`, in this order:

1. `separationOf` gives the Separation's `merge` (finest → its entry).
2. Blank edges are measured **before** Merges are applied, against the
   Separation's own Palette — the existing call, unchanged, cached by Separation
   index alone.
3. Coarse entries sharing a finest Merge group are united. Each resulting class
   is read as the entry of its most-used member — most Cells in the parse, ties
   to the lowest index — and the other entries of the class become **holes**.
4. The Palette is the Separation's, of unchanged length, with each surviving
   entry the Cell-count-weighted average of every finest entry in its class —
   the rule `paletteOf` already applies to the parser's own merges — and each
   hole carrying an `into` field naming the entry it is read as.
5. `named` applies the knitter's Colorways over that, keyed as it is today.

`read` becomes `into[merge[cell]]`, so `cells` index the surviving entries and
nothing downstream — `runsOfRow`, `drawCells`, the overview — learns that a
Merge exists.

### The Palette keeps its length, and holes are filtered on screen

Renumbering would shift every entry after a Merged one, and `names` is keyed by
index — a knitter's word would silently land on a colour they never named.
Holes cost one filter in the two lists that show a Palette (`palette` and
`colorway-list` in Review, `chip-palette` in Knit) and keep every index-keyed
thing valid, including the armed entry.

Anything reading `palette.length` as "how many colours this Chart has" is wrong
once a Merge exists. The count is the entries without an `into`.

### Blank edges do not move

Measured from the Separation's Palette, before Merges. Two off-whites Merged
into one entry that crosses the near-white gate would otherwise hide an edge Row
and renumber every Row above it, for a reason the knitter did not ask for. This
is the rule already applied to Repaints, for the same reason and by the same
code — `blankEdgesOf` is untouched.

### Repaint follows the Merge

`repaint` records the most-used finest entry behind the entry the knitter
tapped. With a Merge in force the search is over the class rather than the
Separation's entry, so painting the Merged yellow stores the dominant finest
yellow. Undoing the Merge later shows those Cells as that shade — the parse has
no record of which of the two the knitter meant, because to them it was one.

### The armed entry follows its colour

An entry armed for Repaint that a Merge swallows re-points to the entry it was
Merged into rather than disarming: the colour is still there, at another slot.

### UI

- **Colorway list.** Each row's swatch becomes a button. Tapping it opens a
  strip of the other surviving entries beneath the list; tapping one of those
  Merges the two. Tapping the open swatch again shuts the strip. This is Knit's
  chip gesture — tap the thing, a Palette opens, tap the destination — and the
  Colorway swatch is an inert `span` today, so nothing else claims the tap.
- **Undo.** One control in Review, taking back the last Merge of this session.
  Its own stack, kept across Separation switches and Resizes, because a Merge
  survives both. Not persisted: a Merge is permanent once the Chart is
  reopened.
- **Separation chooser.** The marked answer reads *"12 colours (11 merged)"*
  when a Merge is in force. The other answers keep the parse's own counts —
  that is what switching to them gives.
- **Facts line.** The Palette entry count is the count on screen, so it moves
  as a Merge is made — the same feedback loop the Separation chooser has.
- Nothing appears for a Chart with one entry left, or one to begin with.

### Not touched

`kpp/parser.py`, `server.py`, the Chart contract and `schema_version`. A Merge
is a knitter decision on the device; the parse it applies to is unchanged, and a
stored record without `merges` lands on the same default a fresh parse does.

## Testing Decisions

`web/chart.test.js`, in the style already there: pure functions over a literal
Chart, `node --test`, no DOM. No new seams.

- A view with no `merges` is byte-identical to today's
- Merging two entries: the Palette keeps its length, the class lands on the
  most-used member's slot, the other slot carries `into`, and the surviving
  colour is the Cell-count-weighted average of every finest entry in the class
- `runsOfRow` joins two adjacent Runs of Merged entries into one, in both
  Reading directions — the customer's bug as a test
- A Merge made at one Separation is in force at another, in both directions,
  and Merging two twelve-colour entries collapses the whole union of finest
  entries at the finest Separation
- A third entry Merged into an existing group joins it rather than starting a
  second
- Merging is idempotent, and Merging in either order gives the same Palette
- Colorway names: the surviving slot keeps its own name, and the swallowed
  slot's name is still there when the Merge is dropped
- Blank edges are the same before and after a Merge, including the case where
  the Merged colour crosses the near-white gate, and Row numbers hold
- A Repaint to a Merged entry stores the most-used finest entry of the class,
  and survives a Separation switch
- Repainting to a hole is refused with the existing message
- A Merge survives a Resize, and a Resize down and back up is unchanged by it
- A v1 Chart accepts a Merge over its single Separation

## Out of Scope

- **No Merge into Non-stitch.** Non-stitch is yarn's absence rather than a
  colour, and Repaint already reaches it per Cell and per span.
- **No Unmerge control.** Undo is session-only, so a Merge is permanent once
  the Chart is reopened — accepted in ADR-0008. The stored group is already the
  thing an Unmerge would delete, so it is a small addition if the case turns up.
- **No partial split of a group.** Choosing which members go where means
  choosing between colours the knitter can no longer see separately.
- **No automatic suggestion of near colours to Merge.** The parser already
  offers its own answers as Separations; a second, different automatic answer in
  the same screen is a third thing to calibrate.
- **No Merging in Knit.** *Review this parse* is the way back, as it is for the
  Separation chooser.
- **No parser or contract change.**
