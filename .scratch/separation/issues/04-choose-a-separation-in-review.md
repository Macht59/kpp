# 04 — Choose a Separation in Review

**Blocked by:** 02 — Hide Blank edges; 03 — Parser returns every Separation; client reads v2.

**Status:** resolved

**What to build:** the customer's headline request, and the first ticket in this
feature the knitter can see.

A chart with a light green and a dark green parses into a Palette where both
greens are one entry. The Readout then says "7 green" where the pattern says 4
light and 3 dark, and the knitter knits it wrong. Review already shows the
Palette entry count, so they can *see* that six came back where they can count
seven yarns — and today there is nothing they can do about it.

Ticket 03 put every defensible answer in the Chart. This ticket lets the knitter
pick one.

In Review, beside the facts line, a list of the available **Separations**
labelled by what the knitter actually counts — *3 colours · 5 · 6 · 15* — with
the current one marked. Tapping one redraws the Chart instantly: no upload, no
wait, no new Chart, no lost corrections. The Palette entry count in the facts
line moves with it, and that movement *is* the feedback loop — the knitter
switches until the count matches the yarns in front of them. It stays the
Separation's full, unfiltered count; quietly dropping entries from it would hide
exactly the merge this feature exists to catch.

The default is the widest plateau, which is what the app returns today, so a
knitter who never touches the list sees no change. The list is hidden entirely
when a Chart has only one Separation, which includes every Chart parsed before
this shipped.

The list is in **Review only**. Switching rewrites every Readout in the Chart,
and a knitter mid-row must not have the instructions change under them —
*Review this parse* is already the way back, at any Row, at any time.

Repaints survive a switch in both directions, because ticket 01 made them a
statement about a Cell rather than an index into a Palette that is about to
change. Non-stitch survives too, being "not yarn" rather than "which yarn". And
Blank edge extent recomputes against the chosen Separation, so a hidden Row is
never a Row the knitter can see has colour in it — the decision to show them
stays sticky, the extent does not.

Note for whoever picks this up: under v2 `palette` holds the finest Separation,
15–40 near-duplicate entries. Anything that shows `palette` to a knitter without
going through a Separation is a bug, and it will look like working code.

- [x] Review shows the available Separations, labelled by colour count, current one marked
- [x] Tapping one redraws the Chart with no parse and no wait
- [x] The Palette entry count in the facts line is the chosen Separation's full count, and moves as the knitter switches
- [x] The default on a fresh parse is the parser's default Separation, and matches what the app rendered before this feature
- [x] The list is hidden when a Chart has one Separation, including every Chart parsed before this shipped
- [x] The list appears in Review only, never in Knit
- [x] The chosen Separation persists per Chart and comes back on reopen
- [x] A Repaint made at one Separation is still there after switching, in both directions
- [x] A Repaint to Non-stitch survives a switch equally
- [x] Blank edge extent recomputes against the chosen Separation; the knitter's show/hide decision does not
- [x] Tests cover the customer's bug directly: two greens are one Run at the coarse Separation and two Runs at the fine one — synthetically, since no corpus chart reproduces it

## Comments

**Shipped** in `feat(web): Let a knitter pick how many colours a Chart is read as`,
with `fix(web): Keep the focus on the Separation the knitter tapped` and
`perf(web): Derive the Chart once per pointer move of a paint drag` after it.

`drawSeparations` lists the answers by colour count inside `#separation`, which
sits in the Review section and so never appears in Knit, and hides itself when a
Chart offers fewer than two — which is every Chart parsed before this shipped.
The marked one is `shown.separation`, the Separation actually being read, so a
knitter who has chosen nothing still sees the parser's default marked. Tapping
calls `adopt`, which re-derives from the Chart already on the device: no upload,
no wait. The facts line shows the chosen Separation's full entry count and moves
with it, which is the loop the knitter closes against their yarns.

Repaints hold because ticket 01 made them a statement about a Cell: they are
stored at the finest Separation — the finest entry of the tapped swatch that most
Cells sit in, so a switch to a finer answer shows the colour it mostly was — and
Non-stitch is stored as itself. Blank edge extent is cached per Separation and
recomputed when it changes, while the knitter's show/hide decision stays put;
`adopt` renumbers `selected` by the change in hidden Rows so they stay on the Row
they were on.

The customer's bug is asserted directly in `web/chart.test.js`: two greens are
one Run at the coarse Separation and two at the fine one.

The DOM half of this ticket — the list, its marking and its Review-only placement
— was checked by reading `web/app.js` and `web/index.html`, not by a test; the
client has no DOM test harness, and `node --test web/*.test.js` covers `chart.js`
only.
