// node --test "web/*.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FLAT,
  FLAT_DOUBLED,
  IN_THE_ROUND,
  LEFT_TO_RIGHT,
  RIGHT_TO_LEFT,
  cellsOfRow,
  colCount,
  cropIsDoubtful,
  entryLabel,
  isReadable,
  readingDirection,
  repaint,
  rowCount,
  rowIndex,
  rowNumber,
  runsOfRow,
  separations,
  view,
  workedRows,
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

/** A Chart read whole, Blank edges and all. */
const UNREAD = { separation: 0, trimmed: false, overlay: {} };

/** The state a fresh parse opens with: Blank edges hidden. */
const TRIMMED = { ...UNREAD, trimmed: true };

/**
 * A chart with the crop's white space still round it: one blank line on each of
 * the four edges, a white Cell in the middle that is not an edge and must stay,
 * a near-white entry inside the gate and a light grey outside it.
 */
const MARGINED = {
  schema_version: 1,
  dimensions: { rows: 4, cols: 5 },
  palette: [
    { rgb: [255, 255, 255], name: null }, // L* 100
    { rgb: [20, 20, 20], name: null }, // L* 7
    { rgb: [245, 245, 245], name: null }, // L* 96.5 — inside the gate
    { rgb: [200, 200, 200], name: null }, // L* 80.6 — outside it
  ],
  cells: [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
  ],
};

/**
 * A v2 Chart: four finest Palette entries and two Separations over them. At the
 * coarse Separation the light green and the dark green are one entry — the
 * customer's bug — and at the fine one they are two. Row 1 is the greens.
 */
const SEPARATED = {
  schema_version: 2,
  dimensions: { rows: 2, cols: 4 },
  palette: [
    { rgb: [255, 255, 255], name: null },
    { rgb: [20, 20, 20], name: null },
    { rgb: [120, 200, 120], name: null }, // light green
    { rgb: [40, 100, 40], name: null }, // dark green
  ],
  cells: [
    [1, 1, 1, 1],
    [2, 2, 3, 3],
  ],
  separations: [
    { colours: 3, merge: [0, 1, 2, 2] },
    { colours: 4, merge: [0, 1, 2, 3] },
  ],
  default_separation: 0,
};

/** Nothing chosen, so the parser's default Separation — the coarse one. */
const COARSE = { trimmed: false, overlay: {} };
const FINE = { ...COARSE, separation: 1 };

/**
 * An off-white edge Row that is not white enough to hide on its own, and merges
 * with the white beside it at the coarse Separation into one that is.
 */
const NEARLY = {
  schema_version: 2,
  dimensions: { rows: 3, cols: 2 },
  palette: [
    { rgb: [255, 255, 255], name: null }, // L* 100
    { rgb: [235, 235, 235], name: null }, // L* 93 — not blank on its own
    { rgb: [20, 20, 20], name: null },
  ],
  cells: [
    [1, 1], // the off-white edge Row
    [2, 2],
    [2, 2],
  ],
  separations: [
    { colours: 2, merge: [0, 0, 1] }, // the two lights as one, averaging L* 96.5
    { colours: 3, merge: [0, 1, 2] },
  ],
  default_separation: 1,
};

/**
 * Four Rows by four Columns in blocks of four, so a halving and a doubling both
 * land whole and a mis-sampled Cell shows up as the wrong block. No white in
 * it, so Blank edges never enter a Resize test that is not about them.
 */
const GAUGE = {
  schema_version: 1,
  dimensions: { rows: 4, cols: 4 },
  palette: [
    { rgb: [20, 20, 20], name: null },
    { rgb: [178, 96, 72], name: "Rust" },
  ],
  cells: [
    [0, 0, 1, 1],
    [0, 0, 1, 1],
    [1, 1, 0, 0],
    [1, 1, 0, 0],
  ],
};

const withCells = (chart, cells) => ({
  ...chart,
  dimensions: { rows: cells.length, cols: cells[0].length },
  cells,
});

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

