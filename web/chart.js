// Chart logic: pure functions over the Chart contract, schema 1 and 2.
// No DOM, no canvas, no storage — this is the module under test.

const NON_STITCH = -1;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const FLAT = "flat";
export const IN_THE_ROUND = "in the round";
export const FLAT_DOUBLED = "flat doubled";
export const RIGHT_TO_LEFT = "right-to-left";
export const LEFT_TO_RIGHT = "left-to-right";

export const opposite = (direction) =>
  direction === RIGHT_TO_LEFT ? LEFT_TO_RIGHT : RIGHT_TO_LEFT;

/**
 * Which way a Row is read, from the Chart's Construction, its starting
 * direction, and the Rows the knitter has Flipped. Flat turns the work every
 * Row so the direction alternates; in the round never turns so it holds. Flat
 * doubled turns the work too, but the way back is knitted off the previous row
 * rather than off the Chart — so the Chart is only ever read on the way out and
 * the direction holds, as it does in the round. A Flip wins over all three —
 * that is how a knitter recovers when the alternation has slipped. Derived from
 * the Row number alone, so retreating to a Row reads the same way as arriving at
 * it forwards.
 */
export function readingDirection({ construction, start, flips }, row) {
  return flips[row] ?? (construction === FLAT && (row - 1) % 2 === 1 ? opposite(start) : start);
}

/**
 * The Worked rows one Chart Row stands for. Worked once under flat and in the
 * round, so a Row is its own number; under flat doubled every Row is worked
 * twice, out off the Chart and back off the work, so Row *n* is Worked rows
 * `2n-1` and `2n` — and the Chart's last Row names how many Worked rows the
 * whole Chart is.
 */
export function workedRows({ construction }, row) {
  return construction === FLAT_DOUBLED ? [2 * row - 1, 2 * row] : [row];
}

/**
 * Charts kept on the device outlive the service release that parsed them, so
 * one read back off the device is checked before it is drawn: a later schema
 * could move Cells under the same field names, and a mis-read Chart is a
 * knitter following counts that are not their pattern's.
 */
// Both are readable, because a v1 Chart is exactly a v2 Chart with one
// Separation. Refusing one would tell a knitter their existing library was
// "saved by a newer version of this app", which is both wrong and expensive.
export const SCHEMA_VERSIONS = [1, 2];

export const isReadable = (chart) => SCHEMA_VERSIONS.includes(chart?.schema_version);

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
 * The letter an entry answers to before anyone names it — its position in the
 * Palette. Named separately from the label because the box a knitter types a
 * Colorway into has to say which entry it belongs to whether or not it is
 * filled in, and their own name in that place would say nothing.
 */
export const entryLetter = (entry) => `Colour ${LETTERS[entry] ?? entry + 1}`;

/**
 * What a chip calls a Palette entry. The stateless service leaves `name` null,
 * so the position stands in until a Colorway is mapped to it.
 */
