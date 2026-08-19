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

**Column**:
One vertical line of Cells in a Chart. Has no knitting meaning of its own — it exists so a Chart's vertical extent can be talked about.
_Avoid_: Stitch column, file

**Blank edge**:
A Row or Column at a Chart's edge that holds no pattern — the white space the image carries around the chart, taken into the crop. Hidden from the Chart the knitter reads, but never removed from it, so it can be shown again. Distinct from Non-stitch, which is background *inside* the silhouette and is yarn's absence rather than the image's margin.
_Avoid_: Margin, whitespace, border, padding, trim

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
A Palette entry under the name the knitter calls it by. Until they say otherwise the name is a letter standing for the entry's position — Colour A, Colour B — and they may rename it to anything: another letter that matches the paper pattern in front of them, or the yarn they are knitting it in.
_Avoid_: Yarn colour, thread, alias, colour name

**Separation**:
How finely a parse divides near colours into distinct Palette entries — whether a light green and a dark green are one entry or two. A parse returns several Separations of the same Chart, coarse to fine, and the knitter picks the one whose Palette matches the yarns in front of them. Choosing a different Separation is not a Re-parse: the Chart does not change, only how many colours it is read as having.
_Avoid_: Sensitivity, tolerance, threshold, granularity, merge distance

**Repaint**:
To set a Cell, or a contiguous span of Cells, to a different Palette entry — or to Non-stitch. A Repaint is the knitter's own statement about a Cell, so it outlives a change of Separation.
_Avoid_: Recolour, fill, edit

**Re-parse**:
To adjust the crop or lattice a Chart was parsed with and parse the image again, producing a new Chart. Repaints do not carry across, because re-gridding changes which Cell is which.
_Avoid_: Re-crop, refresh, redo

**Resize**:
To read a Chart at a different number of Rows and Columns than it was parsed at, the pattern sampled up or down to fit — the knitter's answer to a chart drawn for a gauge that is not theirs. Height and width move independently. Not a Re-parse and not a Repaint: the parse is untouched, so a Resize is undone by resizing back, and detail lost on the way down comes back on the way up.
_Avoid_: Scale, zoom, stretch, resample

### Reading

**Select**:
To mark a Row as the one being knitted, highlighting it and showing its readout.
_Avoid_: Choose, pick, activate

**Readout**:
The text describing a Row's Runs in reading order — how many Cells of which colour, in sequence. One per Worked row, so a Row worked twice has two: the second is the first reversed, because it is the same stitches worked back.
_Avoid_: Instructions, transcript, description

**Reading direction**:
Which way a single Row is read: left-to-right or right-to-left. A property of reading a Row, never of the stored Chart.
_Avoid_: Orientation, reading order, direction mode

**Flip**:
To set one Row's Reading direction by hand, against what the Construction implies — how a knitter recovers when the alternation has slipped.
_Avoid_: Override, toggle, reverse

**Construction**:
How the garment is knitted, and therefore both whether Reading direction alternates each Row and how many Worked rows a Row is. Flat turns the work every Row, so the direction alternates. In the round never turns, so it holds. Flat doubled turns the work but knits the way back off the previous row rather than off the Chart — so every Row is two Worked rows, and the direction holds, because the Chart is only ever read on the way out.
_Avoid_: Reading direction, reading mode, style

**Worked row**:
A row on the needles, counted as the knitter counts them. Usually one per Row, but a Construction that works each Row twice — out following the Chart, back repeating it — makes two Worked rows of every Row. The Chart's size never changes with it; only the numbers on screen do.
_Avoid_: Real row, physical row, needle row, doubled row

**Knit**:
To work a Chart Row by Row: Select a Row, read its Readout, advance to the next.
_Avoid_: Read, play, follow

**Review**:
To check a parsed Chart against the image it came from and correct what is wrong. Every parse is Reviewed; a Chart can be Reviewed again at any time.
_Avoid_: Verify, approve, proofread
