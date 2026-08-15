# A parse returns every Separation, not a sensitivity setting

The parser recovers a Palette by clustering Cell colours and choosing the merge cutoff at the widest plateau of a threshold sweep ([ticket 04](../../.scratch/chart-parsing/issues/04-palette-recovery.md)). The plateau is the most stable answer, not always the right one: on a noisy chart the winning cutoff sits around ΔE 20–25, and a light green and a dark green fall inside that, so they come back as one Palette entry. Rather than exposing the cutoff as a setting that triggers a new parse, **one parse returns every plateau — up to the widest eight — and the knitter switches between them on the device.**

## Considered Options

The obvious design is a sensitivity control fed back into `parse_chart`, with each change a Re-parse. It was rejected once the cost of a Re-parse was counted against the nature of the mistake: the knitter does not know the right value, they discover it by trying, and every try is an upload, a wait, and — because a Re-parse produces a new Chart — the loss of every Repaint made so far. A setting that has to be found by experiment must be cheap to experiment with.

An absolute scale (a dial mapped onto ΔE 1–40) was rejected on evidence already in the repo: ticket 04 measured a cutoff of 3.0 as correct on one chart and over-segmenting by 13× on another, because within-colour spread scales with image noise. The same dial position means different things on different images, so the knitter would be calibrating per chart.

Shipping a full `cells` array per Separation was rejected for payload and for correctness. The clustering is hierarchical, so coarser answers are strict merges of finer ones — never a re-shuffle. That lets each Separation ship as a merge map over a single `cells` array: a handful of integers instead of an eight-fold duplication that a Repaint would then have to be written into eight times.

## Consequences

The Chart contract goes to `schema_version: 2`. `palette` changes meaning — it now holds the *finest* Separation, which can be 15–40 near-duplicate entries, and is a base for the merge maps rather than something to show a knitter. Anything reading `palette` as "the colours of this Chart" is wrong under v2, which is why the version moves rather than the field being quietly redefined.

Because Separations are switched rather than parsed, a Repaint has to survive the switch, and it cannot be an index into a Palette that is about to change. Repaints become a sparse overlay of chosen colour (or Non-stitch) per Cell, applied over whichever Separation is in force.

`confidence.cells` is computed once, at the default Separation, and left alone. Its second signal — how far a Cell sits between two Palette entries — is genuinely Separation-dependent, so after a switch it points at slightly the wrong Cells. Accepted: the list only steers the eye during Review and never touches the Chart.

Blank edge detection runs on the device against the Separation in force, so hidden Rows and Columns stay consistent with the colours on screen; the knitter's decision to show them again is sticky per Chart, while their extent recomputes.

The near-white gate that Blank edge detection turns on is unfitted. No chart in `tests/examples/` reproduces the merged-greens case either — three of the four are two-colour. Both were knowingly shipped to be checked against the customer's own charts rather than held for a corpus that does not exist yet.
