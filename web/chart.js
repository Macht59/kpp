// Chart logic: pure functions over the schema-1 Chart contract.
// No DOM, no canvas, no storage — this is the module under test.

const NON_STITCH = -1;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * What a chip calls a Palette entry. The stateless service leaves `name` null,
 * so the position stands in until a Colorway is mapped to it.
 */
export function entryLabel(chart, entry) {
  return chart.palette[entry].name ?? `Colour ${LETTERS[entry] ?? entry + 1}`;
}

/**
 * Knitting charts are worked bottom to top, but `cells[0]` is the top of the
 * image — so displayed Row 1 is the last array Row. That inversion lives here,
 * once, and nothing else in the client thinks about it.
 */
export function rowIndex(chart, row) {
  return rowCount(chart) - row;
}

/** The displayed Row number of an array Row — the same inversion, read back. */
export function rowNumber(chart, index) {
  return rowCount(chart) - index;
}

export function rowCount(chart) {
  return chart.cells.length;
}

/** A Row's Cells, left to right in image orientation. */
export function cellsOfRow(chart, row) {
  return chart.cells[rowIndex(chart, row)];
}

/**
 * The Runs of a Row, in reading order. Non-stitch is background rather than
 * yarn, so it is left out — and it *splits* the Runs around it rather than
 * joining them, or the knitter counts stitches that are not there.
 */
export function runsOfRow(chart, row) {
  const runs = [];
  let open = null; // the Run being counted; null across a Non-stitch gap
  for (const cell of cellsOfRow(chart, row)) {
    if (cell === NON_STITCH) open = null;
    else if (open?.entry === cell) open.count += 1;
    else runs.push((open = { entry: cell, count: 1 }));
  }
  return runs;
}
