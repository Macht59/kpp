// Pick an image, draw a rectangle around the grid, parse it, Review what came
// back against the image, then Knit the Chart a Row at a time. What is parsed
// stays on the device, so sitting down again is one tap on the library.

import {
  FLAT,
  RIGHT_TO_LEFT,
  cellsOfRow,
  colCount,
  cropIsDoubtful,
  entryLabel,
  isReadable,
  opposite,
  readingDirection,
  repaint,
  rowCount,
  rowIndex,
  rowNumber,
  runsOfRow,
  view,
} from "./chart.js";
import { corners, grabbedAnchor, rectFrom, wholePixels } from "./crop.js";
import { askToKeep, forget, keep, remember, restore, spaceLeft, stored } from "./library.js";
import {
  KNIT,
  REVIEW,
  blankWords,
  measured,
  paletteWords,
  rowAfterAdopting,
  rowOnOpening,
  screenFor,
  separationChoices,
  updateOffer,
  versionWords,
} from "./screen.js";
import { VERSION } from "./version.js";

const PARSE_TIMEOUT_MS = 30_000; // against a measured ~10 s parse
const HANDLE_CSS_PX = 11; // drawn radius; grabbed at twice that, a 44 px target
const MAX_ZOOM = 20; // 3.2 px per Cell fit-width on the widest corpus chart, so 20x is a fat Cell
const REPARSED = " (re-parse)"; // so two crops of one image are two names in the library
const OFFLINE =
  "Parsing needs a connection, and there isn't one. Charts you have already " +
  "parsed work offline — knitting from one needs nothing.";

const file = document.getElementById("file");
const stage = document.getElementById("stage");
const source = document.getElementById("source");
const overlay = document.getElementById("overlay");
const rectangle = document.getElementById("rectangle");
const whole = document.getElementById("whole");
const status = document.getElementById("status");
const error = document.getElementById("error");
const update = document.getElementById("update");
const updateWords = document.getElementById("update-words");
const applyUpdate = document.getElementById("apply-update");
const modeSwitch = document.getElementById("mode");
const review = document.getElementById("review");
const doubt = document.getElementById("doubt");
const size = document.getElementById("size");
const trim = document.getElementById("trim");
const trimWords = document.getElementById("trim-words");
const showBlanks = document.getElementById("show-blanks");
const separationChoice = document.getElementById("separation");
const separationList = document.getElementById("separations");
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
const reparse = document.getElementById("reparse");
const startOver = document.getElementById("start-over");
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
const library = document.getElementById("library");
const keptList = document.getElementById("kept");
const quota = document.getElementById("quota");
const version = document.getElementById("version");

let chart = null; // the parse, as it came back and as it stays
let shown = null; // the Chart the knitter reads: `chart` under the decisions in `chosenView`
// What the knitter has decided about how this Chart is read — their Repaints,
// and (from later tickets) the Separation and whether Blank edges are hidden.
let chosenView = keptView({});
let openId = null; // which stored Chart is on screen, so its record follows the work
let parses = 0; // which parse is on screen, so a slow save cannot attach to a newer one
let mode = null; // Review or Knit; null until a Chart is on screen
let camera = { scale: 1, x: 0, y: 0 }; // the Review pan and zoom, in CSS px of the viewport
let selected = 1; // the Row being knitted, numbered from the bottom of the image
// Construction and Reading direction are the knitter's, per Chart: the parser
// cannot supply them, and neither is ever written into `cells`.
let reading = { construction: FLAT, start: RIGHT_TO_LEFT, flips: {} };
let picked = null; // the Palette entry armed for Repaint in Review; null when none is
let painting = null; // the pointer, Row and first Cell of the paint drag in progress
let openChip = null; // the Run whose chip has the Palette open, in Knit
let chosen = null; // the image being parsed from — a chosen file, or a stored one for a Re-parse
let chartName = null; // what the next parse will be kept under
let imageUrl = null; // that image, drawn on the crop step and compared against in Review
let crop = null; // in image pixels, so it survives the image being laid out differently
let anchor = null; // the corner held still for the drag in progress
let before = null; // the crop as it was when that drag started

