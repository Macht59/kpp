# 08 — Re-parse and start over

**What to build:** Some parses come back structurally wrong — the dimensions
are off because the crop caught a number gutter or missed a Row. That cannot be
fixed Cell by Cell; it has to be redone. A knitter who sees it in Review
adjusts the crop on the stored source image and parses again, without hunting
for the original file. And when a chart simply will not parse, they abandon it
and upload something else.

**Re-parse writes a new Chart into the library rather than overwriting the
original.** [Ticket 09](../../chart-parsing/issues/09-correction-vocabulary.md)
discards Repaints across a re-grid by design, because re-gridding changes which
Cell is which — so a knitter who has spent twenty minutes correcting Cells
could destroy that work with one tap. With a library already built, making the
operation non-destructive costs nothing, and it lets the knitter compare two
crops before deleting either.

*Start over* is the same path from a blank crop, kept as a named escape hatch.

This is the structural-tier correction from the vocabulary; the Cell-tier one
is [ticket 06](06-repaint.md). The distinction is load-bearing: structural
errors are redone, Cell errors are repainted.

**Blocked by:** 02 — Draw the crop rectangle; 05 — Review a parse against its
image; 07 — The Chart library on the device.

**Status:** resolved

- [x] From Review, a knitter can adjust the crop against the stored source image and parse again
- [x] Re-parse produces a **new** Chart in the library; the original is untouched
- [x] Both Charts are distinguishable in the library so the knitter can tell which crop was better
- [x] A knitter can delete whichever they do not want
- [x] A knitter can abandon a parse entirely and upload a different image
- [x] The knitter is not asked to find the original file again — the stored image is used

## Comments

**Re-parse is the crop step, reached from the other end.** The upload flow and
this one now meet in one function, `cropAgain(image, name, rect)`: an image, the
name the next parse will be kept under, and a rectangle to start from — `null`
for a chosen file, the Chart's own `source.crop` for a Re-parse, `null` again
for *Start over*, which is why start over needed no path of its own. Everything
downstream of the crop step was already indifferent to where the image came
from, so parsing, keeping and Review took no change at all.

**The stored image is the one being cropped.** Opening a Chart from the library
already read its image back for Review's comparison; that blob is now also what
`chosen` points at, so *Adjust the crop and parse again* has the image to hand
and the knitter is never sent looking for a file they uploaded last week. Charts
go into IndexedDB as `File`s and come back as `File`s, so the name survives with
them and the upload needs no separate filename.

**Nothing is written over.** `show()` already cleared `openId` and kept whatever
lands as a Chart of its own, so a Re-parse is non-destructive without a decision
being made here — the original keeps its Repaints, and the two crops sit in the
library together.

**Telling the two apart** is a suffix and a size. A Re-parse is kept under the
old name plus ` (re-parse)`, stacked rather than added once — a fourth crop is a
fourth name, and two rows reading the same thing is the failure this criterion
names — and every library row now states its Chart's dimensions under the name.
The suffix says which is the retry; the dimensions say which crop was right,
which is the
question the knitter opened the library to answer — a Row short is exactly the
error a Re-parse is reached for. Renaming is already there for anyone who wants
better than a suffix.

**Deleting a Chart mid-Re-parse.** The object URL its image is drawn through is
released when a Chart is deleted, which would blank the image under the
rectangle if the knitter deletes the original while re-cropping it. The delete
now leaves it alone while the crop step is up; `chosen` still holds the blob, so
the Re-parse finishes and the new Chart lands even though the old one is gone.

**Abandoning a chart that will not parse** stayed the upload control, which is
always on screen. It now goes through `cropAgain` like everything else, so
choosing another image takes the old Chart off the screen rather than leaving it
under the new rectangle.

**From review.** Opening a Chart from the library now clears the rectangle and
shuts both parse buttons: they sit outside the crop step and stayed live over a
hidden stage, so a tap would have parsed the opened Chart's image with the last
crop drawn — and kept the result as a second Chart of the same name. *Use whole
image* waits for the image to load, because the image's size is zero until then
and a 0×0 crop comes back as a complaint about a rectangle the knitter never
drew. And the file input clears itself, so choosing the same image again counts
as a change: abandoning a parse and re-uploading what you just uploaded is a
thing a knitter does.

One finding was left alone as another ticket's: the crop is drawn in
EXIF-oriented pixels — the browser rotates what it displays — and `_decode`
opens the image without `ImageOps.exif_transpose`, so a phone-camera capture
with a rotation flag is cropped in the wrong frame. That is a parsing-side bug,
older than this ticket and not touched by it.

Nothing here is chart logic, so nothing here is under test: this ticket is the
crop step, storage and the library list, which the spec puts in the same
deliberately-untested bucket as canvas pixels and gestures. Both suites still
pass — 26 Node, 63 pytest.
