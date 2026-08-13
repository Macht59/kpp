// Pick an image, parse the whole of it, see the Chart. One path, end to end.
// Cropping, Review and Knit arrive in later tickets; this is the tracer bullet.

const PARSE_TIMEOUT_MS = 30_000; // against a measured ~10 s parse
const MAX_CANVAS_PX = 1200; // a 112-Cell Chart is legible long before this

const file = document.getElementById("file");
const source = document.getElementById("source");
const whole = document.getElementById("whole");
const status = document.getElementById("status");
const error = document.getElementById("error");
const canvas = document.getElementById("chart");

let chosen = null;

file.addEventListener("change", () => {
  chosen = file.files[0] ?? null;
  say(status, null);
  say(error, null);
  canvas.hidden = true;
  source.hidden = !chosen;
  whole.disabled = !chosen;
  if (chosen) source.src = URL.createObjectURL(chosen);
});

whole.addEventListener("click", async () => {
  whole.disabled = true;
  say(error, null);
  say(status, "Parsing… this takes a few seconds.");
  try {
    drawChart(canvas, await parse(chosen, [0, 0, source.naturalWidth, source.naturalHeight]));
    canvas.hidden = false;
    say(status, null);
  } catch (failure) {
    say(status, null);
    say(error, failure.message);
  } finally {
    whole.disabled = false;
  }
});

/** POST the image and the crop; give up after PARSE_TIMEOUT_MS. */
async function parse(image, [x, y, w, h]) {
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

/** Draw the Chart at whatever whole number of px per Cell fits. */
function drawChart(canvas, chart) {
  const { rows, cols } = chart.dimensions;
  const size = Math.max(1, Math.floor(Math.min(MAX_CANVAS_PX / cols, MAX_CANVAS_PX / rows)));
  canvas.width = cols * size;
  canvas.height = rows * size;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  chart.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell < 0) return; // Non-stitch is background, not yarn: leave it transparent
      const [red, green, blue] = chart.palette[cell].rgb;
      context.fillStyle = `rgb(${red} ${green} ${blue})`;
      context.fillRect(c * size, r * size, size, size);
    }),
  );
}

function say(element, message) {
  element.textContent = message ?? "";
  element.hidden = !message;
}