// Uploading another image is how a knitter abandons a chart that will not parse
// at all, so it is the same control as the first upload and it is always there.
file.addEventListener("change", () => {
  const image = file.files[0];
  // Cleared, so choosing the same file again is a change again: a knitter
  // abandoning a parse often reaches for the image they just uploaded.
  file.value = "";
  if (image) cropAgain(image, image.name, null);
});

/**
 * Put an image on the crop step: a newly chosen file with no rectangle yet, or
 * one already on the device with the rectangle its Chart was parsed from. What
 * was on screen goes away — the knitter is parsing now, not reviewing — but
 * nothing is written over: the parse that lands is kept as a Chart of its own.
 */
function cropAgain(image, name, rect) {
  chosen = image;
  chartName = name;
  crop = rect;
  anchor = before = null;
  say(status, null);
  say(error, null);
  setMode(null);
  revokeImage();
  imageUrl = URL.createObjectURL(image);
  source.src = reviewImage.src = imageUrl;
  stage.hidden = false;
  whole.disabled = true; // until the image has loaded: its size is 0 until then
  rectangle.disabled = !crop;
  fitOverlay();
  stage.scrollIntoView({ block: "center" });
}

source.addEventListener("load", () => {
  // The whole image is only a crop once its size is known, and only offered
  // while the crop step is up — a Chart opened from the library is past it.
  whole.disabled = stage.hidden;
  fitOverlay();
});
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
  // Said before the upload rather than after it times out: parsing is the one
  // thing here that needs a connection, and a knitter offline in a chair should
  // hear that in a sentence rather than watch a spinner fail.
  if (!navigator.onLine) throw new Error(OFFLINE);

  const body = new FormData();
  body.append("image", image, image.name ?? chartName);
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
        // Not OFFLINE: the device says it is online, so the parser is down or
        // unreachable, and telling the knitter to check a connection they have
        // sends them to fix the wrong thing.
        : "Could not reach the parser. Parsing needs a connection to it.",
    );
  }
  const chart = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(chart.error ?? `Parsing failed (${response.status}).`);
  return chart;
}

/**
 * The decisions a stored Chart was left with, and what a Chart nobody has
 * decided anything about yet starts from. A record written before these fields
 * existed simply has none of them, and lands on the same defaults a fresh parse
 * does.
 */
function keptView({ separation, trimmed, overlay }) {
  // No Separation of their own means the parser's default, which `view` knows
  // and a stored record does not — a v1 Chart has no default to record.
  return { separation, trimmed: trimmed ?? true, overlay: overlay ?? {} };
}

/** A freshly parsed Chart is unverified, so it opens in Review, at its bottom Row. */
function show(parsed) {
  chart = parsed;
  chosenView = keptView({});
  openId = null; // nothing is written back until this parse has a record of its own
  selected = 1;
  reading = chosenReading({});
  picked = null;
  // Kept whatever the drawing does, because the parse is the thing that took
  // ten seconds and a connection, and a Chart that failed to draw is still a
  // Chart the knitter can open again after an update that fixes the drawing.
  // The failure itself is not swallowed: it goes on to `parseAndDraw`, which
  // says so.
  try {
    drawTheChart(); // before the frame: the window is cut to the size of the Chart read
    frameTheImage();
    showImage(false);
    drawFacts();
    setMode(REVIEW);
  } finally {
    keepThisChart((parses += 1));
  }
}

/**
 * Draw the Chart, showing the Blank edges if hiding them leaves nothing to
 * draw, with the reason said. A Chart that is all white space still has to
 * land on screen: the way to a tighter crop is Re-parse, which is in Review,
 * so a screen cleared of everything would clear the way out with it.
 *
 * Showing them again is the answer to that one failure, and it is tried for any
 * failure because it costs a redraw and the alternative is a knitter left with
 * no Chart. A failure it is no answer to comes back out of here and is said —
 * the parse it came from is kept either way, by the `finally` in `show`.
 */
function drawTheChart() {
  try {
    redraw();
  } catch (failure) {
    chosenView = { ...chosenView, trimmed: false };
    say(error, failure.message);
    redraw();
  }
}

