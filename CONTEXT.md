# Knitting Pattern Parser

Converts an image of a knitting colorwork chart into a digital Chart a knitter can read row by row.

## Language

### The chart

**Chart**:
A complete gridded colorwork pattern, as a lattice of Cells.
_Avoid_: Pattern, grid, image

**Cell**:
One square of a Chart, holding exactly one Palette entry.
_Avoid_: Pixel, square, stitch, section

**Row**:
One horizontal line of Cells in a Chart, corresponding to one knitted row.
_Avoid_: Line

**Run**:
A span of consecutive Cells within a Row sharing the same Palette entry.
_Avoid_: Section, block, group, segment

**Non-stitch**:
A Cell inside the Chart's bounds that is background rather than yarn — the area outside a garment's silhouette. Rendered transparent.
_Avoid_: Empty, blank, null cell

### Colour

**Palette**:
The set of distinct colours a Chart uses.
_Avoid_: Colours, swatch

**Colorway**:
A Palette entry mapped to an actual yarn the knitter will use.
_Avoid_: Yarn colour, thread

### Reading

**Select**:
To mark a Row as the one being knitted, highlighting it and showing its readout.
_Avoid_: Choose, pick, activate

**Readout**:
The text describing a Row's Runs in reading order — how many Cells of which colour, in sequence.
_Avoid_: Instructions, transcript, description
