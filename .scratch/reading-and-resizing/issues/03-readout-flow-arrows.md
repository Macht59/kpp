# 03 — Show where the Readout continues

**Blocked by:** None.

**Status:** done

**What to build:** the smallest of the six, and pure presentation.

The Readout is a wrapping flex list (`#readout`, `web/index.html:48`). On a
phone a Row of any complexity wraps, and nothing on screen says the list
continues on the line below — a knitter reads to the right edge and stops, or
loses which chip they were on.

Put a `→` between consecutive chips, and a `↵` at each wrap.

**Always those glyphs.** They describe the *list*, not the knitting. The chips
are already in reading order — `runsOfRow` reverses them for a right-to-left Row
(`web/chart.js:99`) — so the leftmost chip is always the first thing knitted,
and the Reading direction already has its own arrow bar above
(`#direction`, `web/app.js:736`). An arrow that pointed left between two chips
that visually go right would be the confusion doubled, not halved.

The separators are decoration, so keep them out of the accessibility tree
(`aria-hidden`) — a screen reader already reads the chips in order and does not
need "right arrow" forty times.

Detecting the wrap is the only real work: the chips are laid out by the browser,
so the break points are only known after layout. Compare each chip's
`offsetTop` to the previous one's.

- [x] A `→` sits between consecutive chips on the same line
- [x] A `↵` sits at each point where the list wraps
- [x] The glyphs do not change with Reading direction
- [x] Separators are hidden from assistive technology
- [x] The separators re-place themselves when the viewport width changes
- [x] A Readout of one Run has no separator at all
