// The Chart library: Charts and the images they were parsed from, kept on the
// device. Storage is all this module does — no Chart logic, no UI.
//
// Silent eviction of a corrected Chart is the worst failure this app can have,
// so persistence is asked for explicitly, the space left is reportable, and a
// full device raises rather than resolves. Nothing here evicts anything; the
// knitter deletes a Chart.

const DATABASE = "kpp";
const CHARTS = "charts";
const IMAGES = "images";
const THUMBNAIL_PX = 160; // a list row at two device pixels per CSS pixel

const FULL =
  "This device is out of storage. Delete a chart to make room — nothing was deleted for you.";

let opening = null;

/**
 * Two stores, not one: the source image is megabytes and the Chart record is
 * rewritten every time the knitter advances a Row, so advancing must not carry
 * the image along with it.
 */
function database() {
  return (opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(CHARTS, { keyPath: "id", autoIncrement: true });
      request.result.createObjectStore(IMAGES);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

/**
 * One transaction over the named stores. `work` fires its requests and returns
 * them; they are only read once the transaction has committed, so a failure
 * part way through leaves nothing half-written.
 */
async function run(stores, mode, work) {
  const transaction = (await database()).transaction(stores, mode);
  const requests = work(...stores.map((store) => transaction.objectStore(store)));
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(requests);
    transaction.onabort = () => reject(readable(transaction.error));
  });
}

/** A full device is the one storage failure the knitter can act on, so it says so. */
const readable = (failure) =>
  failure?.name === "QuotaExceededError"
    ? new Error(FULL)
    : (failure ?? new Error("Saving failed."));

/** Ask the browser not to evict. Asked once, before the first Chart is written. */
export const askToKeep = () => navigator.storage?.persist?.() ?? Promise.resolve(false);

/**
 * Bytes the browser says are left, for the knitter to see before they run out —
 * or null where it will not say. Null rather than zero: telling a knitter with a
 * half-empty phone that they have no room left is the same lie as telling a full
 * one that they have plenty.
 */
export async function spaceLeft() {
  const estimate = await navigator.storage?.estimate?.();
  return estimate ? Math.max((estimate.quota ?? 0) - (estimate.usage ?? 0), 0) : null;
}

/** Keep a parsed Chart and the image it came from, under the uploaded filename. */
export async function keep({ image, ...record }) {
  const thumbnail = await thumbnailOf(image);
  const { added } = await run([CHARTS, IMAGES], "readwrite", (charts, images) => {
    const added = charts.add({ ...record, thumbnail });
    added.onsuccess = () => images.put(image, added.result);
    return { added };
  });
  return added.result;
}

/** Write back what changes as the knitter works: the Cells, the cursor, the name. */
export async function remember(id, fields) {
  await run([CHARTS], "readwrite", (charts) => {
    const found = charts.get(id);
    // A Chart deleted while it was open must stay deleted, not be written back.
    found.onsuccess = () => found.result && charts.put({ ...found.result, ...fields });
    return found;
  });
}

/**
 * Every Chart on the device, most recent first, for the list — with the Chart
 * itself, because the list states its dimensions.
 * `ponytail:` reads whole records to list them — split the Cells out if a
 * library of many large Charts ever makes opening the list slow.
 */
export async function stored() {
  const all = await run([CHARTS], "readonly", (charts) => charts.getAll());
  return all.result
    .map(({ id, name, thumbnail, chart, separation, trimmed, overlay, merges, scale }) => ({
      id,
      name,
      thumbnail,
      chart,
      // the knitter's decisions come along, because the list states the size of
      // the Chart they are reading rather than the one that was parsed
      separation,
      trimmed,
      overlay,
      merges,
      scale,
    }))
    .reverse();
}

/** One Chart with its source image, or undefined if it is no longer there. */
export async function restore(id) {
  const { found, image } = await run([CHARTS, IMAGES], "readonly", (charts, images) => ({
    found: charts.get(id),
    image: images.get(id),
  }));
  return found.result && { ...found.result, image: image.result };
}

/** The only way a Chart leaves the device. */
export function forget(id) {
  return run([CHARTS, IMAGES], "readwrite", (charts, images) => {
    charts.delete(id);
    images.delete(id);
  });
}

/** A small copy for the list, so finding a Chart by sight does not decode megabytes. */
async function thumbnailOf(image) {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(THUMBNAIL_PX / bitmap.width, THUMBNAIL_PX / bitmap.height, 1);
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
}
