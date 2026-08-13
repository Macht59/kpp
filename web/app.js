// Pick an image, draw a rectangle around the grid, parse it, Review what came
// back against the image, then Knit the Chart a Row at a time.

import {
  FLAT,
  RIGHT_TO_LEFT,
  cellsOfRow,
  colCount,
  cropIsDoubtful,
  entryLabel,
  opposite,
  readingDirection,
  repaint,
  rowCount,
  rowIndex,
  rowNumber,
  runsOfRow,
} from "./chart.js";
import { corners, grabbedAnchor, rectFrom, wholePixels } from "./crop.js";

const PARSE_TIMEOUT_MS = 30_000; // against a measured ~10 s parse
const HANDLE_CSS_PX = 11; // drawn radius; grabbed at twice that, a 44 px target
const MAX_ZOOM = 20; // 3.2 px per Cell fit-width on the widest corpus chart, so 20x is a fat Cell
const REVIEW = "review";
const KNIT = "knit";

const file = document.getElementById("file");
const stage = document.getElementById("stage");
const source = document.getElementById("source");
const overlay = document.getElementById("overlay");
const rectangle = document.getElementById("rectangle");
const whole = document.getElementById("whole");
const status = document.getElementById("status");
const error = document.getElementById("error");
const modeSwitch = document.getElementById("mode");
const review = document.getElementById("review");
const doubt = document.getElementById("doubt");
const size = document.getElementById("size");
const paletteSize = document.getElementById("palette-size");
const paletteList = document.getElementById("palette");
const paintHint = document.getElementById("paint-hint");
const chipPalette = document.getElementById("chip-palette");
const viewport = document.getElementById("viewport");
const pannable = document.getElementById("pannable");
const reviewChart = document.getElementById("review-chart");
const cropped = document.getElementById("cropped");
const reviewImage = document.getElementById("review-image");
const compare = document.getElementById("compare");
const settings = document.getElementById("settings");
const knit = document.getElementById("knit");
const wholeChart = document.getElementById("whole-chart");
const overview = document.getElementById("overview");
const marker = document.getElementById("marker");
const band = document.getElementById("band");
const rowLabel = document.getElementById("row-label");
const readout = document.getElementById("readout");
const next = document.getElementById("next");
const previous = document.getElementById("previous");
const flip = document.getElementById("flip");
const constructionChoice = document.getElementById("construction");
const startChoice = document.getElementById("start");
const directionBar = document.getElementById("direction");
const arrow = document.getElementById("arrow");
const directionWords = document.getElementById("direction-words");

let chart = null;
let mode = null; // Review or Knit; null until a Chart is on screen
let view = { scale: 1, x: 0, y: 0 }; // the Review pan and zoom, in CSS px of the viewport
let selected = 1; // the Row being knitted, numbered from the bottom of the image
// Construction and Reading direction are the knitter's, per Chart: the parser
// cannot supply them, and neither is ever written into `cells`.
let reading = { construction: FLAT, start: RIGHT_TO_LEFT, flips: {} };
let picked = null; // the Palette entry armed for Repaint in Review; null when none is
let painting = null; // the pointer, Row and first Cell of the paint drag in progress
let openChip = null; // the Run whose chip has the Palette open, in Knit
let chosen = null;
let crop = null; // in image pixels, so it survives the image being laid out differently
let anchor = null; // the corner held still for the drag in progress
let before = null; // the crop as it was when that drag started

file.addEventListener("change", () => {
  chosen = file.files[0] ?? null;
  crop = null;
  say(status, null);
  say(error, null);
  setMode(null);
  stage.hidden = !chosen;
  whole.disabled = !chosen;
  rectangle.disabled = true;
  if (chosen) source.src = URL.createObjectURL(chosen);
});

source.addEventListener("load", fitOverlay);
new ResizeObserver(fitOverlay).observe(source);

overlay.addEventListener("pointerdown", (event) => {
  const point = toImage(event);
  before = crop;
  anchor = (crop && grabbedAnchor(crop, point, 2 * HANDLE_CSS_PX * scale())) ?? point;
  crop = rectFrom(anchor, point, bounds());
  overlay.setPointerCapture(event.pointerId);
  drawCrop();
});

overlay.addEventListener("pointermove", (event) => {
  if (!anchor) return;
  crop = rectFrom(anchor, toImage(event), bounds());
  drawCrop();
});

for (const finished of ["pointerup", "pointercancel"]) {
  overlay.addEventListener(finished, () => {
    anchor = null;
    if (crop && (crop.w < 1 || crop.h < 1)) crop = before; // a stray tap must not wipe a rectangle
    before = null;
    rectangle.disabled = !crop;
    drawCrop();
  });
}