export function entryLabel(chart, entry) {
  return chart.palette[entry].name ?? entryLetter(entry);
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
// for a Chart at a given Separation: a knitter tidying a speck off an otherwise
// white edge Column must not have that Column disappear and every Column number
// shift under them. Kept, because a paint drag derives the view on every pointer
// move and the scan walks the whole Chart.
const edgesOfChart = new WeakMap();

function blankEdgesOf(chart, { index, palette, read }) {
  const cached = edgesOfChart.get(chart.cells) ?? new Map();
  edgesOfChart.set(chart.cells, cached);
  // Recomputed per Separation, so a hidden line is never a line the knitter can
  // see has colour in it: white and off-white may be one entry at a coarse
  // Separation and two at a fine one.
  if (!cached.has(index))
    cached.set(index, blankEdges({ cells: chart.cells.map((row) => row.map(read)), palette }));
  return cached.get(index);
}

/**
 * The Separations a Chart offers, coarse to fine — what the knitter chooses
 * between, labelled by the colour count they can check against the yarns in
 * front of them. A Chart parsed before Separations existed offers exactly one —
 * its own Palette, merged with nothing — so v1 is read here as the v2 Chart it
 * always was, and a chooser is simply never worth showing for it.
 */
export const separations = (chart) =>
  chart.separations ?? [
    { colours: chart.palette.length, merge: chart.palette.map((_, entry) => entry) },
  ];

/**
 * The Separation being read: the knitter's choice, or the parser's default when
 * they have made none. A choice that no longer indexes a Separation — a Chart
 * re-parsed under it — falls back to the default rather than refusing to draw.
 */
function separationOf(chart, chosen) {
  const offered = separations(chart);
  // One index for both the Separation and the Blank-edge cache, so a default
  // that indexes nothing either cannot key edges belonging to another answer.
  const index = [chosen, chart.default_separation, 0].find((at) => offered[at]);
  return { index, ...offered[index] };
}

/**
 * The Palette of one Separation: each entry the average of the finest entries it
 * merges, weighted by how many Cells each of those holds. Derived rather than
 * stored, because a colour list per Separation would be a second source of truth
 * for the same colours. An entry that merges nothing comes through as it is,
 * Colorway name and all.
 *
 * The weighting is what makes the default Separation the Chart the parser used
 * to return: each parsed entry is the average of the Cells that landed in it, so
 * a coarse entry has to be too. Averaging its finest entries evenly instead
 * drags every colour towards the near-duplicates around it — on the corpus, a
 * white of 252 came out at 236 and a mid grey at 210.
 * `ponytail:` averaged in RGB where the parser averages in Lab. Worth 5 levels
 * of one channel at most across the corpus, on one orange, so the conversion is
 * not worth carrying here — do it if a merged colour ever reads visibly wrong.
 */
function paletteOf(chart, merge, counts) {
  const groups = [];
  merge.forEach((to, from) => (groups[to] ??= []).push(from));
  return groups.map((group) => {
    if (group.length === 1) return chart.palette[group[0]];
    // An entry no Cell uses still counts once, so a group of them averages
    // rather than dividing by nothing.
    const weights = group.map((entry) => counts[entry] || 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return {
      rgb: [0, 1, 2].map((channel) =>
        Math.round(
          group.reduce((sum, entry, at) => sum + chart.palette[entry].rgb[channel] * weights[at], 0) /
            total,
        ),
      ),
      name: null,
    };
  });
}

/**
 * The Palette under the names the knitter has given its entries. Keyed by
 * Separation as well as entry, because `paletteOf` derives a Palette per
 * Separation and entry 2 at three colours is a different colour from entry 2 at
 * four — a name keyed by entry alone would put their word on a colour they
 * never named. An empty name is no name: the positional letter comes back,
 * which is what clearing the box has to mean.
 */
const named = (palette, names, separation) =>
  palette.map((entry, at) =>
    names[`${separation},${at}`] ? { ...entry, name: names[`${separation},${at}`] } : entry,
  );

// The Cells of the parse behind each finest Palette entry — the weights the
// derived colours are averaged with. Of the parse and not of the Repaints over
// it, for the same reason the Blank edges are, and kept for the same one: a
// paint drag derives the view on every pointer move.
const countsOfChart = new WeakMap();

function countsOf(chart) {
  if (!countsOfChart.has(chart.cells)) {
    const counts = chart.palette.map(() => 0);
    for (const row of chart.cells) for (const cell of row) if (cell !== NON_STITCH) counts[cell] += 1;
    countsOfChart.set(chart.cells, counts);
  }
  return countsOfChart.get(chart.cells);
}

/**
 * The Chart the knitter is reading, derived from the stored one and the
 * decisions they have made about it: which Separation to read it at, whether
 * Blank edges are hidden, and the Cells they have Repainted. It comes back in
 * exactly the shape every function above consumes, so they operate on the view
 * and never learn that a view exists.
 *
 * `separation` is which of the Chart's Separations to read it at — under v2
 * `palette` is the *finest* one, a base for the merge maps rather than something
 * to show a knitter, so the view's Palette is always a Separation's. `overlay`
 * is the Repaints, keyed by array Row and Column of the stored Chart and holding
 * finest-Palette entries, so they hold still when the Chart is read differently.
 * `names` is what the knitter calls the Palette entries, keyed by Separation as
 * well as entry, and applied here so that every label downstream is theirs
 * without knowing a Colorway can be named. `trimmed` hides the Blank edges — the state a Chart is opened with, see
 * `keptView`: nothing is deleted, the Cells are simply not part of the Chart
 * being read, and `blank` comes back either way so the knitter can be told what
 * is being kept from them.
 */
export function view(chart, { separation, trimmed = false, overlay = {}, names = {} } = {}) {
  const { index, merge } = separationOf(chart, separation);
  const palette = named(paletteOf(chart, merge, countsOf(chart)), names, index);
  const read = (cell) => (cell === NON_STITCH ? NON_STITCH : merge[cell]);
  const painted = chart.cells.map((cells, r) =>
    cells.map((cell, c) => read(overlay[`${r},${c}`] ?? cell)),
  );
  const blank = blankEdgesOf(chart, { index, palette, read });
  // The Separation actually read at, which is the knitter's only when they have
  // chosen one — a chooser marking their choice rather than the answer on screen
  // would mark nothing at all on a Chart they have never touched.
  const shown = { ...chart, palette, blank, trimmed, separation: index };
  if (!trimmed) return { ...shown, cells: painted };
  const cells = painted
    .slice(blank.top, painted.length - blank.bottom)
    .map((row) => row.slice(blank.left, row.length - blank.right));
  // A crop that caught nothing but the page around the chart: refused with the
  // way out, because an empty Chart on screen tells the knitter nothing.
  if (!cells.length || !cells[0].length)
    throw new Error("This chart is blank — crop closer to the pattern and parse it again.");
  return { ...shown, cells };
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
 *
 * A caller dragging a finger across a Row has the Chart derived already, and
 * hands it back rather than paying for a second derivation of it on every
 * pointer move. Only the bounds and the Blank edges are read from it, and a
 * Repaint moves neither: the edges are measured from the parse, not from the
 * Repaints over it. So any view of this Chart at this Separation will do.
 */
export function repaint(chart, state, { row, from, to }, entry, shown = view(chart, state)) {
  // Integers, not merely in range: Row 1.5 is no Row, and would otherwise come
  // back as a Chart with nothing painted — the quiet failure this guard is for.
  if (!Number.isInteger(row) || row < 1 || row > rowCount(shown))
    throw new Error(`no Row ${row} in this Chart`);
  const [first, last] = from <= to ? [from, to] : [to, from];
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last >= colCount(shown))
    throw new Error(`cells ${first}–${last} are outside this Chart`);
  // The knitter points at a colour of the Chart they can see, which is one
  // Separation's entry; the Repaint is recorded at the finest Separation, so it
  // survives a switch in either direction. Of the finest entries that entry
  // merges, the one holding the most Cells: the swatch they tapped is those
  // entries averaged by Cell count, so the most-used is the colour it mostly
  // was, and switching to a finer Separation shows them that rather than
  // whichever near-duplicate happened to be first. The search also does the
  // guarding — `null >= 0` is true and 1.5 indexes nothing, and a null in the
  // overlay is a Cell with no colour that only shows up when something draws it.
  const { merge } = separationOf(chart, state.separation);
  const counts = countsOf(chart);
  const finest = merge.reduce(
    (best, to, from) => (to === entry && (best < 0 || counts[from] > counts[best]) ? from : best),
    -1,
  );
  if (entry !== NON_STITCH && finest < 0)
    throw new Error(`no Palette entry ${entry} in this Chart`);

  // Back through the Blank edges the view hides, so a Repaint is stored against
  // the Cell of the parse the knitter's finger was actually over.
  const { top, left } = offset(shown);
  const index = rowIndex(shown, row) + top;
  const overlay = { ...state.overlay };
  const stored = entry === NON_STITCH ? NON_STITCH : finest;
  for (let col = first; col <= last; col += 1) overlay[`${index},${col + left}`] = stored;
  return { ...state, overlay };
}
