// Chart logic: pure functions over the schema-1 Chart contract.
// No DOM, no canvas, no storage — this is the module under test.

const NON_STITCH = -1;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const FLAT = "flat";
export const IN_THE_ROUND = "in the round";
export const RIGHT_TO_LEFT = "right-to-left";
export const LEFT_TO_RIGHT = "left-to-right";

export const opposite = (direction) =>
  direction === RIGHT_TO_LEFT ? LEFT_TO_RIGHT : RIGHT_TO_LEFT;

/**
 * Which way a Row is read, from the Chart's Construction, its starting
 * direction, and the Rows the knitter has Flipped. Flat turns the work every
 * Row so the direction alternates; in the round never turns so it holds. A Flip
 * wins over both — that is how a knitter recovers when the alternation has
 * slipped. Derived from the Row number alone, so retreating to a Row reads the
 * same way as arriving at it forwards.
 */
export function readingDirection({ construction, start, flips }, row) {
  return flips[row] ?? (construction === FLAT && (row - 1) % 2 === 1 ? opposite(start) : start);
}

// `confidence.chart` is 1.0 when the crop's edges landed on gridlines and 0.0
// when one sat exactly between two — a coin flip that may have cost a Cell. The
// four corpus crops, drawn a few px off by hand as a knitter's would be, score
// 0.06, 0.26, 0.31 and 0.8 and every one of them parsed to the right size, so a
// warning at half-confidence would cry wolf on three parses in four. The banner
// is reserved for the coin-flip end; the dimensions Review shows are the real
// defence. `ponytail:` a guess fitted to four crops — retune on real use.
const DOUBTFUL_BELOW = 0.2;

/** Whether the crop may have snapped a Cell out. `confidence` is optional in the contract. */
export function cropIsDoubtful(chart) {
  return (chart.confidence?.chart ?? 1) < DOUBTFUL_BELOW;
}

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

/** How wide the Chart is. Stated from `cells`, which is the Chart that gets knitted. */
export function colCount(chart) {
  return chart.cells[0].length;
}

/** A Row's Cells, left to right in image orientation. */
export function cellsOfRow(chart, row) {
  return chart.cells[rowIndex(chart, row)];
}

/**
 * The Runs of a Row, in reading order — reversed for a Row read right to left.
 * Non-stitch is background rather than yarn, so it is left out — and it
 * *splits* the Runs around it rather than joining them, or the knitter counts
 * stitches that are not there.
 */
export function runsOfRow(chart, row, direction) {
  // Reading a Row the wrong way round is the mistake this ticket exists to
  // prevent, so a caller that forgets the direction is refused, not defaulted.
  if (direction !== RIGHT_TO_LEFT && direction !== LEFT_TO_RIGHT)
    throw new Error(`reading direction must be given, not ${direction}`);
  const runs = [];
  let open = null; // the Run being counted; null across a Non-stitch gap
  cellsOfRow(chart, row).forEach((cell, at) => {
    if (cell === NON_STITCH) open = null;
    else if (open?.entry === cell) open.count += 1;
    // `at` is in image orientation, unreversed, so the chip showing a Run can
    // hand the same Cells to Repaint whichever way the Row is read.
    else runs.push((open = { entry: cell, count: 1, at }));
  });
  return direction === RIGHT_TO_LEFT ? runs.reverse() : runs;
}

/**
 * A Row's span of Cells — `from` to `to` inclusive, in either order, because a
 * knitter drags both ways — set to a Palette entry or to Non-stitch. One
 * primitive at two selection sizes: a single Cell is the span `from === to`.
 *
 * The Chart comes back as a new value rather than a mutation, so a Repaint mid
 * drag can be recomputed from the Chart as it was when the finger went down.
 * Indices outside the Chart are refused: clamping them would paint Cells the
 * knitter never touched, and do it quietly.
 */
export function repaint(chart, { row, from, to }, entry) {
  // Integers, not merely in range: Row 1.5 is no Row, and would otherwise come
  // back as a Chart with nothing painted — the quiet failure this guard is for.
  if (!Number.isInteger(row) || row < 1 || row > rowCount(chart))
    throw new Error(`no Row ${row} in this Chart`);
  const [first, last] = from <= to ? [from, to] : [to, from];
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last >= colCount(chart))
    throw new Error(`cells ${first}–${last} are outside this Chart`);
  if (entry !== NON_STITCH && !(entry >= 0 && entry < chart.palette.length))
    throw new Error(`no Palette entry ${entry} in this Chart`);

  const index = rowIndex(chart, row);
  return {
    ...chart,
    cells: chart.cells.map((cells, r) =>
      r === index ? cells.map((cell, c) => (c >= first && c <= last ? entry : cell)) : cells,
    ),
  };
}