rectangle.addEventListener("click", () => parseAndDraw(wholePixels(crop)));
whole.addEventListener("click", () =>
  parseAndDraw({ x: 0, y: 0, w: source.naturalWidth, h: source.naturalHeight }),
);

/** Parse the given crop and draw what comes back. A failure leaves the rectangle alone. */
async function parseAndDraw(rect) {
  rectangle.disabled = whole.disabled = true;
  say(error, null);
  say(status, "Parsing… this takes a few seconds.");
  try {
    show(await parse(chosen, rect));
    say(status, null);
  } catch (failure) {
    setMode(null); // a stale Chart under the message reads as this crop's output
    say(status, null);
    say(error, failure.message);
  } finally {
    whole.disabled = false;
    rectangle.disabled = !crop;
  }
}

/** POST the image and the crop; give up after PARSE_TIMEOUT_MS. */
async function parse(image, { x, y, w, h }) {
  const body = new FormData();
  body.append("image", image, image.name);
  for (const [field, value] of Object.entries({ x, y, w, h })) body.append(field, value);

  let response;
  try {
    response = await fetch("/api/parse", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
    });
  } catch (failure) {
    throw new Error(
      failure.name === "TimeoutError"
        ? "Parsing took longer than 30 seconds. Check your connection and try again."
        : "Could not reach the parser. Parsing needs a connection.",
    );
  }
  const chart = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(chart.error ?? `Parsing failed (${response.status}).`);
  return chart;
}

/** A freshly parsed Chart is unverified, so it opens in Review, at its bottom Row. */
function show(parsed) {
  chart = parsed;
  selected = 1;
  reading = chosenReading({});
  picked = null;
  reviewImage.src = source.src;
  frameTheImage();
  showImage(false);
  redraw();
  drawFacts();
  setMode(REVIEW);
}

/** Show Review, Knit, or neither. The two are navigation models, so only one is up. */
function setMode(wanted) {
  mode = chart ? wanted : null;
  review.hidden = mode !== REVIEW;
  knit.hidden = mode !== KNIT;
  modeSwitch.hidden = settings.hidden = mode === null;
  modeSwitch.textContent = mode === REVIEW ? "Knit this chart" : "Review this parse";
  if (mode === REVIEW) resetView(); // the survey starts from the whole Chart every time
}

// Reviewing is a step, not a destination — and a parse error noticed at Row 88
// is only fixable if the way back is always there.
modeSwitch.addEventListener("click", () => setMode(mode === REVIEW ? KNIT : REVIEW));

/**
 * The three signals a knitter checks a parse against. Dimensions and Palette
 * size are the errors that cannot be corrected, only parsed again — and a
 * Palette that came back short is silent otherwise: no error, no low
 * confidence, just seven swatches where the pattern says nine.
 */
function drawFacts() {
  // Stated from `cells` rather than from `dimensions`: the contract declares
  // both and they agree, but only one of them is the Chart that gets knitted.
  const entries = chart.palette.length;
  size.textContent = `${rowCount(chart)} rows × ${colCount(chart)} columns`;
  paletteSize.textContent = `${entries} ${entries === 1 ? "colour" : "colours"}`;
  paletteList.replaceChildren(
    ...chart.palette.map((colour, entry) => pickable(colour, entry, arm)),
  );
  chipPalette.replaceChildren(
    ...chart.palette.map((colour, entry) => pickable(colour, entry, paintRun)),
  );
  doubt.hidden = !cropIsDoubtful(chart);
  showArmed();
}

/**
 * One Palette entry: the count of entries the eye catches rather than reads, and
 * the handle both Repaints hang off — armed in Review, tapped under a chip in Knit.
 */
function pickable(colour, entry, choose) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.className = "swatch";
  button.style.background = rgb(colour.rgb);
  button.title = entryLabel(chart, entry);
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => choose(entry));
  item.append(button);
  return item;
}

/**
 * Repaint in Review is Palette-bar-first: arm an entry, then tap a Cell or drag
 * across several. Arming the armed entry disarms it, which is also how the
 * knitter hands one-finger gestures back to pan.
 */
function arm(entry) {
  picked = picked === entry ? null : entry;
  showArmed();
}

function showArmed() {
  for (const [index, button] of [...paletteList.querySelectorAll("button")].entries())
    button.setAttribute("aria-pressed", String(index === picked));
  paintHint.textContent =
    picked === null
      ? "Tap a colour to correct cells with it. Drag with one finger to pan, two to zoom."
      : `Painting ${entryLabel(chart, picked)} — tap a cell, or drag across several. ` +
        "Tap the colour again to pan instead.";
}

