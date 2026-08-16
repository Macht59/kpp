# 09 — Install and work offline

**What to build:** A knitter works with the phone propped up beside them — on a
train, in a chair, away from wifi. The app opens from the home screen like an
app, and every Chart they have already parsed is fully usable with no
connection: Select a Row, read it, advance, and Repaint a Cell they spot is
wrong.

Parsing is the one thing that needs the network, and it says so plainly rather
than failing obscurely. The parse happens once per Chart, at a table, on wifi;
the knitting session is the offline case, and it is read-plus-Repaint.

No background-sync queue to retry an offline upload later — that is
infrastructure for a once-per-Chart operation.

A PWA rather than a native app is the deliberate choice recorded in
[ADR-0004](../../../docs/adr/0004-vanilla-canvas-pwa-client.md): home-screen
install and offline are the two things that actually matter to a knitter, and
both come without an engine download or a second toolchain.

**Blocked by:** 07 — The Chart library on the device.

**Status:** resolved

- [x] The app can be installed to the home screen and opens without browser chrome
- [x] The app shell loads with no connection
- [x] A stored Chart can be Selected, read, advanced through and Repainted offline
- [x] Attempting to parse with no connection gives a plain message saying parsing needs one
- [x] No background-sync queue
- [x] A released shell reaches a knitter who already has the app, without them
      closing every tab of it

## Comments

**Built.** A web app manifest, a 512 px icon, and a service worker that
precaches the shell — `index.html` under `/`, the four modules, the manifest and
the icon. Nothing else is fetched: the styles are inline and the only font is
`system-ui`. Stored Charts were already offline, since they live in IndexedDB,
so this ticket is only about the code that reads them loading without a
connection.

Cache-first rather than revalidating, because nothing here is versioned in its
filename and a fresh `index.html` against a stale `app.js` is the failure that
would cause. For the same reason the worker does not call `skipWaiting` or
`clients.claim` on its own: activating a new `VERSION` drops the cache the open
page is being served from, and claiming a page mid-knit is the mismatched shell
the cache-first rule exists to prevent.

**"A new shell is picked up the next time the app is opened" was wrong**, and
this ticket said it for two releases. A waiting worker activates when the last
client of its scope goes away, and reloading is not that — the page comes back
under the worker it left. On a phone with the app on the home screen, nothing
ever closes every client, so 0.2.0 sat installed and waiting behind 0.1.0
indefinitely. The only way to the new app was a browser with no registration at
all, which is why it looked correct in incognito and stale everywhere else.

Reproduced in a browser before it was fixed: install v1, ship v2, reload three
times — `caches` holds both versions, `registration.waiting` stays `installed`,
and the page keeps serving v1. Close every tab and v2 activates.

The fix leaves the invariant alone and gives the knitter the tie-break. The
worker calls `skipWaiting` only on a `"take over"` message; the page watches for
a waiting worker, says so, and sends that message when the knitter taps **Reload
to update** — then reloads on `controllerchange`, so the swap lands on a page
already on its way out rather than under a knitter mid-row. `registration.update()`
runs when the app becomes visible, because an installed app is resumed rather
than navigated to and a navigation is the only moment a browser checks by itself.
The offer is silent on a first install, where the waiting worker is the only one
there has ever been.

`POST /api/parse` falls through to the network untouched — the worker answers
GETs on this origin and nothing else — and there is no queue behind it. Offline,
the message is said before the upload rather than after a 30-second timeout, and
it names the way out: charts already parsed need nothing. A network failure
while the device says it is online keeps its own message, because sending a
knitter to check a connection they have is sending them to fix the wrong thing.

The icon is a PNG rather than the SVG first written: iOS ignores an SVG
`apple-touch-icon` and puts a screenshot of the page on the home screen, which
is precisely the phone this ticket is about.

**A third test seam, deliberately.** The spec names two — the endpoint and the
chart logic — and this adds `tests/test_app_shell.py`, which reads the worker's
precache list and fetches every entry. The justification is that one 404 in that
list makes `cache.addAll` reject, the worker never installs, and the app is
silently online-only: the single PWA failure that cannot be seen by opening the
app on a desk with wifi. It asserts against the client's own module list too, so
a module added and not precached fails here rather than on a train. Nothing else
about the worker is tested — offline behaviour needs a browser, which the spec
puts out of scope.

Both suites pass: 26 Node, 73 pytest.
