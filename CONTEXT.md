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

**Chart library**:
The set of Charts held on the knitter's device, each kept alongside the image it was parsed from.
_Avoid_: Collection, projects, gallery

### Colour

**Palette**:
The set of distinct colours a Chart uses.
_Avoid_: Colours, swatch

**Colorway**:
A Palette entry mapped to an actual yarn the knitter will use.
_Avoid_: Yarn colour, thread

**Repaint**:
To set a Cell, or a contiguous span of Cells, to a different Palette entry — or to Non-stitch.
_Avoid_: Recolour, fill, edit

**Re-parse**:
To adjust the crop or lattice a Chart was parsed with and parse the image again, producing a new Chart. Repaints do not carry across, because re-gridding changes which Cell is which.
_Avoid_: Re-crop, refresh, redo

### Reading

**Select**:
To mark a Row as the one being knitted, highlighting it and showing its readout.
_Avoid_: Choose, pick, activate

**Readout**:
The text describing a Row's Runs in reading order — how many Cells of which colour, in sequence.
_Avoid_: Instructions, transcript, description

**Reading direction**:
Which way a single Row is read: left-to-right or right-to-left. A property of reading a Row, never of the stored Chart.
_Avoid_: Orientation, reading order, direction mode

**Flip**:
To set one Row's Reading direction by hand, against what the Construction implies — how a knitter recovers when the alternation has slipped.
_Avoid_: Override, toggle, reverse

**Construction**:
How the garment is knitted — flat or in the round — and therefore whether Reading direction alternates each Row (flat, because the work is turned) or stays constant (in the round, because it never is).
_Avoid_: Reading direction, reading mode, style

**Knit**:
To work a Chart Row by Row: Select a Row, read its Readout, advance to the next.
_Avoid_: Read, play, follow

**Review**:
To check a parsed Chart against the image it came from and correct what is wrong. Every parse is Reviewed; a Chart can be Reviewed again at any time.
_Avoid_: Verify, approve, proofread