compare.addEventListener("click", () => showImage(cropped.hidden));

/**
 * The Chart, or the image it was parsed from — shown through a window the shape
 * of the crop, so the two are the same picture of the same thing and the toggle
 * is a comparison rather than two views. Deskew is not undone: `skew_deg` is a
 * fraction of a degree on the corpus, which is nothing at a Chart's scale.
 */
function frameTheImage() {
  const [x, y, w] = chart.source.crop;
  const zoom = chart.source.image_width / w; // the crop, whatever its size, fills the window
  cropped.style.aspectRatio = `${colCount(chart)} / ${rowCount(chart)}`;
  reviewImage.style.width = `${zoom * 100}%`;
  // percentage margins resolve against the window's width, which is the crop's width
  reviewImage.style.marginLeft = `${(-x * 100) / w}%`;
  reviewImage.style.marginTop = `${(-y * 100) / w}%`;
}

/** Swap the two, leaving the pan and zoom where the knitter put them. */
function showImage(wanted) {
  cropped.hidden = !wanted;
  reviewChart.hidden = wanted;
  compare.textContent = wanted ? "Show the chart" : "Show the image";
  applyView();
}

/** The Selected Row: where it sits, its colour bands, and its Readout. */
function drawRow() {
  const rows = rowCount(chart);
  const direction = readingDirection(reading, selected);
  const runs = runsOfRow(chart, selected, direction);
  const stitches = runs.reduce((total, run) => total + run.count, 0);

  marker.style.top = `${(rowIndex(chart, selected) * 100) / rows}%`;
  marker.style.height = `${100 / rows}%`;
  drawCells(band, [cellsOfRow(chart, selected)]);

  const rightToLeft = direction === RIGHT_TO_LEFT;
  directionBar.className = direction;
  arrow.textContent = rightToLeft ? "←" : "→";
  directionWords.textContent = `Reading ${rightToLeft ? "right to left" : "left to right"}${
    reading.flips[selected] ? " — flipped by hand" : ""
  }`;

  rowLabel.textContent = `Row ${selected} of ${rows} — ${stitches} stitches`;
  openChip = null; // a Row that has moved under the picker is not the Run it was opened for
  readout.replaceChildren(...runs.map(chip));
  showOpenChip();
  previous.disabled = selected === 1;
  next.disabled = selected === rows;
}

/** One Run: a swatch and a Cell count, big enough to hit — and tapping it Repaints it. */
function chip(run) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  const swatch = document.createElement("span");
  button.className = "chip";
  button.dataset.at = run.at;
  button.setAttribute("aria-controls", chipPalette.id);
  swatch.className = "swatch";
  swatch.style.background = rgb(chart.palette[run.entry].rgb);
  button.append(swatch, `${run.count} ${entryLabel(chart, run.entry)}`);
  button.addEventListener("click", () => {
    openChip = openChip?.at === run.at ? null : run;
    showOpenChip();
  });
  item.append(button);
  return item;
}

/** The Palette below the Readout, open for the tapped chip or shut. */
function showOpenChip() {
  chipPalette.hidden = !openChip;
  for (const button of readout.querySelectorAll("button"))
    button.setAttribute("aria-expanded", String(Number(button.dataset.at) === openChip?.at));
}

/**
 * Knit's Repaint: the whole Run the tapped chip stands for, in the Selected Row
 * and no other — the chips are that Row's, so there is no other Row to reach.
 */
function paintRun(entry) {
  const { at, count } = openChip;
  chart = repaint(chart, { row: selected, from: at, to: at + count - 1 }, entry);
  redraw();
}

/** Every view of the Cells, after a Repaint has given us a new Chart. */
function redraw() {
  drawCells(reviewChart, chart.cells);
  drawCells(wholeChart, chart.cells);
  drawRow();
}

/** Draw Cells one canvas pixel each; CSS stretches them to whatever width the phone has. */
function drawCells(canvas, cells) {
  canvas.width = cells[0].length; // also clears
  canvas.height = cells.length;
  const context = canvas.getContext("2d");
  cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell < 0) return; // Non-stitch is background, not yarn: leave it transparent
      context.fillStyle = rgb(chart.palette[cell].rgb);
      context.fillRect(c, r, 1, 1);
    }),
  );
}

