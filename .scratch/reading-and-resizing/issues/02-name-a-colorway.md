# 02 — Name a Colorway

**Blocked by:** None.

**Status:** done

**What to build:** the knitter typing their own name over `Colour A`.

`entryLabel` (`web/chart.js:60`) already prefers `palette[entry].name` and falls
back to the positional letter. Nothing has ever written a name. The parser
leaves it null and always will — this is the knitter's word, not the image's.

Names are stored **keyed by Separation and entry**, `${separation},${entry}`, in
a `names` map that joins `overlay`, `trimmed` and `separation` in the Chart's
record. Not on `palette[].name` and not keyed by entry alone: `paletteOf`
(`web/chart.js`) derives a fresh Palette per Separation and sets `name: null` on
every merged entry, and entry 3 at seven colours is a different colour from
entry 3 at nine. Keying by Separation is the same amount of code and is the only
version that cannot put a knitter's letter on a colour they never named.

`view()` applies the names onto the Palette it derives, so `entryLabel` and
every chip, swatch title and `aria-label` downstream pick them up unchanged.

The control is a list of `swatch + <input type="text">` in Review, its own
block, separate from the paint-arming Palette bar (`#palette-list`). Not a
long-press or a pencil on the swatch itself: a knitter correcting Cells who
holds a beat too long would get a keyboard instead of a Repaint.

No validation. Two entries may both be called `M` — it is their notation, both
swatches are on screen, and a modal on a phone is worse than a duplicate letter.
An empty input means no name, and the letter comes back.

- [x] A knitter can type a name for any Palette entry of the Separation on screen
- [x] The name appears on Readout chips, on swatch tooltips and in `aria-label`s
- [x] Clearing the input restores the positional letter
- [x] Duplicate names are accepted without complaint
- [x] Names persist with the Chart and survive reopen
- [x] Switching Separation shows that Separation's names, and switching back shows the first set again
- [x] Naming is Review only — the Knit chip Palette is unchanged
- [x] Tests cover: a named entry's label, a cleared name falling back to the letter, names surviving a Separation round trip, and a name never leaking onto an entry of another Separation