/**
 * A parse is kept the moment it lands, under the name of the file it came from
 * — a knitter who reviews for ten minutes and then closes the tab has not lost
 * the parse or the ten minutes. The source image goes with it, because Review's
 * comparison and a later Re-parse both need it.
 */
async function keepThisChart(mine) {
  try {
    const id = await keep({
      name: chartName,
      image: chosen,
      chart,
      selected,
      reading,
      ...chosenView,
    });
    // A parse that landed while this one was being written owns the screen now,
    // and its Cells must not be saved into this Chart's record.
    if (mine === parses) openId = id;
    await drawLibrary();
  } catch (failure) {
    say(error, failure.message);
  }
}

/** The Row a kept Chart opens on, once the Chart it opens as is known. */
function openingRow(kept, state) {
  try {
    return rowOnOpening(kept, view(kept.chart, state));
  } catch {
    return kept.selected; // nothing but white space: this Chart opens whole anyway
  }
}

/**
 * The Chart as the knitter has it now, back onto the device: the decisions they
 * have made about it, the Row they have reached, and how they are reading it.
 * The parse itself goes back unchanged — a Repaint is a decision about it, not
 * a rewrite of it.
 * Called from `drawRow`, which is the one thing every one of those changes ends
 * with, so there is no state that can drift out of the record.
 */
async function persist() {
  if (openId === null) return;
  try {
    await remember(openId, { chart, selected, reading, ...chosenView });
  } catch (failure) {
    say(error, failure.message);
  }
}

// iOS suspends a backgrounded page and never resumes it if the knitter kills
// the app, so the fire-and-forget write `drawRow` started can die in flight.
// This is the last moment the record can be written, and one more write of what
// is already on screen costs nothing when it was not needed.
window.addEventListener("pagehide", () => persist());

/** Let go of the image a closed Chart was cropped from and compared against. */
function revokeImage() {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
}

/**
 * Every Chart on the device, and how much room is left for the next one. The
 * space is shown rather than acted on: there is no eviction policy here, so the
 * number is there for the knitter to run out of deliberately rather than
 * suddenly.
 */
async function drawLibrary() {
  try {
    const kept = await stored();
    library.hidden = !kept.length;
    keptList.replaceChildren(...kept.map(shelved));
    const left = await spaceLeft();
    say(quota, left === null ? null : `${Math.round(left / 1e6)} MB free on this device`);
  } catch (failure) {
    say(error, failure.message);
  }
}

/** Storage that failed under the knitter's finger has to say so, not do nothing. */
const fail = (failure) => say(error, failure.message);

/** One Chart on the shelf: its thumbnail and name open it, with rename and delete beside. */
function shelved({ id, name, thumbnail, ...kept }) {
  const item = document.createElement("li");
  const open = document.createElement("button");
  const picture = document.createElement("img");
  const title = document.createElement("span");
  const url = URL.createObjectURL(thumbnail);
  picture.src = url;
  picture.alt = "";
  picture.addEventListener("load", () => URL.revokeObjectURL(url));
  title.className = "title";
  title.append(name, described(kept));
  open.className = "shelved";
  open.append(picture, title);
  open.addEventListener("click", () => openChart(id).catch(fail));
  item.append(
    open,
    beside("Rename", () => renameChart(id, name)),
    beside("Delete", () => deleteChart(id, name)),
  );
  return item;
}

/**
 * The dimensions, under the name in the library. Two Re-parses of one image sit
 * side by side under names that differ only in a suffix, and the size is the
 * thing that says which crop was the better one — a Row short is exactly the
 * error a Re-parse was reached for.
 */
function described({ chart, ...kept }) {
  const detail = document.createElement("small");
  // Through the view, like everything else that counts Cells: the size in the
  // list is the Chart the knitter opens, not the one that was parsed.
  detail.textContent = isReadable(chart)
    ? sized(chart, keptView(kept))
    : "saved by a newer version of this app";
  return detail;
}

/** The size of a Chart on the shelf, or why it has none to state. */
function sized(chart, state) {
  try {
    return measured(view(chart, state));
  } catch (failure) {
    return failure.message; // all white space: the shelf says so rather than "0 rows"
  }
}

function beside(label, act) {
  const button = document.createElement("button");
  button.className = "beside";
  button.textContent = label;
  button.addEventListener("click", () => act().catch(fail));
  return button;
}