/** One array Row's Cells, over whatever was drawn there before. */
function drawRowOfCells(canvas, index) {
  const context = canvas.getContext("2d");
  chart.cells[index].forEach((cell, c) => {
    context.clearRect(c, index, 1, 1); // Non-stitch is transparent, so painting over is not enough
    if (cell < 0) return;
    context.fillStyle = rgb(chart.palette[cell].rgb);
    context.fillRect(c, index, 1, 1);
  });
}

const rgb = ([red, green, blue]) => `rgb(${red} ${green} ${blue})`;

for (const [button, step] of [
  [next, 1],
  [previous, -1],
]) {
  button.addEventListener("click", () => {
    selected = Math.min(Math.max(selected + step, 1), rowCount(chart));
    drawRow();
  });
}

/** What the two controls currently say, over the Rows already Flipped by hand. */
const chosenReading = (flips) => ({
  construction: constructionChoice.value,
  start: startChoice.value,
  flips,
});

// Both controls are hidden until a Chart is on screen, and belong to neither
// mode: they are set at Review and changed while Knitting. A Flipped Row keeps
// its direction across the change: it was set to correct exactly this rule.
for (const control of [constructionChoice, startChoice]) {
  control.addEventListener("change", () => {
    reading = chosenReading(reading.flips);
    drawRow();
  });
}

// One Row Flipped by hand, for when the alternation has slipped — frogged a
// Row, or started on the wrong side. Flipping a Flipped Row hands it back to
// the Construction.
flip.addEventListener("click", () => {
  const flips = { ...reading.flips };
  if (flips[selected]) delete flips[selected];
  else flips[selected] = opposite(readingDirection(reading, selected));
  reading = { ...reading, flips };
  drawRow();
});

// Tapping a Row in the overview jumps to it — losing your place is recoverable.
overview.addEventListener("click", (event) => {
  selected = cellAt(wholeChart, event).row;
  drawRow();
});

// Free pan and pinch over the whole Chart. One gesture, not two: a finger
// dragging and two fingers pinching are the same sum — keep whatever the
// fingers landed on under the fingers — so both fall out of one formula, with
// the pinch contributing a scale factor of 1 while there is only one finger.
const touching = new Map();
let grip = null; // where the fingers were on the previous move

viewport.addEventListener("pointerdown", (event) => {
  viewport.setPointerCapture(event.pointerId);
  touching.set(event.pointerId, event);
  grip = gripNow();
  // With an entry armed, one finger on the Chart paints. A second finger is a
  // pinch, so it ends the paint and the fingers zoom: Repaint takes the one
  // gesture pan can spare, and never the one it cannot.
  painting = null;
  if (armedToPaint() && touching.size === 1 && over(reviewChart, event)) {
    const { row, col } = cellAt(reviewChart, event);
    painting = { pointer: event.pointerId, row, from: col, base: chart };
    paintTo(col);
  }
});

viewport.addEventListener("pointermove", (event) => {
  if (painting?.pointer === event.pointerId) return paintTo(cellAt(reviewChart, event).col);
  if (!touching.has(event.pointerId)) return;
  touching.set(event.pointerId, event);
  const now = gripNow();
  const pinched = grip.spread && now.spread ? now.spread / grip.spread : 1;
  const scale = Math.min(Math.max(view.scale * pinched, fitsWhole()), MAX_ZOOM);
  const grew = scale / view.scale;
  view = {
    scale,
    x: now.x - grew * (grip.x - view.x),
    y: now.y - grew * (grip.y - view.y),
  };
  grip = now;
  applyView();
});

for (const finished of ["pointerup", "pointercancel"]) {
  viewport.addEventListener(finished, (event) => {
    if (painting?.pointer === event.pointerId) {
      painting = null;
      redraw(); // the drag only kept the Chart in front of the knitter up to date
    }
    touching.delete(event.pointerId);
    grip = gripNow(); // lifting one finger of a pinch must not throw the Chart across the screen
  });
}

/** Repaint is armed only over the Chart itself: the image beside it is not paintable. */
const armedToPaint = () => mode === REVIEW && picked !== null && cropped.hidden;

/**
 * Whether a pointer is on a canvas at all. The Chart is centred when it is
 * shorter than the viewport, so there is blank band either side of it — and a
 * clamped tap there would paint an edge Cell the knitter never touched.
 */
function over(canvas, event) {
  const box = canvas.getBoundingClientRect();
  return (
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom
  );
}

