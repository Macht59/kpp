// node --test "web/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FLAT,
  IN_THE_ROUND,
  LEFT_TO_RIGHT,
  RIGHT_TO_LEFT,
  cellsOfRow,
  cropIsDoubtful,
  entryLabel,
  readingDirection,
  repaint,
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

test("a Run says where it starts, so the chip showing it can Repaint it", () => {
  // Positions are in image orientation, unreversed, so they mean the same Cells
  // whichever way the Row is read.
  const row = rowOf([0, 0, 0, 1, 1, 2]);
  assert.deepEqual(
    runsOfRow(row, 1, LEFT_TO_RIGHT).map(({ at, count }) => [at, count]),
    [
      [0, 3],
      [3, 2],
      [5, 1],
    ],
  );
  assert.deepEqual(
    runsOfRow(row, 1, RIGHT_TO_LEFT).map(({ at, count }) => [at, count]),
    [
      [5, 1],
      [3, 2],
      [0, 3],
    ],
  );
  // and across a Non-stitch gap the second Run starts after it, not at the split
  assert.deepEqual(
    runsOfRow(rowOf([1, -1, 1]), 1, LEFT_TO_RIGHT).map(({ at }) => at),
    [0, 2],
  );
});

test("Repainting one Cell changes that Cell and nothing else", () => {
  const painted = repaint(CHART, { row: 1, from: 2, to: 2 }, 2);
  assert.deepEqual(cellsOfRow(painted, 1), [0, 1, 2, 1, 0, 1]);
  assert.deepEqual(cellsOfRow(painted, 2), cellsOfRow(CHART, 2));
  assert.deepEqual(cellsOfRow(painted, 3), cellsOfRow(CHART, 3));
});

test("Repainting a span takes the whole span, dragged either way", () => {
  assert.deepEqual(cellsOfRow(repaint(CHART, { row: 1, from: 1, to: 4 }, 0), 1), [0, 0, 0, 0, 0, 1]);
  // a knitter dragging right to left hands the ends over backwards
  assert.deepEqual(cellsOfRow(repaint(CHART, { row: 1, from: 4, to: 1 }, 0), 1), [0, 0, 0, 0, 0, 1]);
});

test("Repaint returns a new Chart rather than mutating the one it was given", () => {
  const before = structuredClone(CHART);
  const painted = repaint(CHART, { row: 1, from: 0, to: 5 }, 2);
  assert.deepEqual(CHART, before); // the Chart a caller still holds does not change under it
  assert.notEqual(painted, CHART);
  assert.notEqual(painted.cells, CHART.cells);
  assert.notEqual(painted.cells[2], CHART.cells[2]);
  assert.equal(painted.cells[0], CHART.cells[0]); // untouched Rows are shared, not copied
});

test("Repainting so two neighbouring Runs share a colour merges them in the next Readout", () => {
  // the stray one-Cell chip the spec leans on: [0,1,0] mid-Row reads as three
  const strayed = rowOf([1, 1, 0, 1, 1]);
  assert.equal(runsOfRow(strayed, 1, LEFT_TO_RIGHT).length, 3);
  const merged = repaint(strayed, { row: 1, from: 2, to: 2 }, 1);
  assert.deepEqual(counted(runsOfRow(merged, 1, LEFT_TO_RIGHT)), [{ entry: 1, count: 5 }]);
});

test("Repainting Non-stitch back to yarn joins the Runs it was splitting", () => {
  const merged = repaint(rowOf([1, -1, 1]), { row: 1, from: 1, to: 1 }, 1);
  assert.deepEqual(counted(runsOfRow(merged, 1, LEFT_TO_RIGHT)), [{ entry: 1, count: 3 }]);
});

test("Repainting outside the Chart is refused rather than silently clamped", () => {
  // clamping would paint Cells the knitter never touched, and quietly
  assert.throws(() => repaint(CHART, { row: 0, from: 0, to: 0 }, 1), /Row 0/);
  assert.throws(() => repaint(CHART, { row: 4, from: 0, to: 0 }, 1), /Row 4/);
  assert.throws(() => repaint(CHART, { row: 1.5, from: 0, to: 0 }, 1), /Row 1.5/); // in range, still no Row
  assert.throws(() => repaint(CHART, { row: 1, from: 0.5, to: 2 }, 1), /outside/);
  assert.throws(() => repaint(CHART, { row: 1, from: -1, to: 2 }, 1), /outside/);
  assert.throws(() => repaint(CHART, { row: 1, from: 4, to: 6 }, 1), /outside/);
  assert.throws(() => repaint(CHART, { row: 1, from: 0, to: 0 }, 3), /Palette entry 3/);
  // -1 is a Cell value, never a Palette entry, so it is paintable
  assert.deepEqual(cellsOfRow(repaint(CHART, { row: 1, from: 0, to: 0 }, -1), 1), [
    -1, 1, 0, 1, 0, 1,
  ]);
});

test("only a crop near the coin flip is doubtful, and a Chart without the signal never is", () => {
  const scored = (score) => ({ ...CHART, confidence: { chart: score, cells: [] } });
  assert.equal(cropIsDoubtful(scored(0.0)), true); // an edge exactly between two gridlines
  assert.equal(cropIsDoubtful(scored(0.06)), true);
  assert.equal(cropIsDoubtful(scored(0.26)), false); // a corpus crop that parsed to the right size
  assert.equal(cropIsDoubtful(scored(0.92)), false);
  assert.equal(cropIsDoubtful(CHART), false); // `confidence` is optional in the contract
});