/**
 * A Chart opened from the library has already been Reviewed, and the knitter
 * opened it to knit, so it lands in Knit — at the Row they stopped on, read the
 * way they were reading it.
 */
async function openChart(id) {
  const kept = await restore(id);
  if (!kept) return drawLibrary(); // deleted in another tab
  if (!isReadable(kept.chart)) {
    // Refused, not drawn: a later schema could move Cells under these very
    // field names, and a chart read wrong is a chart knitted wrong.
    setMode(null);
    return say(
      error,
      `“${kept.name}” was saved by a newer version of this app and cannot be read here.`,
    );
  }
  say(error, null);
  say(status, null);
  parses += 1; // this Chart owns the screen now, whatever save is still in flight
  openId = id;
  chart = kept.chart;
  chosenView = keptView(kept);
  selected = openingRow(kept, chosenView);
  reading = kept.reading;
  constructionChoice.value = reading.construction;
  startChoice.value = reading.start;
  picked = null;
  // The image comes off the device with the Chart, so a Re-parse has it to hand
  // and the knitter is never sent looking for the file they uploaded.
  chosen = kept.image;
  chartName = kept.name;
  revokeImage();
  imageUrl = URL.createObjectURL(kept.image);
  source.src = reviewImage.src = imageUrl;
  // The crop step is where Re-parse goes, not where opening a Chart lands — and
  // it goes there through `cropAgain`, so both parse buttons are shut here.
  // Left live, they would parse this Chart's image with the last knitter's
  // rectangle, and keep what came back as a second Chart of the same name.
  stage.hidden = true;
  crop = null;
  rectangle.disabled = whole.disabled = true;
  drawTheChart();
  frameTheImage();
  showImage(false);
  drawFacts();
  setMode(KNIT);
}

/** A filename is what a Chart is called until the knitter says otherwise. */
async function renameChart(id, was) {
  const name = prompt("Name this chart", was)?.trim();
  if (!name || name === was) return;
  await remember(id, { name });
  await drawLibrary();
}

/** The only thing that removes a Chart — nothing here evicts one to make room. */
async function deleteChart(id, name) {
  if (!confirm(`Delete “${name}”? The chart and any corrections go with it.`)) return;
  await forget(id);
  if (openId === id) {
    openId = chart = null;
    setMode(null);
    // Unless its image is on the crop step: a Re-parse of a Chart the knitter
    // has just deleted still finishes, and blanking the image under the
    // rectangle mid-drag would be a strange way to say so.
    if (stage.hidden) revokeImage();
  }
  await drawLibrary();
}

/** Show Review, Knit, or neither. The two are navigation models, so only one is up. */
function setMode(wanted) {
  mode = chart ? wanted : null;
  const screen = screenFor(mode, chart !== null);
  review.hidden = !screen.review;
  knit.hidden = !screen.knit;
  modeSwitch.hidden = settings.hidden = !screen.chrome;
  modeSwitch.textContent = screen.switchLabel;
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
  size.textContent = measured(shown);
  paletteSize.textContent = paletteWords(shown.palette.length);
  paletteList.replaceChildren(
    ...shown.palette.map((colour, entry) => pickable(colour, entry, arm)),
  );
  chipPalette.replaceChildren(
    ...shown.palette.map((colour, entry) => pickable(colour, entry, paintRun)),
  );
  doubt.hidden = !cropIsDoubtful(chart);
  drawTrim();
  drawSeparations();
  showArmed();
}

/**
 * The answers the parse offered for how many colours this Chart has, labelled by
 * the count the knitter can hold against the yarns on the table, with the one
 * being read marked. The count above moves as they switch, and that movement is
 * the whole loop: they stop when it matches what they can see.
 *
 * Hidden when the parse offered one answer — which is every Chart parsed before
 * Separations existed — because a list of one is a control that does nothing.
 * Review only: switching rewrites every Readout in the Chart, and a knitter mid
 * Row must not have the instructions change under them.
 */
