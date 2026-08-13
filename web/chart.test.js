// node --test "web/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";

import { cellsOfRow, entryLabel, rowCount, rowIndex, rowNumber, runsOfRow } from "./chart.js";

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
  assert.deepEqual(counted(runsOfRow(rowOf([0, 0, 0, 1, 1, 2]), 1)), [
    { entry: 0, count: 3 },
    { entry: 1, count: 2 },
    { entry: 2, count: 1 },
  ]);
});

test("Non-stitch Cells are omitted and split the Runs around them", () => {
  assert.deepEqual(counted(runsOfRow(rowOf([0, -1, -1, 1, 1, 1]), 1)), [
    { entry: 0, count: 1 },
    { entry: 1, count: 3 },
  ]);
  // the same entry either side stays two Runs — joining across would overcount
  assert.deepEqual(counted(runsOfRow(rowOf([1, -1, 1]), 1)), [
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
  assert.deepEqual(counted(runsOfRow(CHART, 3)), [{ entry: 2, count: 6 }]);
  assert.deepEqual(counted(runsOfRow(CHART, 1)), [
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
