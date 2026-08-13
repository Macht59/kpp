# 02 — Draw the crop rectangle

**What to build:** A knitter whose chart image has number gutters — three of
the four corpus charts do — drags a rectangle around just the grid before
parsing, and adjusts it by its handles until it looks right.

Excluding the gutters is the whole point: leaving them in makes the Cell count
overcount by up to 24%, and a wrong Cell count is a structural error that
cannot be corrected afterwards, only redone. So the knitter gets a one-line
hint saying so, positioned where they will read it before they drag.

*Use whole image* from ticket 01 stays as the shortcut for an already-cropped
screenshot.

No snap-to-lattice assist. `_recover_lattice` already snaps the crop to the
gridline comb internally and `confidence.chart` reports how well it landed;
building a second grid detector in the client to pre-solve that is work the
parser has already done.

**Blocked by:** 01 — Parse a whole image and see the Chart.

**Status:** ready-for-agent

- [ ] A knitter can drag a rectangle over the uploaded image with a finger
- [ ] The rectangle can be adjusted after it is drawn, by handles large enough to grab on a phone
- [ ] A one-line hint tells the knitter to keep number gutters outside the rectangle
- [ ] Parsing uses the drawn rectangle
- [ ] *Use whole image* still works and still parses the full bounds
- [ ] A rectangle the parser rejects as too small surfaces the parser's message and leaves the rectangle in place to adjust
