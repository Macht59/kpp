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

/**
 * Charts kept on the device outlive the service release that parsed them, so
 * one read back off the device is checked before it is drawn: a later schema
 * could move Cells under the same field names, and a mis-read Chart is a
 * knitter following counts that are not their pattern's.
 */
export const SCHEMA_VERSION = 1;

export const isReadable = (chart) => chart?.schema_version === SCHEMA_VERSION;

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
 * How light a Palette entry is, on Lab's `L*` scale — 0 is black and 100 is
 * white. Only the lightness is wanted, so only `Y` of the XYZ conversion is
 * computed.
 */
function lightness([red, green, blue]) {
  const linear = (channel) => {
    const scaled = channel / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  return luminance > 0.008856 ? 116 * Math.cbrt(luminance) - 16 : 903.3 * luminance;
}

// Where white space stops and the pattern starts. Only white counts: a solid
// black border Row or a coloured edging round is part of someone's pattern and
// must never be silently removed, so the gate sits at the very top of the
// lightness scale rather than at "pale". `ponytail:` unfitted — no chart in the
// corpus carries a white margin, so this is a starting value and production is
// the first check.
const BLANK_ABOVE = 95;

/**
 * How many Rows and Columns of white space the crop caught at each of the four
 * edges. Trimmed inward until a non-blank line is met, so a blank line through
 * the middle of the pattern is never reached. Repeated until nothing shrinks:
 * cutting white Rows away can leave a Column white along its whole remaining
 * length, and that Column is white space too.
 */
function blankEdges({ cells, palette }) {
  // Non-stitch indexes no entry, so it is never blank — it is the knitter
  // saying "not yarn here", which is a statement about the pattern.
  const blank = palette.map((entry) => lightness(entry.rgb) >= BLANK_ABOVE);
  const isBlank = (line) => line.every((cell) => blank[cell]);
  let [top, bottom, left, right] = [0, cells.length, 0, cells[0].length];
  const row = (at) => cells[at].slice(left, right);
  const col = (at) => cells.slice(top, bottom).map((line) => line[at]);
  for (let shrinking = true; shrinking; ) {
    shrinking = false;
    while (top < bottom && isBlank(row(top))) [top, shrinking] = [top + 1, true];
    while (bottom > top && isBlank(row(bottom - 1))) [bottom, shrinking] = [bottom - 1, true];
    while (left < right && isBlank(col(left))) [left, shrinking] = [left + 1, true];
    while (right > left && isBlank(col(right - 1))) [right, shrinking] = [right - 1, true];
  }
  return { top, bottom: cells.length - bottom, left, right: cells[0].length - right };
}

// Measured from the parse rather than from the Repaints over it, and so fixed
// for a Chart: a knitter tidying a speck off an otherwise white edge Column
// must not have that Column disappear and every Column number shift under
// them. Kept, because a paint drag derives the view on every pointer move and
// the scan walks the whole Chart.
const edgesOfChart = new WeakMap();

function blankEdgesOf(chart) {
  if (!edgesOfChart.has(chart.cells)) edgesOfChart.set(chart.cells, blankEdges(chart));
  return edgesOfChart.get(chart.cells);
}

/**
 * The Chart the knitter is reading, derived from the stored one and the
 * decisions they have made about it: which Separation to read it at, whether
 * Blank edges are hidden, and the Cells they have Repainted. It comes back in
 * exactly the shape every function above consumes, so they operate on the view
 * and never learn that a view exists.
 *
 * `separation` is inert here — Separations land in their own ticket. `overlay`
 * is the Repaints, keyed by array Row and Column of the stored Chart, so it
 * holds still when the Chart is read differently. `trimmed` hides the Blank
 * edges — the state a Chart is opened with, see `keptView`: nothing is deleted,
 * the Cells are simply not part of the Chart being read, and `blank` comes back
 * either way so the knitter can be told what is being kept from them.
 */
export function view(chart, { trimmed = false, overlay = {} } = {}) {
  const painted = chart.cells.map((cells, r) => cells.map((cell, c) => overlay[`${r},${c}`] ?? cell));
  const blank = blankEdgesOf(chart);
  if (!trimmed) return { ...chart, cells: painted, blank, trimmed };
  const cells = painted
    .slice(blank.top, painted.length - blank.bottom)
    .map((row) => row.slice(blank.left, row.length - blank.right));
  // A crop that caught nothing but the page around the chart: refused with the
  // way out, because an empty Chart on screen tells the knitter nothing.
  if (!cells.length || !cells[0].length)
    throw new Error("This chart is blank — crop closer to the pattern and parse it again.");
  return { ...chart, cells, blank, trimmed };
}

/** Where a view's Cell sits in the stored Chart: past the Blank edges it hides. */
const offset = (shown) => (shown.trimmed ? shown.blank : { top: 0, left: 0 });

/**
 * A Row's span of Cells — `from` to `to` inclusive, in either order, because a
 * knitter drags both ways — set to a Palette entry or to Non-stitch. One
 * primitive at two selection sizes: a single Cell is the span `from === to`.
 *
 * A Repaint is the knitter's statement about a Cell, so it is kept as view
 * state rather than written into the parse: it has to outlive a change of
 * Separation, and an index into a Palette that is about to change cannot. The
 * co-ordinates are the ones the knitter sees — the view's — and the guards run
 * against the view for the same reason.
 *
 * New state comes back rather than a mutation, so a Repaint mid drag can be
 * recomputed from the state as it was when the finger went down. Indices
 * outside the Chart are refused: clamping them would paint Cells the knitter
 * never touched, and do it quietly.
 */
export function repaint(chart, state, { row, from, to }, entry) {
  const shown = view(chart, state);
  // Integers, not merely in range: Row 1.5 is no Row, and would otherwise come
  // back as a Chart with nothing painted — the quiet failure this guard is for.
  if (!Number.isInteger(row) || row < 1 || row > rowCount(shown))
    throw new Error(`no Row ${row} in this Chart`);
  const [first, last] = from <= to ? [from, to] : [to, from];
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last >= colCount(shown))
    throw new Error(`cells ${first}–${last} are outside this Chart`);
  // Whole numbers here too: `null >= 0` is true, and a null in the overlay is a
  // Cell with no colour that only shows up when something tries to draw it.
  const known = Number.isInteger(entry) && entry >= 0 && entry < chart.palette.length;
  if (entry !== NON_STITCH && !known)
    throw new Error(`no Palette entry ${entry} in this Chart`);

  // Back through the Blank edges the view hides, so a Repaint is stored against
  // the Cell of the parse the knitter's finger was actually over.
  const { top, left } = offset(shown);
  const index = rowIndex(shown, row) + top;
  const overlay = { ...state.overlay };
  for (let col = first; col <= last; col += 1) overlay[`${index},${col + left}`] = entry;
  return { ...state, overlay };
}
