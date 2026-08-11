# Chart JSON contract

Type: grilling
Status: open
Blocked by: 06, 07

## Question

The stateless service takes an image and returns a Chart. That JSON is the seam between the Python parser and the on-device client, and it is the last thing this map has to settle — once it exists, `/to-spec` has a buildable plan.

It comes last deliberately: what the contract *can* carry depends on what [Automatic extraction spike](05-extraction-spike.md), [Overlay layer: outlines and symbols](06-overlay-layer.md), and [Validate the Non-stitch flood-fill rule](07-non-stitch-rule.md) prove extractable.

Settle:

1. **Cell encoding.** A 2D array of Palette indices is the obvious shape — compact, and it keeps Palette and Cells independent so a Colorway can be remapped without touching the grid. Confirm, and decide how **Non-stitch** is represented: a reserved index, a null, or a parallel mask.
2. **Palette representation.** RGB per entry, plus what else? An entry needs identity stable enough that a user renaming it to a real yarn — the Colorway mapping — survives.
3. **Confidence, if it exists.** If [Acceptance bar for automatic extraction](02-acceptance-bar.md) established a self-detection signal and the spike produced one, the contract must carry it, per-Chart or per-Cell. This is the difference between the client being able to flag a doubtful parse and the user discovering it mid-row.
4. **What the client needs that isn't Cells.** Grid dimensions are implied by the array, but the crop rectangle, source image dimensions, and pitch may be needed to overlay the parse back onto the original for correction.
5. **Versioning.** Charts persist on-device across future releases of the service, so a stored Chart will outlive the schema that produced it. Decide the versioning approach now — it is cheap now and expensive later.

**Resolved when** the JSON contract is written down concretely enough to implement on both sides, and the on-device storage shape sitting in the map's fog can graduate.
