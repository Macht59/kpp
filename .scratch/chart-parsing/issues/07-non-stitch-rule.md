# Decide how Non-stitch Cells are identified

Type: prototype
Status: resolved
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

## Answer

**v1 auto-detects no Non-stitch. Flood-fill is confirmed as the right rule but ships as a user-invoked correction tool, not an automatic pass. Glyphs are delegated entirely to manual correction.** Decision made HITL, confirmed by the user.

Prototype on branch `prototype/non-stitch-rule` (throwaway, kept): [`prototype/extraction-spike/nonstitch.py`](../../../prototype/extraction-spike/nonstitch.py), findings in [`README-nonstitch.md`](../../../prototype/extraction-spike/README-nonstitch.md), masks in `prototype/extraction-spike/out/*.nonstitch.png`. It reuses the ticket-05 pipeline unchanged and flood-fills the background Palette entry from the crop border.

### Failure mode #2 is the whole ballgame — and it fires

| chart | shape | Non-stitch present | border flood-fill result |
|---|---|---|---|
| `112w150h` | silhouette (vest) | yes | **traced the garment exactly**; eyes + mug preserved as enclosed yarn |
| `66w55h` | full rectangle | **none** | **deleted 2500 / 3630 real white-background stitches** |
| `74w38h` | full rectangle | **none** | deleted 1023–1220 real stitches; auto-seed picked the *dark* colour as background |
| `8w37h` | glyph (X) | yes | flooded all 146 cream cells; never isolated the X cells |

"Background colour + touches the crop edge + contiguous" describes an ordinary rectangular design's background yarn (66w55h white, 8w37h cream) exactly as well as it describes true Non-stitch. **Connectivity is not a discriminator.** So automatic border flood-fill silently deletes real stitches on 3 of the 4 corpus charts — catastrophic on the common full-rectangle case. This kills automatic detection: there is no guard that separates the two cases, because they are the same case.

### The rule is sound; the trigger was wrong

Against the ticket's probe list:

- **#1 / #2-enclosed — silhouette flood-fill itself works.** Seeded from *inside* the background region it traced the vest and preserved enclosed white yarn (dog's eyes, coffee mug). The rule is confirmed for the silhouette case.
- **#3 — background is not reliably one light entry.** On the scan the auto-seed picked the *dark* colour. "Light = background" is unsafe; the colour must come from the user's tap.
- **#4 — connectivity didn't bite.** 4-conn == 8-conn on the one silhouette (2268/131 either way). The staircase-armhole worry is unfalsified but also unobserved; it's a build knob, not a map decision.
- **#5 — the fallback and the fix are the same gesture.** "User picks the background entry" collapses into "user taps a background Cell": the tap supplies both the seed and the colour.
- **#6 — collision is moot.** With no auto-detection, flood-fill and glyph detection never disagree; the user marks whatever the chart uses.
- **Glyph detection via the free spread signal is a dead end.** 8w37h's X cells lift within-Cell spread (hi-frac 18%), but the glyph-free noisy scan `74w38h` is just as elevated — mark-vs-noise is confounded, and "has a mark" ≠ "is Non-stitch" regardless. Not worth building; n=1 of 4.

### The decision

- **Default: every Cell is a stitch.** The only default that never silently deletes yarn. Per [Acceptance bar for automatic extraction](02-acceptance-bar.md), an all-stitches parse on a silhouette chart is a correction burden, not a broken product.
- **Flood-fill ships as a correction tool**, seeded from a user tap: tap a background region → mark the contiguous same-colour Cells Non-stitch. Seeding from a tap instead of the border is exactly what removes the false-deletion danger — the user only invokes it where Non-stitch actually is, and the tap picks the colour.
- **Glyph/X charts use the same manual tool.** No glyph or symbol detection in v1.

### Hands forward

- **[Correction vocabulary](09-correction-vocabulary.md)** gains the flood-fill-from-tap gesture and the Non-stitch mark/unmark action, plus the connectivity knob (4 vs 8) as a build detail.
- **[Chart JSON contract](08-chart-contract.md)** needs a per-Cell Non-stitch representation (a Cell is stitch-with-Palette-entry or Non-stitch/transparent) — the contract's Palette must not have to carry a fake "background" entry.
- **No auto Non-stitch code in v1** — nothing to build on the extraction side; the whole mechanism lives in the correction UI.
