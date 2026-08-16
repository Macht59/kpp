// The app shell, kept on the device so the app opens on a train. Every stored
// Chart is already offline — it lives in IndexedDB — so this worker only has to
// make sure the code that reads it loads without a connection.
//
// Parsing is the one thing that needs the network. It is a POST, so it falls
// straight through to the network and fails as itself; there is no background
// sync queue behind it, which would be infrastructure for something a knitter
// does once per Chart, at a table, on wifi.

// Stamped with the release version at image build (see the Dockerfile), so every
// release drops the old cache. `dev` is what local development and the tests
// see. `version.js` holds the same declaration, in the same form, for the page
// to show the knitter; one command stamps both files, so keep the shape of this
// line if it ever moves.
const VERSION = "dev";
const CACHE = `kpp-shell-${VERSION}`;

const SHELL = ["/", "/app.js", "/chart.js", "/crop.js", "/library.js", "/screen.js", "/version.js", "/manifest.webmanifest", "/icon.png"];

// Cache-first, so a shell file changed on the server is only picked up by the
// next VERSION. Nothing here is versioned in its filename, so a stale app.js
// against a fresh index.html is the failure a revalidating fetch would risk.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

// Nothing here calls `skipWaiting` on its own, and nothing calls `clients.claim`:
// a new VERSION drops the cache the open page is being served from, and taking
// over that page unasked is exactly the mismatched shell the cache-first rule
// above exists to prevent. So the new worker installs beside the running one and
// waits — and waits for every tab of the app to be closed, which no knitter with
// the app on their home screen ever does. The page is what breaks the tie: it
// sees the waiting worker, offers the knitter the reload, and sends this message
// when they take it. `skipWaiting` under a page that is on its way to reloading
// anyway swaps no code underneath anybody.
self.addEventListener("message", (event) => {
  if (event.data === "take over") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map(caches.delete, caches)),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // The parse endpoint is never the cache's business — it is a POST, and the
  // only one there is — and neither is anything off this origin. What is left
  // is the shell.
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  // Installed to the home screen, the app is entered at whatever URL the icon
  // holds, so a navigation is answered with the one page there is.
  const wanted = request.mode === "navigate" ? "/" : request;
  event.respondWith(caches.match(wanted).then((cached) => cached ?? fetch(request)));
});
