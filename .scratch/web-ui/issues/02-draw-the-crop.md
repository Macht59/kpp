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

**Status:** resolved

- [x] A knitter can drag a rectangle over the uploaded image with a finger
- [x] The rectangle can be adjusted after it is drawn, by handles large enough to grab on a phone
- [x] A one-line hint tells the knitter to keep number gutters outside the rectangle
- [x] Parsing uses the drawn rectangle
- [x] *Use whole image* still works and still parses the full bounds
- [x] A rectangle the parser rejects as too small surfaces the parser's message and leaves the rectangle in place to adjust

## Comments

A canvas overlaid on the image, driven by pointer events so one code path
serves finger, stylus and mouse. The crop is held in **image** pixels rather
than CSS pixels, so rotating the phone or laying the image out at a different
size cannot move the rectangle off the grid it was drawn around.

Handles are the four corners, drawn at an 11 px radius and grabbed within 22 —
a 44 px target, the phone touch minimum. Grabbing one anchors the drag to the
opposite corner, so adjusting one edge leaves the rest of the rectangle where
the knitter put it.

Three decisions worth recording:

- **A stray tap restores the rectangle rather than clearing it.** A tap is a
  drag of zero size, and the naive reading — a new, empty rectangle — would let
  one accidental touch destroy a carefully drawn crop. The crop as it was at
  `pointerdown` comes back instead.
- **Rounding to whole pixels rounds the rectangle's edges, not its position and
  size separately.** Rounded independently, a rectangle dragged flush to the
  right edge can land one pixel outside the image, which `_validated_crop`
  rejects — a failure the knitter caused by dragging *accurately*.
- **A third test seam, narrower than the spec's two.** `web/crop.js` is crop
  geometry, and the spec names gesture handling as deliberately untested. The
  geometry underneath it is pure, has no DOM in it, and is the part that can be
  silently wrong, so it is tested under `node --test` like seam 2 will be — no
  manifest, no dependency, still no build step.
