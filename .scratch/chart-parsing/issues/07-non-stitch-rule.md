# Decide how Non-stitch Cells are identified

Type: prototype
Status: open
Blocked by: 05

## Question

The rule decided during charting: the user crops to a rectangle, and Cells inside it that are background become **Non-stitch** and render transparent. Non-stitch is identified by flood-fill from the rectangle's outer edge — a contiguous background-coloured region touching the border is not stitches, while an enclosed region of the same colour is real yarn. The fallback if this misfires: the user picks which Palette entry means background.

The rule is sound in principle — in the example, white *outside* the garment silhouette is background while white *inside* it would be yarn, and only connectivity distinguishes them. It has not been tested.

> **The corpus already broke it, before this ticket was worked.** `8w37h.png` marks its Non-stitch Cells with an **X glyph drawn over an ordinary background-coloured Cell**. There is no distinct colour to flood and no guarantee the marked region touches the crop edge — the X-marked Cells sit *within* the chart. Flood-fill cannot find them by any tuning, because the chart is not encoding Non-stitch by colour at all; it is encoding it by symbol.
>
> So this ticket is no longer "validate a rule" — it is **"decide the rule"**, with at least two mechanisms known to occur in the wild:
>
> - **Silhouette** (`112w150h.png`) — Non-stitch is the background colour outside a garment shape. Connectivity distinguishes it from same-coloured yarn.
> - **Glyph** (`8w37h.png`) — Non-stitch is an ordinary Cell bearing a mark. Colour and connectivity both say "stitch"; only the symbol says otherwise.
>
> These are not variants of one rule. Detecting a glyph is symbol recognition, which the map currently rules out of v1 — the *only* symbols v1 was to understand were none. That collision has to be resolved here: either v1 reads one class of glyph (a marked-Cell detector, not a symbol vocabulary — "this Cell has something drawn on it" is a far weaker question than "which symbol is it"), or v1 handles the silhouette case automatically and leaves glyph charts entirely to manual correction, which is now the normal flow anyway per [Acceptance bar for automatic extraction](02-acceptance-bar.md).
>
> Note that the second option is cheap and honest: with the user reviewing every parse, a glyph chart that comes back with X-Cells rendered as ordinary stitches is a correction burden, not a broken product. Weigh it against how common glyph marking turns out to be — n=1 of 4 here is not a frequency estimate.

Validate the flood-fill rule on the silhouette case, and probe the cases that should break it:

1. **Does a background region ever fail to touch the crop edge?** If a user crops loosely, the background may be fully enclosed by chart content and the fill never reaches it.
2. **Does real yarn ever touch the edge in the background colour?** A garment whose stitches run to the chart's edge in white would be flooded away — silently deleting real stitches, a far worse failure than leaving background in.
3. **Is background reliably one Palette entry?** If the chart's background is white but its gridlines make edge Cells grey, the fill may stop at the first gridline-darkened Cell and clear almost nothing.
4. **Diagonal connectivity.** Staircase shaping like the example's armholes meets at corners. Does 4-connectivity strand background wedges that 8-connectivity would reach, and does 8-connectivity leak through diagonal gaps into real stitches?
5. **Does the fallback actually rescue it?** When the fill is wrong, does "user picks the background Palette entry" fix it, or does it fail identically because the problem was connectivity rather than colour?

6. **Do the two mechanisms ever collide?** A garment-shaped chart that *also* uses X glyphs — for a thumb gusset, say — would need both. If flood-fill and glyph detection disagree about a Cell, which wins?

**Resolved when** there is a decision on which Non-stitch mechanisms v1 detects and which it delegates to manual correction; the flood-fill rule is confirmed, amended (connectivity choice, tolerance, seeding), or replaced for the silhouette case; and the failure mode that silently removes real stitches is shown either not to occur or to be detectable.
