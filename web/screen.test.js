// node --test "web/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeEntries, view } from "./chart.js";
import {
  KNIT,
  REVIEW,
  blankWords,
  measured,
  paletteWords,
  readoutFlow,
  keptInProportion,
  rowAfterAdopting,
  rowAfterResizing,
  rowOnOpening,
  rowWords,
  screenFor,
  separationChoices,
  updateOffer,
  versionWords,
} from "./screen.js";
import { VERSION } from "./version.js";

/** Two Separations over one Chart: white and off-white are one colour, then two. */
const CHART = {
  schema_version: 2,
  dimensions: { rows: 3, cols: 4 },
  palette: [
    { rgb: [255, 255, 255], name: null }, // L* 100
    { rgb: [245, 245, 245], name: null }, // L* 96.5 — inside the blank gate
    { rgb: [20, 20, 20], name: null },
  ],
  cells: [
    [0, 0, 0, 0],
    [1, 2, 2, 1],
    [0, 2, 2, 0],
  ],
  separations: [
    { colours: 2, merge: [0, 0, 1] },
    { colours: 3, merge: [0, 1, 2] },
  ],
  default_separation: 0,
};

/** A Chart from before Separations existed: one answer, so nothing to choose. */
const V1 = { ...CHART, schema_version: 1, separations: undefined, default_separation: undefined };

const READ = { separation: undefined, trimmed: true, overlay: {} };

test("a Chart is measured in the words Review and the library both use", () => {
  assert.equal(measured(view(CHART, { ...READ, trimmed: false })), "3 rows × 4 columns");
});

test("one colour is a colour and the rest are colours", () => {
  assert.equal(paletteWords(1), "1 colour");
  assert.equal(paletteWords(7), "7 colours");
});

test("the chooser is hidden when the parse offered one answer", () => {
  const shown = view(V1, READ);
  assert.equal(separationChoices(V1, shown).hidden, true);
});

test("the answers are labelled by the count the knitter holds against their yarns", () => {
  const shown = view(CHART, READ);
  const { hidden, labels } = separationChoices(CHART, shown);
  assert.equal(hidden, false);
  assert.deepEqual(labels, ["2 colours", "3 colours"]);
});

test("the answer marked is the one being read, not the knitter's choice", () => {
  // Chosen nothing: the parser's default is what is on screen, so it is marked.
  assert.equal(separationChoices(CHART, view(CHART, READ)).marked, 0);
  const chosen = { ...READ, separation: 1 };
  assert.equal(separationChoices(CHART, view(CHART, chosen)).marked, 1);
});

test("the answer being read says what a Merge has done to it", () => {
  // The count beside the marked answer is the count on screen, and the two would
  // otherwise disagree with no explanation. The others keep the parse's own
  // counts, because that is what switching to them gives.
  const fine = { ...READ, separation: 1 };
  const merged = mergeEntries(CHART, fine, 0, 1);
  const { labels, marked } = separationChoices(CHART, view(CHART, merged));
  assert.deepEqual(labels, ["2 colours", "3 colours (2 merged)"]);
  assert.equal(marked, 1);
});

test("a crop that landed clean says nothing at all", () => {
  const said = blankWords({ blank: { top: 0, bottom: 0, left: 0, right: 0 }, trimmed: true });
  assert.equal(said.hidden, true);
});

test("the blank lines are counted per direction, singular and plural", () => {
  const one = blankWords({ blank: { top: 1, bottom: 0, left: 0, right: 1 }, trimmed: true });
  assert.equal(one.words, "1 blank row and 1 blank column hidden");
  const many = blankWords({ blank: { top: 1, bottom: 1, left: 2, right: 0 }, trimmed: true });
  assert.equal(many.words, "2 blank rows and 2 blank columns hidden");
});

test("a Chart blank in one direction only says only that", () => {
  const said = blankWords({ blank: { top: 2, bottom: 0, left: 0, right: 0 }, trimmed: true });
  assert.equal(said.words, "2 blank rows hidden");
});

test("the control offers the way back to whichever state the knitter is not in", () => {
  const blank = { top: 1, bottom: 0, left: 0, right: 0 };
  assert.equal(blankWords({ blank, trimmed: true }).control, "Show them");
  const showing = blankWords({ blank, trimmed: false });
  assert.equal(showing.control, "Hide them again");
  assert.equal(showing.words, "1 blank row shown");
});

test("hiding the Rows beneath Row 1 keeps the knitter on the Row they were on", () => {
  const shown = { trimmed: false, blank: { top: 1, bottom: 2, left: 0, right: 0 } };
  const next = { trimmed: true, blank: { top: 1, bottom: 2, left: 0, right: 0 } };
  assert.equal(rowAfterAdopting(5, shown, next), 3);
  assert.equal(rowAfterAdopting(3, next, shown), 5); // and back again
});

test("a Row that would fall off the bottom lands on Row 1 instead", () => {
  const shown = { trimmed: false, blank: { top: 0, bottom: 4, left: 0, right: 0 } };
  const next = { trimmed: true, blank: { top: 0, bottom: 4, left: 0, right: 0 } };
  assert.equal(rowAfterAdopting(2, shown, next), 1);
});

test("a decision that hides nothing beneath Row 1 leaves the Row alone", () => {
  const blank = { top: 3, bottom: 0, left: 2, right: 0 };
  assert.equal(rowAfterAdopting(4, { trimmed: false, blank }, { trimmed: true, blank }), 4);
});

