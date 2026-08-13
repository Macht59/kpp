// node --test "web/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FLAT,
  IN_THE_ROUND,
  LEFT_TO_RIGHT,
  RIGHT_TO_LEFT,
  cellsOfRow,
  entryLabel,
  readingDirection,
  rowCount,
  rowIndex,
  rowNumber,
  runsOfRow,
} from "./chart.js";

// Small enough to read: three Rows, the bottom one alternating, the middle one
// holding Non-stitch. Row numbers run bottom to top, so cells[2] is Row 1.
const CHART = {
  schema_version: 1,
  dimensions: { rows: 3, cols: 6 },
  palette: [
    { rgb: [255, 255, 255], name: null },
    { rgb: [20, 20, 20], name: null },
    { rgb: [178, 96, 72], name: "Rust" },
  ],
  cells: [
    [2, 2, 2, 2, 2, 2],
    [0, -1, -1, 1, 1, 1],
    [0, 1, 0, 1, 0, 1],
  ],
};

/** One Row on its own, so a test can state the Cells it means. */
const rowOf = (cells) => ({
  ...CHART,
  dimensions: { rows: 1, cols: cells.length },
  cells: [cells],
});

const counted = (runs) => runs.map(({ entry, count }) => ({ entry, count }));

test("consecutive Cells of the same Palette entry collapse into one Run with a count", () => {
  assert.deepEqual(counted(runsOfRow(rowOf([0, 0, 0, 1, 1, 2]), 1, LEFT_TO_RIGHT)), [
    { entry: 0, count: 3 },
    { entry: 1, count: 2 },
    { entry: 2, count: 1 },
  ]);
});

test("Non-stitch Cells are omitted and split the Runs around them", () => {
  assert.deepEqual(counted(runsOfRow(rowOf([0, -1, -1, 1, 1, 1]), 1, LEFT_TO_RIGHT)), [
    { entry: 0, count: 1 },
    { entry: 1, count: 3 },
  ]);
  // the same entry either side stays two Runs — joining across would overcount
  assert.deepEqual(counted(runsOfRow(rowOf([1, -1, 1]), 1, LEFT_TO_RIGHT)), [
    { entry: 1, count: 1 },
    { entry: 1, count: 1 },
  ]);
});

test("Row 1 is the bottom of the image and the last array Row", () => {
  assert.equal(rowCount(CHART), 3);
  assert.deepEqual(cellsOfRow(CHART, 1), [0, 1, 0, 1, 0, 1]);
  assert.deepEqual(cellsOfRow(CHART, 3), [2, 2, 2, 2, 2, 2]);
  assert.equal(rowIndex(CHART, 1), 2);
  assert.equal(rowIndex(CHART, 3), 0);
  assert.equal(rowNumber(CHART, 0), 3); // a tap on the top array Row is the top Row number
  assert.equal(rowNumber(CHART, 2), 1);
});

test("a Row of one colour is one Run, a Row of alternating colours a Run per Cell", () => {
  assert.deepEqual(counted(runsOfRow(CHART, 3, LEFT_TO_RIGHT)), [{ entry: 2, count: 6 }]);
  assert.deepEqual(counted(runsOfRow(CHART, 1, LEFT_TO_RIGHT)), [
    { entry: 0, count: 1 },
    { entry: 1, count: 1 },
    { entry: 0, count: 1 },
    { entry: 1, count: 1 },
    { entry: 0, count: 1 },
    { entry: 1, count: 1 },
  ]);
});

test("an entry with no Colorway name gets a positional label, a named one its name", () => {
  assert.equal(entryLabel(CHART, 0), "Colour A");
  assert.equal(entryLabel(CHART, 1), "Colour B");
  assert.equal(entryLabel(CHART, 2), "Rust");
});

const FLAT_RIGHT_TO_LEFT = { construction: FLAT, start: RIGHT_TO_LEFT, flips: {} };

test("under flat the direction alternates as the knitter advances", () => {
  assert.equal(readingDirection(FLAT_RIGHT_TO_LEFT, 1), RIGHT_TO_LEFT);
  assert.equal(readingDirection(FLAT_RIGHT_TO_LEFT, 2), LEFT_TO_RIGHT);
  assert.equal(readingDirection(FLAT_RIGHT_TO_LEFT, 3), RIGHT_TO_LEFT);
  // and it starts wherever the knitter said it starts
  const other = { ...FLAT_RIGHT_TO_LEFT, start: LEFT_TO_RIGHT };
  assert.equal(readingDirection(other, 1), LEFT_TO_RIGHT);
  assert.equal(readingDirection(other, 2), RIGHT_TO_LEFT);
});

test("in the round the direction is the same on every Row", () => {
  const round = { construction: IN_THE_ROUND, start: RIGHT_TO_LEFT, flips: {} };
  for (const row of [1, 2, 3, 150]) assert.equal(readingDirection(round, row), RIGHT_TO_LEFT);
});

test("a Flipped Row wins over the Construction, and only for that Row", () => {
  const slipped = { ...FLAT_RIGHT_TO_LEFT, flips: { 2: RIGHT_TO_LEFT, 3: LEFT_TO_RIGHT } };
  assert.equal(readingDirection(slipped, 2), RIGHT_TO_LEFT); // flat alone would say left-to-right
  assert.equal(readingDirection(slipped, 3), LEFT_TO_RIGHT); // and here the reverse
  assert.equal(readingDirection(slipped, 4), LEFT_TO_RIGHT); // unflipped Rows still follow flat
});

test("retreating to a Row reads the same way as arriving at it forwards", () => {
  // Walking up and walking back down are the knitter's Next and Previous. Both
  // walks are stated against the same hand-written sequence, so a direction
  // that toggled on each step instead of following the Row number would fail
  // the descent even while passing the climb.
  const settings = { ...FLAT_RIGHT_TO_LEFT, flips: { 4: RIGHT_TO_LEFT } };
  const climbing = [1, 2, 3, 4, 5];
  const expected = [RIGHT_TO_LEFT, LEFT_TO_RIGHT, RIGHT_TO_LEFT, RIGHT_TO_LEFT, RIGHT_TO_LEFT];
  assert.deepEqual(
    climbing.map((row) => readingDirection(settings, row)),
    expected,
  );
  assert.deepEqual(
    [...climbing].reverse().map((row) => readingDirection(settings, row)),
    [...expected].reverse(),
  );
});

test("right-to-left reverses the Runs, and never touches the Chart", () => {
  const row = rowOf([0, 0, 0, 1, 1, 2]);
  const before = structuredClone(row);
  assert.deepEqual(counted(runsOfRow(row, 1, RIGHT_TO_LEFT)), [
    { entry: 2, count: 1 },
    { entry: 1, count: 2 },
    { entry: 0, count: 3 },
  ]);
  assert.deepEqual(counted(runsOfRow(row, 1, LEFT_TO_RIGHT)), [
    { entry: 0, count: 3 },
    { entry: 1, count: 2 },
    { entry: 2, count: 1 },
  ]);
  assert.deepEqual(row, before); // `cells` holds no direction: it is the same Chart either way
});

test("Runs asked for without a direction are refused rather than read one way", () => {
  assert.throws(() => runsOfRow(CHART, 1), /reading direction must be given/);
});
