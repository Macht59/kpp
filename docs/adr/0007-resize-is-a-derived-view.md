# Resizing a Chart derives a view, it does not produce a new Chart

A knitter whose gauge does not match the one a chart was drawn for wants the
pattern wider, taller, or both. The obvious place to put that is beside
Re-parse: resample the Cells, write the result into the library as a second
Chart, done. **Instead, Resize joins Separation, Blank edges and Repaints as a
knitter decision recorded against an untouched parse — `view()` resamples on
every derivation, and the library holds one Chart.**

## Considered Options

Baking the resample into a new Chart was rejected on reversibility. Sampling
down is lossy in a way the knitter cannot see coming: a single-Cell Repaint has
a coin-flip chance of not surviving a halving, and once written it is gone. A
knitter who tries 20 Columns, dislikes it, and goes back to 40 would get a
blurred copy of what they started with. Deriving instead means the parse is
always the thing being sampled, so 40 → 20 → 40 comes back Cell-for-Cell —
including every Repaint, because the overlay is applied at parse resolution
*before* the resample.

Putting size on the crop screen as parser input was rejected for the reason
[ADR-0006](0006-parse-returns-every-separation.md) rejected a sensitivity
setting: a knitter finds the right number by trying numbers, and every try
would be an upload, a ten-second wait and a connection. [ADR-0003](0003-stateless-service-on-device-charts.md)
already puts knitter decisions on the device; this is one of them.

The resample is nearest-neighbour, which is not a trade-off so much as a
constraint — any interpolation invents colours that are in no Palette entry and
in no knitter's yarn basket.

## Consequences

Anything that maps a knitter's finger back onto the parse has to invert the
resample as well as the trim. `repaint` does: it takes the co-ordinates of the
Chart on screen, so on a resized one it would otherwise write the overlay
against a Cell nothing reads. `frameTheImage` measures the crop in the parse's
Cells for the same reason. Both are downstream of `view()` and neither was on
the list below when this was written — reading the resized view unchanged and
mapping *back* through it are different things.

`view()` gains a stage and loses its current ordering. Blank edges are trimmed
*before* the resample, so "20 rows" means twenty of the Chart the knitter can
see rather than twenty including four blank ones. Everything downstream —
`measured`, `runsOfRow`, the library's size line, `frameTheImage` — reads the
resized view already and needs no change.

Resizing down discards Repaints silently. Accepted: nothing is lost
permanently, and a warning on every downward step would fire on the common case
where the knitter has made no corrections yet.

There is no upper bound on the size a knitter may type. `drawCells` fills one
rect per Cell and a paint drag re-derives on every pointer move, so a large
enough number will make the app stop responding, with no way out but closing
it. Knowingly shipped uncapped at the customer's request; the ceiling to fit is
a real device rather than a guess.

Selecting returns to Row 1 after a Resize rather than tracking the knitter's
place proportionally. Resize is a Review control and Review is where a Chart is
settled before it is knitted, so the case is rare — but it is the one place in
the app that discards the Selected Row on purpose, and it is worth knowing that
was chosen rather than missed.