function drawSeparations() {
  const { hidden, labels, marked } = separationChoices(chart, shown);
  separationChoice.hidden = hidden;
  const buttons = () => [...separationList.querySelectorAll("button")];
  // Built again only when the answers themselves changed, which means another
  // Chart. Replacing the button the knitter just tapped takes the focus off it,
  // and someone walking the list by keyboard or screen reader — comparing counts
  // is the whole point of it — would be dropped out of the list at every tap.
  if (buttons().map((button) => button.textContent).join() !== labels.join())
    separationList.replaceChildren(...labels.map(choosable));
  for (const [at, button] of buttons().entries())
    button.setAttribute("aria-pressed", String(at === marked));
}

/** One answer: the colour count, tappable, marked when it is the one on screen. */
function choosable(label, at) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", () => adopt({ ...chosenView, separation: at }));
  item.append(button);
  return item;
}

/**
 * Take up a decision about how this Chart is read — which Separation, or whether
 * the Blank edges are hidden. No parse and no wait: the Chart is derived from
 * the one already on the device. A decision that would leave nothing to draw is
 * refused with the reason and nothing changes, because a Chart cannot go off the
 * screen under the knitter's finger.
 */
function adopt(wanted) {
  let next;
  try {
    next = view(chart, wanted);
  } catch (failure) {
    return say(error, failure.message);
  }
  selected = rowAfterAdopting(selected, shown, next);
  // An entry of a Palette that is about to be shorter is armed at nothing.
  if (picked !== null && picked >= next.palette.length) picked = null;
  const resized = rowCount(next) !== rowCount(shown) || colCount(next) !== colCount(shown);
  chosenView = wanted;
  say(error, null);
  redraw(); // before the frame: the window is cut to the size of the Chart being read
  frameTheImage();
  drawFacts();
  // A Chart of another size is another survey; one of the same size is the same
  // Chart in other colours, and throwing the knitter's zoom away mid-comparison
  // is the opposite of instant.
  if (resized) resetView();
}

/** What the crop caught beyond the pattern, and the way to have it back. */
function drawTrim() {
  const said = blankWords(shown);
  trim.hidden = said.hidden;
  trimWords.textContent = said.words;
  showBlanks.textContent = said.control;
}

// Hiding is a default and not a rule: the knitter whose pattern has a white edge
// Row shows it again here, and that decision is kept with the Chart.
showBlanks.addEventListener("click", () =>
  adopt({ ...chosenView, trimmed: !chosenView.trimmed }),
);

/**
 * One Palette entry: the count of entries the eye catches rather than reads, and
 * the handle both Repaints hang off — armed in Review, tapped under a chip in Knit.
 */
function pickable(colour, entry, choose) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.className = "swatch";
  button.style.background = rgb(colour.rgb);
  button.title = entryLabel(shown, entry);
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
      : `Painting ${entryLabel(shown, picked)} — tap a cell, or drag across several. ` +
        "Tap the colour again to pan instead.";
}

compare.addEventListener("click", () => showImage(cropped.hidden));

// A Chart that came back the wrong size cannot be Repainted right — the crop
// caught a number gutter, or missed a Row — so it is drawn again on the image
// this Chart was parsed from and parsed again. What comes back is a *new* Chart
// beside this one: re-gridding changes which Cell is which and discards every
// Repaint, and one tap must not be able to destroy twenty minutes of them. Both
// stay in the library until the knitter has seen which crop was better.
reparse.addEventListener("click", () => {
  const [x, y, w, h] = chart.source.crop;
  cropAgain(chosen, reparsed(chartName), { x, y, w, h });
});

// Starting over is the same path from a blank rectangle, for a parse so wrong
// there is nothing in the old crop worth adjusting.
startOver.addEventListener("click", () => cropAgain(chosen, reparsed(chartName), null));

/**
 * Two crops of one image are two Charts, so they are two names in the library —
 * and a fourth crop is a fourth name, so the suffix stacks rather than being
 * added once. It is ugly and it is honest: three of these in the library are
 * three attempts, and renaming is a tap away for the one that turned out right.
 */
const reparsed = (name) => name + REPARSED;

/**
 * The Chart, or the image it was parsed from — shown through a window the shape
 * of the crop, so the two are the same picture of the same thing and the toggle
 * is a comparison rather than two views. Deskew is not undone: `skew_deg` is a
 * fraction of a degree on the corpus, which is nothing at a Chart's scale.
 */
