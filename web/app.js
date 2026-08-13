// Pick an image, draw a rectangle around the grid, parse it, then Knit the
// Chart a Row at a time. Review arrives in a later ticket.

import { cellsOfRow, entryLabel, rowCount, rowIndex, rowNumber, runsOfRow } from "./chart.js";
import { corners, grabbedAnchor, rectFrom, wholePixels } from "./crop.js";

const PARSE_TIMEOUT_MS = 30_000; // against a measured ~10 s parse
const HANDLE_CSS_PX = 11; // drawn radius; grabbed at twice that, a 44 px target

const file = document.getElementById("file");
const stage = document.getElementById("stage");
const source = document.getElementById("source");
const overlay = document.getElementById("overlay");
const rectangle = document.getElementById("rectangle");
const whole = document.getElementById("whole");
const status = document.getElementById("status");
const error = document.getElementById("error");
const knit = document.getElementById("knit");
const wholeChart = document.getElementById("whole-chart");
const overview = document.getElementById("overview");
const marker = document.getElementById("marker");
const band = document.getElementById("band");
const rowLabel = document.getElementById("row-label");
const readout = document.getElementById("readout");
const next = document.getElementById("next");
const previous = document.getElementById("previous");

let chart = null;
let selected = 1; // the Row being knitted, numbered from the bottom of the image
let chosen = null;
let crop = null; // in image pixels, so it survives the image being laid out differently
let anchor = null; // the corner held still for the drag in progress
let before = null; // the crop as it was when that drag started

file.addEventListener("change", () => {
  chosen = file.files[0] ?? null;
  crop = null;
  say(status, null);
  say(error, null);
  knit.hidden = true;
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
    knit.hidden = true; // a stale Chart under the message reads as this crop's output
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

/** Knit a freshly parsed Chart, starting at the bottom Row. */
function show(parsed) {
  chart = parsed;
  selected = 1;
  drawCells(wholeChart, chart.cells);
  knit.hidden = false;
  drawRow();
}

/** The Selected Row: where it sits, its colour bands, and its Readout. */
function drawRow() {
  const rows = rowCount(chart);
  const runs = runsOfRow(chart, selected);
  const stitches = runs.reduce((total, run) => total + run.count, 0);

  marker.style.top = `${(rowIndex(chart, selected) * 100) / rows}%`;
  marker.style.height = `${100 / rows}%`;
  drawCells(band, [cellsOfRow(chart, selected)]);

  rowLabel.textContent = `Row ${selected} of ${rows} — ${stitches} stitches`;
  readout.replaceChildren(...runs.map(chip));
  previous.disabled = selected === 1;
  next.disabled = selected === rows;
}

/** One Run: a swatch and a Cell count, big enough to hit. */
function chip({ entry, count }) {
  const item = document.createElement("li");
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = rgb(chart.palette[entry].rgb);
  item.append(swatch, `${count} ${entryLabel(chart, entry)}`);
  return item;
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

// Tapping a Row in the overview jumps to it — losing your place is recoverable.
overview.addEventListener("click", (event) => {
  const box = wholeChart.getBoundingClientRect();
  const index = Math.floor(((event.clientY - box.top) / box.height) * rowCount(chart));
  selected = rowNumber(chart, Math.min(Math.max(index, 0), rowCount(chart) - 1));
  drawRow();
});

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