test("flat doubled reads the Chart on the way out only, so the direction holds", () => {
  // The work is turned as it is under flat, but the way back is knitted off the
  // previous row rather than off the Chart — so the Chart is only ever read one
  // way, as it is in the round.
  const doubled = { construction: FLAT_DOUBLED, start: RIGHT_TO_LEFT, flips: {} };
  for (const row of [1, 2, 3, 150]) assert.equal(readingDirection(doubled, row), RIGHT_TO_LEFT);
});

test("a Flip still overrides one Row under flat doubled", () => {
  const doubled = { construction: FLAT_DOUBLED, start: RIGHT_TO_LEFT, flips: { 2: LEFT_TO_RIGHT } };
  assert.equal(readingDirection(doubled, 2), LEFT_TO_RIGHT);
  assert.equal(readingDirection(doubled, 3), RIGHT_TO_LEFT);
});

test("a Row is one Worked row under the Constructions worked once", () => {
  for (const construction of [FLAT, IN_THE_ROUND]) {
    assert.deepEqual(workedRows({ construction }, 1), [1]);
    assert.deepEqual(workedRows({ construction }, 20), [20]);
  }
});

test("under flat doubled a Row is the two Worked rows out and back", () => {
  const doubled = { construction: FLAT_DOUBLED };
  assert.deepEqual(workedRows(doubled, 1), [1, 2]);
  assert.deepEqual(workedRows(doubled, 3), [5, 6]);
  // and the last Row of a 20-Row Chart is the fortieth Worked row, which is
  // where the total in the label comes from
  assert.deepEqual(workedRows(doubled, 20), [39, 40]);
});