test("a Chart kept before the edges could be hidden opens on the Row it was left on", () => {
  const shown = { trimmed: true, blank: { top: 0, bottom: 2, left: 0, right: 0 } };
  assert.equal(rowOnOpening({ selected: 7 }, shown), 5);
});

test("a legacy Row the hidden edges would push below Row 1 is the Row the knitter was on", () => {
  const shown = { trimmed: true, blank: { top: 0, bottom: 4, left: 0, right: 0 } };
  assert.equal(rowOnOpening({ selected: 3 }, shown), 3);
});

test("a Chart opened with its edges shown is opened on the Row it was numbered against", () => {
  const shown = { trimmed: false, blank: { top: 0, bottom: 4, left: 0, right: 0 } };
  assert.equal(rowOnOpening({ selected: 3 }, shown), 3);
});

test("a record that says how it was read is opened at the Row it says", () => {
  const shown = { trimmed: true, blank: { top: 0, bottom: 4, left: 0, right: 0 } };
  assert.equal(rowOnOpening({ selected: 3, trimmed: true }, shown), 3);
  assert.equal(rowOnOpening({ selected: 6, trimmed: false }, shown), 6);
});

test("Review and Knit are never both up, and neither is without a Chart", () => {
  const reviewing = screenFor(REVIEW, true);
  assert.deepEqual([reviewing.review, reviewing.knit, reviewing.chrome], [true, false, true]);
  const knitting = screenFor(KNIT, true);
  assert.deepEqual([knitting.review, knitting.knit, knitting.chrome], [false, true, true]);
  const empty = screenFor(REVIEW, false);
  assert.deepEqual([empty.review, empty.knit, empty.chrome], [false, false, false]);
});

test("the way out of a mode is named for where it goes", () => {
  assert.equal(screenFor(REVIEW, true).switchLabel, "Knit this chart");
  assert.equal(screenFor(KNIT, true).switchLabel, "Review this parse");
});

test("a shell waiting behind a running one is offered, and named for what it does", () => {
  const offered = updateOffer({ waiting: true, running: true });
  assert.equal(offered.hidden, false);
  assert.equal(offered.control, "Reload to update");
});

test("the first install is not an update, so the knitter is not asked to reload onto it", () => {
  assert.equal(updateOffer({ waiting: true, running: false }).hidden, true);
});

test("a shell with nothing behind it says nothing", () => {
  assert.equal(updateOffer({ waiting: false, running: true }).hidden, true);
});

test("the running shell says which version it is, whatever the build stamped", () => {
  assert.equal(versionWords("0.2.0"), "Version 0.2.0");
  // Unstamped is a version too — a knitter reading `dev` back over the phone is
  // saying they are not on a release, which is the answer that was wanted.
  assert.equal(versionWords(VERSION), "Version dev");
});

test("consecutive chips on one line are joined by a continue arrow", () => {
  assert.deepEqual(readoutFlow([0, 0, 0]), ["→", "→"]);
});

test("a chip that starts a new line is reached by a wrap mark", () => {
  assert.deepEqual(readoutFlow([0, 0, 52, 52, 104]), ["→", "↵", "→", "↵"]);
});

test("a Readout of one Run has no separator at all", () => {
  assert.deepEqual(readoutFlow([0]), []);
  assert.deepEqual(readoutFlow([]), []);
});

test("a Row worked once is named alone, with its stitches", () => {
  assert.equal(rowWords([3], 20, 42), "Row 3 of 20 — 42 stitches");
});

test("a Row worked out and back is named as both Worked rows", () => {
  assert.equal(rowWords([5, 6], 40, 42), "Rows 5 and 6 of 40 — 42 stitches");
  assert.equal(rowWords([1, 2], 40, 8), "Rows 1 and 2 of 40 — 8 stitches");
  assert.equal(rowWords([39, 40], 40, 8), "Rows 39 and 40 of 40 — 8 stitches");
});

test("a Resize puts the knitter back on Row 1, and a decision that is not one leaves them", () => {
  const size = { rows: 40, cols: 30 };
  assert.equal(rowAfterResizing(12, undefined, size), 1);
  assert.equal(rowAfterResizing(12, size, { rows: 40, cols: 20 }), 1);
  assert.equal(rowAfterResizing(12, size, { ...size }), 12); // the size they are already reading at
  assert.equal(rowAfterResizing(12, undefined, undefined), 12); // a Separation, or the Blank edges
});

test("keeping proportions drives the field the knitter did not type in", () => {
  const base = { rows: 100, cols: 20 };
  assert.deepEqual(keptInProportion(base, { rows: 50 }), { rows: 50, cols: 10 });
  assert.deepEqual(keptInProportion(base, { cols: 10 }), { rows: 50, cols: 10 });
  assert.deepEqual(keptInProportion(base, { rows: 1 }), { rows: 1, cols: 1 }); // never none of a Chart
});

test("a Chart read at a size the knitter asked for does not renumber when the edges are shown", () => {
  // The resample fills the Rows they asked for whether the Blank edges are in
  // it or not, so nothing appears beneath Row 1 to renumber the Rows above.
  const shown = { trimmed: true, blank: { top: 1, bottom: 3, left: 0, right: 0 } };
  const next = { trimmed: false, blank: { top: 1, bottom: 3, left: 0, right: 0 } };
  assert.equal(rowAfterAdopting(20, shown, next, { rows: 40, cols: 30 }), 20);
  assert.equal(rowAfterAdopting(20, shown, next), 23); // and unresized, it renumbers as ever
});