function frameTheImage() {
  const [x, y, w, h] = chart.source.crop;
  // The window frames the part of the crop the Chart is read from, which with
  // Blank edges hidden is inside the rectangle the knitter drew — otherwise the
  // comparison would put the image's white margin against the Chart's Row 1.
  const { top, bottom, left, right } = shown.trimmed ? shown.blank : NOTHING_HIDDEN;
  const cellWide = w / (colCount(shown) + left + right);
  const cellTall = h / (rowCount(shown) + top + bottom);
  const framed = { x: x + left * cellWide, y: y + top * cellTall, w: w - (left + right) * cellWide };
  const zoom = chart.source.image_width / framed.w; // the frame, whatever its size, fills the window
  cropped.style.aspectRatio = `${colCount(shown)} / ${rowCount(shown)}`;
  reviewImage.style.width = `${zoom * 100}%`;
  // percentage margins resolve against the window's width, which is the frame's width
  reviewImage.style.marginLeft = `${(-framed.x * 100) / framed.w}%`;
  reviewImage.style.marginTop = `${(-framed.y * 100) / framed.w}%`;
}

const NOTHING_HIDDEN = { top: 0, bottom: 0, left: 0, right: 0 };

/** Swap the two, leaving the pan and zoom where the knitter put them. */
function showImage(wanted) {
  cropped.hidden = !wanted;
  reviewChart.hidden = wanted;
  compare.textContent = wanted ? "Show the chart" : "Show the image";
  applyView();
}

/** The Selected Row: where it sits, its colour bands, and its Readout. */
function drawRow() {
  const rows = rowCount(shown);
  const direction = readingDirection(reading, selected);
  const runs = runsOfRow(shown, selected, direction);
  const stitches = runs.reduce((total, run) => total + run.count, 0);

  marker.style.top = `${(rowIndex(shown, selected) * 100) / rows}%`;
  marker.style.height = `${100 / rows}%`;
  drawCells(band, [cellsOfRow(shown, selected)]);

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
  persist();
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
  swatch.style.background = rgb(shown.palette[run.entry].rgb);
  button.append(swatch, `${run.count} ${entryLabel(shown, run.entry)}`);
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
  chosenView = repaint(chart, chosenView, { row: selected, from: at, to: at + count - 1 }, entry);
  redraw();
}

/**
 * Every view of the Cells, after a decision about the Chart has changed. The
 * Chart on screen is derived here and nowhere else, so nothing draws the parse
 * as it arrived.
 */
function redraw() {
  shown = view(chart, chosenView);
  // Showing the Blank edges again makes the Chart taller and hiding them makes
  // it shorter, so the Row the knitter is on may no longer exist.
  selected = Math.min(selected, rowCount(shown));
  drawCells(reviewChart, shown.cells);
  drawCells(wholeChart, shown.cells);
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
      context.fillStyle = rgb(shown.palette[cell].rgb);
      context.fillRect(c, r, 1, 1);
    }),
  );
}

/** One array Row's Cells, over whatever was drawn there before. */
function drawRowOfCells(canvas, index) {
  const context = canvas.getContext("2d");
  shown.cells[index].forEach((cell, c) => {
    context.clearRect(c, index, 1, 1); // Non-stitch is transparent, so painting over is not enough
    if (cell < 0) return;
    context.fillStyle = rgb(shown.palette[cell].rgb);
    context.fillRect(c, index, 1, 1);
  });
}

const rgb = ([red, green, blue]) => `rgb(${red} ${green} ${blue})`;

