# A Merge is the knitter's own merge map, recorded at the finest Palette

A knitter who has found the Separation whose colour count nearly matches their
yarns still sees two yellows that are one yarn. [ADR-0006](0006-parse-returns-every-separation.md)
gave them every answer the parse could defend, and none of them is this one:
the coarser Separation may merge the two yellows, but it merges four other
things at the same time. **So the knitter gets to author a merge of their own —
recorded against the finest Palette, composed with the Separation's merge on
every derivation, and never renumbering the Palette.**

## Considered Options

Writing the Merge into the Chart — rewriting `cells` and shortening `palette` —
was rejected for the reason [ADR-0007](0007-resize-is-a-derived-view.md)
rejected baking a Resize in. Every other knitter decision is a statement
recorded against an untouched parse and applied by `view()`; a Merge that
mutated the parse would be the one decision that could not be taken back, and
it would have to be written into the Repaint overlay and the Separation merge
maps at the same time.

**Recording the Merge against the Separation it was made at** — keyed
`"<separation>,<entry>"`, the way Colorway names are — was the real
alternative, and it is the more literal reading: the knitter pointed at two
entries of a twelve-colour Palette, so store that. It was rejected because a
Merge is a claim about *yarn*, and yarn does not change when the colour count
does. A knitter who declares two yellows one yarn at twelve colours and then
switches to twenty to separate two greens should not have the yellows come back
apart; they never said anything about the greens that unsaid the yellows.
Repaint is already recorded at the finest Palette for exactly this reason.

The cost of that choice is real and is the surprising part of this decision.
The only way to state "these two entries are one" in finest terms is the union
of the finest entries behind them. Merging two twelve-colour entries therefore
collapses every shade inside both — which at twenty colours may be eight
entries where the knitter pointed at two. Accepted as the correct reading rather
than tolerated as a side effect: the knitter said those yellows are one yarn,
and a shade *inside* one of them cannot be a different yarn from it.

**Renumbering the Palette** was rejected on the same ground that made
per-Separation keying attractive. Merging shortens the visible Palette, so every
entry after the Merged one shifts down — and `names` is keyed by entry index, so
a Colorway typed as "gold" would silently move onto a colour the knitter never
named. Re-keying names to a stable identity would fix it and would need a
migration for every record already on a device. Instead the Palette keeps its
length: a Merged class is read as the entry of its most-used member, and the
other entries become holes carrying an `into` field, filtered out of the two
lists that show a Palette. Every index-keyed thing — names, the armed entry —
stays valid, and a swallowed Colorway is still there if the Merge is dropped.

Most-used member rather than lowest index, so that the slot a group lands on is
the colour the group mostly was — the same rule `repaint` already uses to pick
which finest entry to store, applied to picking a slot.

## Consequences

Anything reading `palette.length` as "how many colours this Chart has" is wrong
once a Merge exists; the count is the entries without an `into`. This is the
second time the Palette has grown a trap of this shape — under `schema_version:
2`, `chart.palette` is the finest Separation and not a knitter's colours either
— and it will look like working code both times.

**Blank edges are measured before Merges are applied**, against the Separation's
own Palette, so `blankEdgesOf` is untouched and its cache stays keyed by
Separation index alone. Merging two off-whites into an entry that crosses the
near-white gate therefore hides nothing new. This is deliberately *not* the rule
Separations follow — a finer Separation may stop counting a Row as white — and
it is the rule Repaints already follow: a knitter declaring two colours one yarn
must not have an edge Row disappear and every Row number shift under them.

**Undo is session-only.** The Merge stack lives in memory like the Repaint
stack, so a Merge made today can be taken back today and is permanent once the
Chart is reopened. There is no Unmerge control. Accepted knowingly: the stored
group is already exactly what an Unmerge would delete, so the way out is cheap
to add if a knitter ever wants one — but every screen it would need is screen a
phone does not have to spare on a case nobody has hit yet.

**A Repaint to a Merged entry stores the most-used finest entry of the class.**
Undo the Merge afterwards and those Cells read as that one shade. The parse has
no record of which member the knitter meant, because by then it was one colour
to them.

Nothing about this reaches the parser, the Chart contract or
`schema_version` — a record written before Merges existed simply has no
`merges` field and lands on the default a fresh parse does.
