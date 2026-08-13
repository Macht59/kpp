# 10 — A photo taken in portrait is parsed sideways

Type: task
Status: ready-for-agent

## What goes wrong

A phone camera almost never rotates the pixels it writes. Holding the phone
sideways, it stores the image the way the sensor read it and writes a small
number beside it — the EXIF orientation tag — saying "show this rotated a
quarter turn". Every photo viewer, and every browser, honours that tag, so the
picture looks upright everywhere a person ever sees it.

`_decode` in `kpp/parser.py` does not honour it. `Image.open(...).convert("RGB")`
hands back the stored pixels, ignoring the tag, so the parser sees the sideways
image the knitter never saw.

The crop makes it worse rather than being unaffected by it. The knitter drags
their rectangle on the *browser's* upright picture, and those coordinates are
sent to a parser holding the picture on its side. So the rectangle lands
somewhere else entirely: a crop of the wrong region, in the wrong frame, at
dimensions that are swapped.

There is no error. What comes back is a Chart of whatever happened to be under
the misplaced rectangle — a plausible Chart, of the wrong thing.

## Who hits it

Only a photograph *of* a chart, taken with a phone held sideways, or a photo
straightened afterwards in a photos app. A screenshot of a published pattern —
the case the whole app was built around, and every image in the corpus — carries
no orientation tag and is unaffected. That is why this has never been seen:
nothing in the corpus can show it.

## The fix

`ImageOps.exif_transpose` applies the tag and drops it, giving the parser the
same upright pixels the knitter cropped on. It belongs in `_decode`, at the one
place images enter, so nothing downstream — the crop validation, `image_width`
and `image_height` in the `source` block, the stored image the client re-crops
against — has to know the tag exists.

## Where it came from

Found while reviewing [web-ui ticket 08](../../web-ui/issues/08-re-parse-and-start-over.md)
and left alone there: it is parsing-side, older than the web client, and not
touched by that ticket.

- [ ] A photo with an EXIF orientation tag is parsed in the orientation a viewer shows it in
- [ ] The `source` block's `image_width` and `image_height` describe that same upright image, so the client's crop and the parser's agree
- [ ] A test covers it — a corpus image re-saved with an orientation tag parses to the same Chart as the original, and no corpus image is needed to write the fixture
- [ ] Images with no tag are unchanged, so every existing corpus result holds