for (const [button, step] of [
  [next, 1],
  [previous, -1],
]) {
  button.addEventListener("click", () => {
    selected = Math.min(Math.max(selected + step, 1), rowCount(shown));
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
  stopPainting();
  if (armedToPaint() && touching.size === 1 && over(reviewChart, event)) {
    const { row, col } = cellAt(reviewChart, event);
    painting = { pointer: event.pointerId, row, from: col, base: chosenView };
    paintTo(col);
  }
});

viewport.addEventListener("pointermove", (event) => {
  if (painting?.pointer === event.pointerId) return paintTo(cellAt(reviewChart, event).col);
  if (!touching.has(event.pointerId)) return;
  touching.set(event.pointerId, event);
  const now = gripNow();
  const pinched = grip.spread && now.spread ? now.spread / grip.spread : 1;
  const scale = Math.min(Math.max(camera.scale * pinched, fitsWhole()), MAX_ZOOM);
  const grew = scale / camera.scale;
  camera = {
    scale,
    x: now.x - grew * (grip.x - camera.x),
    y: now.y - grew * (grip.y - camera.y),
  };
  grip = now;
  applyView();
});

for (const finished of ["pointerup", "pointercancel"]) {
  viewport.addEventListener(finished, (event) => {
    if (painting?.pointer === event.pointerId) stopPainting();
    touching.delete(event.pointerId);
    grip = gripNow(); // lifting one finger of a pinch must not throw the Chart across the screen
  });
}

/**
 * End a paint drag, however it ended — the finger lifted, or a second finger
 * turned it into a pinch. The drag only kept the one Row in front of the knitter
 * up to date, so everything else catches up here: the other canvases, the
 * Readout, and the record on the device. A paint that ended without this is a
 * correction the knitter made and the device never heard about.
 */
function stopPainting() {
  if (!painting) return;
  painting = null;
  redraw();
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
  const rows = rowCount(shown);
  const cols = colCount(shown);
  const at = (fraction, count) => Math.min(Math.max(Math.floor(fraction * count), 0), count - 1);
  return {
    row: rowNumber(shown, at((event.clientY - box.top) / box.height, rows)),
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
  const span = { row: painting.row, from: painting.from, to: col };
  // The Chart on screen, handed back: it is the same bounds and the same Blank
  // edges as a view of `painting.base`, and deriving a second one per pointer
  // move is exactly the cost this function is written to avoid.
  chosenView = repaint(chart, painting.base, span, picked, shown);
  shown = view(chart, chosenView);
  drawRowOfCells(reviewChart, rowIndex(shown, painting.row));
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
  camera = { scale: fitsWhole(), x: 0, y: 0 };
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
  camera.x = middleOr(width, camera.scale * width, camera.x);
  camera.y = middleOr(height, camera.scale * pannable.offsetHeight, camera.y);
  pannable.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
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

// Asked before the first Chart is written rather than after one has been
// evicted: a browser that clears storage under pressure does it without asking.
askToKeep();
drawLibrary();

// Said once, on load: the shell the page was served from is the shell it stays
// on until the knitter takes an update and the page reloads onto the new one.
version.textContent = versionWords(VERSION);

// The shell, onto the device, so the app opens where the knitting happens. A
// registration that fails — an old browser, or the page opened over file:// —
// costs the offline case and nothing else, so the app carries on without it.
navigator.serviceWorker?.register("/sw.js").then(watchForNewShell).catch(() => {});

/**
 * A released shell installs beside the running one and then waits for every tab
 * of the app to close — which, on the phone this app is installed to, is never.
 * Reloading does not do it either: the page comes back under the worker it left.
 * So the knitter is told there is a new version and picks the moment, and the
 * worker is only let past when the page is already on its way to reloading onto
 * it. Nothing swaps underneath a knitter mid-row.
 */
function watchForNewShell(registration) {
  const offer = () => {
    const said = updateOffer({
      waiting: Boolean(registration.waiting),
      running: Boolean(navigator.serviceWorker.controller),
    });
    update.hidden = said.hidden;
    updateWords.textContent = said.words;
    applyUpdate.textContent = said.control;
  };

  offer(); // one that installed while the app was closed is already waiting here
  registration.addEventListener("updatefound", () =>
    registration.installing?.addEventListener("statechange", offer),
  );

  // A browser checks for a new worker on navigation, and the home screen is a
  // place an app is resumed rather than navigated to. Coming back to it is the
  // moment to ask.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) registration.update().catch(() => {});
  });

  // The worker took over, so the page is being served the old shell against a
  // new cache — the one state the cache-first rule cannot survive. Reload into it.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  applyUpdate.addEventListener("click", () => registration.waiting?.postMessage("take over"));
}