test("the way back is the way out reversed, over the very same Cells", () => {
  // What the second Readout is built from: the same Runs under the opposite
  // Reading direction, each still carrying the Cells it stands for.
  const row = rowOf([0, 0, 1, 2, 2, 2]);
  const out = runsOfRow(row, 1, RIGHT_TO_LEFT);
  const back = runsOfRow(row, 1, LEFT_TO_RIGHT);
  assert.deepEqual(back, [...out].reverse());
  assert.deepEqual(back.map((run) => run.at), [...out].reverse().map((run) => run.at));
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

test("a view with nothing chosen is the Chart the existing functions already consumed", () => {
  const shown = view(CHART, UNREAD);
  assert.deepEqual(shown.cells, CHART.cells);
  assert.deepEqual(shown.palette, CHART.palette);
  assert.equal(rowCount(shown), rowCount(CHART));
  assert.equal(colCount(shown), colCount(CHART));
  for (const row of [1, 2, 3])
    assert.deepEqual(runsOfRow(shown, row, LEFT_TO_RIGHT), runsOfRow(CHART, row, LEFT_TO_RIGHT));
  assert.equal(entryLabel(shown, 2), "Rust");
});

test("Repainting one Cell changes that Cell and nothing else", () => {
  const painted = view(CHART, repaint(CHART, UNREAD, { row: 1, from: 2, to: 2 }, 2));
  assert.deepEqual(cellsOfRow(painted, 1), [0, 1, 2, 1, 0, 1]);
  assert.deepEqual(cellsOfRow(painted, 2), cellsOfRow(CHART, 2));
  assert.deepEqual(cellsOfRow(painted, 3), cellsOfRow(CHART, 3));
});

test("Repainting a span takes the whole span, dragged either way", () => {
  const span = (from, to) =>
    cellsOfRow(view(CHART, repaint(CHART, UNREAD, { row: 1, from, to }, 0)), 1);
  assert.deepEqual(span(1, 4), [0, 0, 0, 0, 0, 1]);
  // a knitter dragging right to left hands the ends over backwards
  assert.deepEqual(span(4, 1), [0, 0, 0, 0, 0, 1]);
});

test("Repaint returns new view state, leaving the Chart and the state it was given alone", () => {
  const chartBefore = structuredClone(CHART);
  const stateBefore = structuredClone(UNREAD);
  const painted = repaint(CHART, UNREAD, { row: 1, from: 0, to: 5 }, 2);
  // the parse is never rewritten — a Repaint is a decision about it, not a change to it
  assert.deepEqual(CHART, chartBefore);
  assert.deepEqual(UNREAD, stateBefore);
  assert.notEqual(painted, UNREAD);
  assert.notEqual(painted.overlay, UNREAD.overlay);
  assert.equal(painted.separation, UNREAD.separation); // the other decisions come along untouched
  assert.equal(painted.trimmed, UNREAD.trimmed);
});

test("a Repaint stacks onto the ones before it rather than replacing them", () => {
  const first = repaint(CHART, UNREAD, { row: 1, from: 0, to: 0 }, 2);
  const painted = view(CHART, repaint(CHART, first, { row: 3, from: 5, to: 5 }, 1));
  assert.deepEqual(cellsOfRow(painted, 1), [2, 1, 0, 1, 0, 1]);
  assert.deepEqual(cellsOfRow(painted, 3), [2, 2, 2, 2, 2, 1]);
});

test("the Overlay a Repaint was given is left as it was, so Undo can keep it", () => {
  const first = repaint(CHART, UNREAD, { row: 1, from: 0, to: 0 }, 2);
  const before = structuredClone(first.overlay);
  repaint(CHART, first, { row: 3, from: 5, to: 5 }, 1);
  assert.deepEqual(first.overlay, before);
});

test("Repaints survive the round trip through the device", () => {
  // The view state is what the library keeps, so it has to be storable as it is.
  const painted = repaint(CHART, UNREAD, { row: 2, from: 1, to: 2 }, 2);
  assert.deepEqual(
    cellsOfRow(view(CHART, structuredClone(painted)), 2),
    cellsOfRow(view(CHART, painted), 2),
  );
  assert.deepEqual(cellsOfRow(view(CHART, painted), 2), [0, 2, 2, 1, 1, 1]);
});

test("Repainting so two neighbouring Runs share a colour merges them in the next Readout", () => {
  // the stray one-Cell chip the spec leans on: [0,1,0] mid-Row reads as three
  const strayed = rowOf([1, 1, 0, 1, 1]);
  assert.equal(runsOfRow(strayed, 1, LEFT_TO_RIGHT).length, 3);
  const merged = view(strayed, repaint(strayed, UNREAD, { row: 1, from: 2, to: 2 }, 1));
  assert.deepEqual(counted(runsOfRow(merged, 1, LEFT_TO_RIGHT)), [{ entry: 1, count: 5 }]);
});

test("Repainting Non-stitch back to yarn joins the Runs it was splitting", () => {
  const gapped = rowOf([1, -1, 1]);
  const merged = view(gapped, repaint(gapped, UNREAD, { row: 1, from: 1, to: 1 }, 1));
  assert.deepEqual(counted(runsOfRow(merged, 1, LEFT_TO_RIGHT)), [{ entry: 1, count: 3 }]);
});

test("Repainting outside the Chart is refused rather than silently clamped", () => {
  // clamping would paint Cells the knitter never touched, and quietly
  const paint = (span, entry) => repaint(CHART, UNREAD, span, entry);
  assert.throws(() => paint({ row: 0, from: 0, to: 0 }, 1), /Row 0/);
  assert.throws(() => paint({ row: 4, from: 0, to: 0 }, 1), /Row 4/);
  assert.throws(() => paint({ row: 1.5, from: 0, to: 0 }, 1), /Row 1.5/); // in range, still no Row
  assert.throws(() => paint({ row: 1, from: 0.5, to: 2 }, 1), /outside/);
  assert.throws(() => paint({ row: 1, from: -1, to: 2 }, 1), /outside/);
  assert.throws(() => paint({ row: 1, from: 4, to: 6 }, 1), /outside/);
  assert.throws(() => paint({ row: 1, from: 0, to: 0 }, 3), /Palette entry 3/);
  assert.throws(() => paint({ row: 1, from: 0, to: 0 }, null), /Palette entry/); // `null >= 0`
  assert.throws(() => paint({ row: 1, from: 0, to: 0 }, 1.5), /Palette entry/);
  // -1 is a Cell value, never a Palette entry, so it is paintable — and lands in
  // the overlay like any other Repaint
  assert.deepEqual(cellsOfRow(view(CHART, paint({ row: 1, from: 0, to: 0 }, -1)), 1), [
    -1, 1, 0, 1, 0, 1,
  ]);
});

test("a stored Chart from an unrecognised schema is refused rather than mis-read", () => {
  // Charts on the device outlive the release that parsed them, and a later
  // schema could move Cells under the same field names.
  assert.equal(isReadable(CHART), true);
  assert.equal(isReadable(SEPARATED), true); // Separations were added under 2
  assert.equal(isReadable({ ...CHART, schema_version: 3 }), false);
  assert.equal(isReadable({ ...CHART, schema_version: "1" }), false); // a string is not the version
  assert.equal(isReadable({ ...CHART, schema_version: undefined }), false);
  assert.equal(isReadable(undefined), false); // nothing under that key at all
});

test("the white space the crop caught is hidden on all four edges", () => {
  const shown = view(MARGINED, TRIMMED);
  assert.deepEqual(shown.cells, [
    [1, 1, 1],
    [1, 0, 1],
  ]);
  assert.equal(rowCount(shown), 2);
  assert.equal(colCount(shown), 3);
  assert.deepEqual(shown.blank, { top: 1, bottom: 1, left: 1, right: 1 });
});

test("trimming stops at the first non-blank line, however deep the margin", () => {
  const deep = withCells(MARGINED, [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 0],
  ]);
  assert.deepEqual(view(deep, TRIMMED).cells, [[1]]);
  assert.deepEqual(view(deep, TRIMMED).blank, { top: 2, bottom: 1, left: 2, right: 1 });
});

test("a blank line through the middle of the pattern is left exactly where it is", () => {
  const gapped = withCells(MARGINED, [
    [1, 1, 1],
    [0, 0, 0], // white all the way across, and not an edge
    [1, 0, 1],
  ]);
  assert.deepEqual(view(gapped, TRIMMED).cells, gapped.cells);
  assert.deepEqual(view(gapped, TRIMMED).blank, { top: 0, bottom: 0, left: 0, right: 0 });
});

test("near-white counts as blank, and a light colour does not", () => {
  // an edging round in pale grey is a Row of the pattern, not white space
  const edged = withCells(MARGINED, [
    [2, 2, 2],
    [3, 3, 3],
    [1, 1, 1],
  ]);
  assert.deepEqual(view(edged, TRIMMED).cells, [
    [3, 3, 3],
    [1, 1, 1],
  ]);
});

test("a uniform non-white edge line is left alone", () => {
  const bordered = withCells(MARGINED, [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ]);
  assert.deepEqual(view(bordered, TRIMMED).cells, bordered.cells);
});

test("Non-stitch is not white, so an edge of it is not a Blank edge", () => {
  const carved = withCells(MARGINED, [
    [-1, -1, -1],
    [1, 1, 1],
  ]);
  assert.deepEqual(view(carved, TRIMMED).cells, carved.cells);
});

test("showing the Blank edges again gives back the Chart untrimmed, Cell for Cell", () => {
  assert.deepEqual(view(MARGINED, UNREAD).cells, MARGINED.cells);
  assert.deepEqual(view(MARGINED, UNREAD).blank, view(MARGINED, TRIMMED).blank);
});

test("with the Blank edges hidden, Row 1 is the pattern's first Row", () => {
  // two white Rows at the bottom of the image, which is where Row 1 is read from
  const footed = withCells(MARGINED, [
    [1, 1, 2],
    [1, 0, 1],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  const shown = view(footed, TRIMMED);
  assert.equal(rowCount(shown), 2);
  assert.deepEqual(cellsOfRow(shown, 1), [1, 0, 1]);
  assert.deepEqual(counted(runsOfRow(shown, 1, LEFT_TO_RIGHT)), [
    { entry: 1, count: 1 },
    { entry: 0, count: 1 },
    { entry: 1, count: 1 },
  ]);
});

test("a Repaint lands on the Cell the knitter touched, with the Blank edges hidden", () => {
  // Row 1 of the view is array Row 2 of the Chart, and Column 0 is Column 1
  const painted = repaint(MARGINED, TRIMMED, { row: 1, from: 0, to: 0 }, 1);
  assert.deepEqual(painted.overlay, { "2,1": 1 });
  assert.deepEqual(cellsOfRow(view(MARGINED, painted), 1), [1, 0, 1]);
  assert.deepEqual(view(MARGINED, painted).cells, [
    [1, 1, 1],
    [1, 0, 1],
  ]);
});

test("Repaint's guards run against the Chart the knitter can see, not the parsed one", () => {
  // three Rows and five Columns were parsed; two Rows and three Columns are read
  const paint = (span) => repaint(MARGINED, TRIMMED, span, 1);
  assert.throws(() => paint({ row: 3, from: 0, to: 0 }), /Row 3/);
  assert.throws(() => paint({ row: 1, from: 0, to: 3 }), /outside/);
  assert.deepEqual(paint({ row: 2, from: 2, to: 2 }).overlay, { "1,3": 1 });
});

test("a Repaint never changes which lines are hidden", () => {
  // Tidying a speck off an otherwise white edge Column must not make that
  // Column vanish and shift every Column number under the knitter.
  const specked = withCells(MARGINED, [
    [0, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
  ]);
  const cleaned = repaint(specked, TRIMMED, { row: 1, from: 2, to: 2 }, 0);
  const shown = view(specked, cleaned);
  assert.deepEqual(shown.blank, view(specked, TRIMMED).blank);
  assert.deepEqual(shown.cells, [
    [1, 1, 1],
    [0, 0, 0],
  ]);
});

test("a Chart that is nothing but white space is refused, not returned empty", () => {
  const empty = withCells(MARGINED, [
    [0, 0],
    [0, 0],
  ]);
  assert.throws(() => view(empty, TRIMMED), /blank/);
  assert.deepEqual(view(empty, UNREAD).cells, empty.cells); // shown whole, it is still readable
});

test("a v2 Chart is read at the parser's default Separation until the knitter chooses", () => {
  // Under v2 `palette` is the finest Separation, so a view that showed it raw
  // would hand the knitter four colours where the parser's answer is three.
  const shown = view(SEPARATED, COARSE);
  assert.equal(shown.palette.length, 3);
  assert.deepEqual(shown.cells, [
    [1, 1, 1, 1],
    [2, 2, 2, 2],
  ]);
});

test("a view says which Separation it was read at, chosen or defaulted", () => {
  // what a chooser marks as current: a Chart nobody has decided anything about
  // is being read at the parser's default, and the mark belongs on that
  assert.equal(view(SEPARATED, COARSE).separation, 0);
  assert.equal(view(SEPARATED, FINE).separation, 1);
  assert.equal(view(NEARLY, COARSE).separation, 1); // this one's default is the fine one
  assert.equal(view(SEPARATED, { ...COARSE, separation: 7 }).separation, 0); // no such answer
});

test("the Separations offered are the Chart's, coarse to fine, and one for a v1 Chart", () => {
  // A single answer is nothing to choose between, so this is also what tells the
  // client there is no chooser worth showing.
  assert.deepEqual(
    separations(SEPARATED).map((offered) => offered.colours),
    [3, 4],
  );
  assert.deepEqual(separations(CHART), [{ colours: 3, merge: [0, 1, 2] }]);
});

test("the two greens are one Run at the coarse Separation and two at the fine one", () => {
  // the customer's bug, expressed as a test: "7 green" where the pattern says 4 and 3
  assert.deepEqual(counted(runsOfRow(view(SEPARATED, COARSE), 1, LEFT_TO_RIGHT)), [
    { entry: 2, count: 4 },
  ]);
  const fine = view(SEPARATED, FINE);
  assert.equal(fine.palette.length, 4);
  assert.deepEqual(counted(runsOfRow(fine, 1, LEFT_TO_RIGHT)), [
    { entry: 2, count: 2 },
    { entry: 3, count: 2 },
  ]);
});

test("a Separation's colours are averaged from the finest entries it merges", () => {
  // derived, never stored: a colour list per Separation would be a second source
  // of truth for the same colours
  assert.deepEqual(view(SEPARATED, COARSE).palette[2].rgb, [80, 150, 80]);
  assert.deepEqual(view(SEPARATED, FINE).palette[2].rgb, [120, 200, 120]);
});

test("a merged colour leans towards the entry more Cells are knitted in", () => {
  // A parsed entry is the average of the Cells that landed in it, so a merged
  // one has to be too: averaging the finest entries evenly instead drags every
  // colour towards the near-duplicates around it, and the default Separation
  // stops being the Chart the parser returned.
  const mostly = { ...SEPARATED, dimensions: { rows: 1, cols: 4 }, cells: [[2, 2, 2, 3]] };
  assert.deepEqual(view(mostly, COARSE).palette[2].rgb, [100, 175, 100]);
});

test("a Chart parsed before Separations existed is read as the single one it has", () => {
  // v1 is exactly v2 with one Separation, so it lifts rather than being refused
  const shown = view(CHART, UNREAD);
  assert.deepEqual(shown.palette, CHART.palette); // Colorway names and all
  assert.deepEqual(shown.cells, CHART.cells);
  assert.equal(entryLabel(shown, 2), "Rust");
});

test("the name a knitter types is the name the Chart is read under", () => {
  const named = view(SEPARATED, { ...COARSE, names: { "0,2": "Moss" } });
  assert.equal(entryLabel(named, 2), "Moss");
  assert.equal(entryLabel(named, 0), "Colour A"); // the ones they left alone keep their letter
  // and it wins over whatever the parse put there, because it is their word
  assert.equal(entryLabel(view(CHART, { ...UNREAD, names: { "0,2": "Bracken" } }), 2), "Bracken");
});

test("clearing a Colorway name brings the positional letter back", () => {
  assert.equal(entryLabel(view(SEPARATED, { ...COARSE, names: { "0,2": "" } }), 2), "Colour C");
});

test("a name is the name of an entry of one Separation, and never of another's", () => {
  // entry 2 at three colours is a different colour from entry 2 at four
  const names = { "0,2": "Moss" };
  assert.equal(entryLabel(view(SEPARATED, { ...FINE, names }), 2), "Colour C");
  assert.equal(entryLabel(view(SEPARATED, { ...COARSE, names }), 2), "Moss"); // and back again
});

test("a Repaint made at one Separation is still there after switching, both ways", () => {
  // Stored at the finest Separation, because an index into a Palette that is
  // about to change cannot outlive the change.
  const green = repaint(SEPARATED, COARSE, { row: 2, from: 0, to: 0 }, 2);
  assert.deepEqual(green.overlay, { "0,0": 2 });
  assert.deepEqual(cellsOfRow(view(SEPARATED, green), 2), [2, 1, 1, 1]);
  assert.deepEqual(cellsOfRow(view(SEPARATED, { ...green, separation: 1 }), 2), [2, 1, 1, 1]);
  // and the other direction: a dark green chosen at the fine Separation reads as
  // the one green at the coarse one
  const dark = repaint(SEPARATED, FINE, { row: 2, from: 3, to: 3 }, 3);
  assert.deepEqual(dark.overlay, { "0,3": 3 });
  assert.deepEqual(cellsOfRow(view(SEPARATED, { ...dark, separation: 0 }), 2), [1, 1, 1, 2]);
});

test("a Repaint at a coarse Separation records the colour the swatch mostly was", () => {
  // The swatch is the merged entries averaged by Cell count, so the most-used of
  // them is what the knitter was looking at — recording the first instead would
  // hand them a near-duplicate they never picked the moment they switch finer.
  const mostly = { ...SEPARATED, dimensions: { rows: 1, cols: 4 }, cells: [[2, 3, 3, 3]] };
  const painted = repaint(mostly, COARSE, { row: 1, from: 0, to: 0 }, 2);
  assert.deepEqual(painted.overlay, { "0,0": 3 }); // the dark green, three Cells of four
  assert.deepEqual(cellsOfRow(view(mostly, { ...painted, separation: 1 }), 1), [3, 3, 3, 3]);
});

test("a Repaint handed the Chart already derived lands on the same Cells", () => {
  // What a paint drag does on every pointer move: the view it is drawing is the
  // one the Repaint is guarded against, so deriving a second is waste. Handed a
  // view carrying Repaints of its own — the drag so far — it still lands on the
  // Cell the finger is over, because bounds and Blank edges do not move with a
  // Repaint.
  const span = { row: 1, from: 0, to: 1 };
  const alone = repaint(MARGINED, TRIMMED, span, 1);
  const painted = view(MARGINED, alone);
  assert.deepEqual(repaint(MARGINED, TRIMMED, span, 1, painted), alone);
  assert.throws(() => repaint(MARGINED, TRIMMED, { ...span, to: 9 }, 1, painted), /outside/);
});

test("a Repaint to Non-stitch survives a Separation switch equally", () => {
  // "not yarn" is a statement no colour decision can undo
  const carved = repaint(SEPARATED, COARSE, { row: 1, from: 0, to: 1 }, -1);
  assert.deepEqual(cellsOfRow(view(SEPARATED, { ...carved, separation: 1 }), 1), [-1, -1, 3, 3]);
});

test("a Palette entry the Separation being read does not have is refused", () => {
  // the fine Separation's fourth entry is no entry of the coarse one
  assert.throws(
    () => repaint(SEPARATED, COARSE, { row: 1, from: 0, to: 0 }, 3),
    /Palette entry 3/,
  );
  assert.deepEqual(repaint(SEPARATED, FINE, { row: 1, from: 0, to: 0 }, 3).overlay, { "1,0": 3 });
});

test("Blank edges are recomputed against the Separation being read", () => {
  // a hidden Row must never be a Row the knitter can see has colour in it
  const trimmed = (separation) => view(NEARLY, { ...COARSE, trimmed: true, separation });
  assert.deepEqual(trimmed(1).blank, { top: 0, bottom: 0, left: 0, right: 0 });
  assert.deepEqual(trimmed(0).blank, { top: 1, bottom: 0, left: 0, right: 0 });
  assert.equal(rowCount(trimmed(0)), 2);
});

test("only a crop near the coin flip is doubtful, and a Chart without the signal never is", () => {
  const scored = (score) => ({ ...CHART, confidence: { chart: score, cells: [] } });
  assert.equal(cropIsDoubtful(scored(0.0)), true); // an edge exactly between two gridlines
  assert.equal(cropIsDoubtful(scored(0.06)), true);
  assert.equal(cropIsDoubtful(scored(0.26)), false); // a corpus crop that parsed to the right size
  assert.equal(cropIsDoubtful(scored(0.92)), false);
  assert.equal(cropIsDoubtful(CHART), false); // `confidence` is optional in the contract
});

const scaled = (chart, state, scale) => view(chart, { ...state, scale });

test("a Chart read at twice its size repeats every Cell, and invents none", () => {
  assert.deepEqual(scaled(GAUGE, UNREAD, { rows: 8, cols: 8 }).cells, [
    [0, 0, 0, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 0, 0, 0],
  ]);
});

test("a Chart read at half its size keeps whole Cells, never a blend of two", () => {
  assert.deepEqual(scaled(GAUGE, UNREAD, { rows: 2, cols: 2 }).cells, [
    [0, 1],
    [1, 0],
  ]);
});

test("Rows and Columns resize independently", () => {
  assert.deepEqual(scaled(GAUGE, UNREAD, { rows: 2, cols: 8 }).cells, [
    [0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0],
  ]);
  assert.deepEqual(scaled(GAUGE, UNREAD, { rows: 8, cols: 2 }).cells, [
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 0],
  ]);
});

test("the size asked for is the size returned, whatever it divides into", () => {
  const shown = scaled(CHART, UNREAD, { rows: 7, cols: 4 });
  assert.equal(rowCount(shown), 7);
  assert.equal(colCount(shown), 4);
});

test("the resample invents no colour that is not a Palette entry", () => {
  const shown = scaled(CHART, UNREAD, { rows: 7, cols: 4 });
  const parsed = new Set(CHART.cells.flat());
  for (const row of shown.cells) for (const cell of row) assert.ok(parsed.has(cell));
});

test("Non-stitch resamples like any other Cell, in both directions", () => {
  // it carries -1 and nearest-neighbour replicates it with no special case
  assert.deepEqual(scaled(CHART, UNREAD, { rows: 6, cols: 12 }).cells[2], [
    0, 0, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1,
  ]);
  assert.deepEqual(scaled(CHART, UNREAD, { rows: 1, cols: 3 }).cells, [[-1, 1, 1]]);
});

test("the resample runs after the Blank-edge trim, so the size asked for is of the Chart the knitter sees", () => {
  // Two Rows and two Columns of pattern inside a Blank edge on all four sides:
  // four Rows of the *trimmed* Chart are four of pattern, not four counting the
  // white space hidden from the knitter.
  const framed = withCells(MARGINED, [
    [0, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
  ]);
  const shown = scaled(framed, TRIMMED, { rows: 4, cols: 4 });
  assert.deepEqual(shown.cells, [
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
  ]);
  // and the Blank edges are still reported, measured from the parse as ever
  assert.deepEqual(shown.blank, { top: 1, bottom: 1, left: 1, right: 1 });
});

test("a resize down and back up returns the Chart Cell for Cell, Repaints included", () => {
  // The reason Resize is derived rather than baked into a new Chart: the parse
  // is always the thing being sampled, so nothing is lost on the way down.
  const painted = repaint(GAUGE, UNREAD, { row: 1, from: 0, to: 0 }, 0);
  const whole = view(GAUGE, painted);
  assert.deepEqual(whole.cells[3], [0, 1, 0, 0]); // Row 1, one Cell corrected
  // The knitter tries half, and the halving samples straight past the corrected
  // Cell — a single-Cell Repaint has a coin-flip chance of surviving one.
  assert.deepEqual(scaled(GAUGE, painted, { rows: 2, cols: 2 }).cells, [
    [0, 1],
    [1, 0],
  ]);
  // They dislike it and go back, and their correction is there — because the
  // Repaint is applied to the parse and the parse was never touched.
  assert.deepEqual(scaled(GAUGE, painted, { rows: 4, cols: 4 }), whole);
});

test("no scale, and a scale of the size already read, leave the view exactly as it was", () => {
  assert.deepEqual(scaled(CHART, UNREAD, { rows: 3, cols: 6 }), view(CHART, UNREAD));
  assert.deepEqual(scaled(MARGINED, TRIMMED, { rows: 2, cols: 3 }), view(MARGINED, TRIMMED));
});

test("a scale of zero, negative or fractional Rows or Columns is refused, not clamped", () => {
  const ask = (scale) => () => scaled(GAUGE, UNREAD, scale);
  assert.throws(ask({ rows: 0, cols: 4 }), /Rows and Columns/);
  assert.throws(ask({ rows: 4, cols: 0 }), /Rows and Columns/);
  assert.throws(ask({ rows: -4, cols: 4 }), /Rows and Columns/);
  assert.throws(ask({ rows: 4, cols: -4 }), /Rows and Columns/);
  assert.throws(ask({ rows: 2.5, cols: 4 }), /Rows and Columns/);
  assert.throws(ask({ rows: 4 }), /Rows and Columns/); // half a size is no size
});