/** Which Cell a pointer is over, clamped: a drag off the edge paints up to it. */
function cellAt(canvas, event) {
  const box = canvas.getBoundingClientRect();
  const rows = rowCount(chart);
  const cols = colCount(chart);
  const at = (fraction, count) => Math.min(Math.max(Math.floor(fraction * count), 0), count - 1);
  return {
    row: rowNumber(chart, at((event.clientY - box.top) / box.height, rows)),
    col: at((event.clientX - box.left) / box.width, cols),
  };
}

/**
 * The span from where the finger went down to where it is now, painted from the
 * Chart as it was then — so a drag that doubles back leaves painted only what
 * the finger is currently over. The Row is the one the drag started in: a hand
 * that wanders up a Row must not repaint that one too.
 *
 * Only the Row that changed is redrawn, and only on the canvas the knitter is
 * looking at: a full redraw is 112×150 Cells twice plus a rebuilt Readout, per
 * pointer move, for one Row's worth of difference.
 */
function paintTo(col) {
  chart = repaint(painting.base, { row: painting.row, from: painting.from, to: col }, picked);
  drawRowOfCells(reviewChart, rowIndex(chart, painting.row));
}

/** Where the fingers are: their centre in the viewport, and how far apart they are. */
function gripNow() {
  const points = [...touching.values()];
  if (!points.length) return { x: 0, y: 0, spread: 0 };
  const box = viewport.getBoundingClientRect();
  const centre = (of) => points.reduce((total, point) => total + of(point), 0) / points.length;
  const [first, second] = points;
  return {
    x: centre((point) => point.clientX) - box.left,
    y: centre((point) => point.clientY) - box.top,
    spread: second ? Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY) : 0,
  };
}

/** Review is a survey, so it opens on the whole Chart, however tall that is. */
function resetView() {
  view = { scale: fitsWhole(), x: 0, y: 0 };
  applyView();
}

/**
 * The zoom that fits the whole Chart in the viewport, and the floor the pinch
 * stops at. Fit-width is not it: the narrowest corpus chart is eight Cells
 * across and forty times as tall, so fit-width shows a fortieth of it.
 */
function fitsWhole() {
  const fits = viewport.clientHeight / pannable.offsetHeight;
  return fits > 0 && fits < 1 ? fits : 1; // a Chart shorter than the viewport is whole at fit-width
}

/** Move the Chart, keeping it over the viewport: panning off into blank space loses the knitter. */
function applyView() {
  const [width, height] = [viewport.clientWidth, viewport.clientHeight];
  // fit-width at scale 1, so the content is one viewport wide before the zoom
  view.x = middleOr(width, view.scale * width, view.x);
  view.y = middleOr(height, view.scale * pannable.offsetHeight, view.y);
  pannable.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

/** An offset that keeps the content covering the viewport — or centred, when it is smaller. */
function middleOr(viewportSize, contentSize, offset) {
  if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2;
  return Math.min(0, Math.max(offset, viewportSize - contentSize));
}

// A phone turned on its side is a different viewport, and the Chart must not be
// left panned into the blank space that was the rest of the screen.
new ResizeObserver(() => {
  if (mode === REVIEW) applyView();
}).observe(viewport);

/** Dim everything outside the rectangle, then outline it and draw its handles. */
function drawCrop() {
  const context = overlay.getContext("2d");
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); // draw in CSS px
  const [width, height] = [source.clientWidth, source.clientHeight];
  context.clearRect(0, 0, width, height);
  if (!crop) return;

  const [x, y, w, h] = [crop.x, crop.y, crop.w, crop.h].map((v) => v / scale());
  context.fillStyle = "rgb(0 0 0 / 45%)";
  context.fillRect(0, 0, width, height);
  context.clearRect(x, y, w, h);

  context.lineWidth = 2;
  context.strokeStyle = "white";
  context.strokeRect(x, y, w, h);
  context.fillStyle = "white";
  for (const corner of corners({ x, y, w, h })) {
    context.beginPath();
    context.arc(corner.x, corner.y, HANDLE_CSS_PX, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
  }
}

function fitOverlay() {
  if (!source.naturalWidth) return;
  overlay.width = source.clientWidth * devicePixelRatio; // CSS size comes from inset: 0
  overlay.height = source.clientHeight * devicePixelRatio;
  drawCrop();
}

/** Image pixels per CSS pixel — the image is laid out to fit the phone. */
function scale() {
  return source.naturalWidth / source.clientWidth;
}

function bounds() {
  return { width: source.naturalWidth, height: source.naturalHeight };
}

function toImage(event) {
  const box = source.getBoundingClientRect();
  return { x: (event.clientX - box.left) * scale(), y: (event.clientY - box.top) * scale() };
}

function say(element, message) {
  element.textContent = message ?? "";
  element.hidden = !message;
}
