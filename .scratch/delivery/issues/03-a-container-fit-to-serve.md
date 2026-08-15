# 03 — A container fit to serve

**What to build:** The image as it stands runs Flask's development server, on
Python 3.12, carrying the whole repository including the 5.7 MB test corpus, and
serving a service worker whose cache name is bumped by hand.

Four changes, each with its own reason.

**gunicorn.** `app.run` is single-threaded, and a parse is seconds of scipy. One
knitter uploading a 20 MB scan makes the app unreachable to the next request —
and this app's entire offline story rests on a knitter being able to tell "no
connection" from "the app is thinking". Two workers, `--timeout 120`, because a
1880×1014 scan is not a thirty-second request.

**Python 3.14.** The image and CI test the same interpreter, floating on the
patch so a rebuild picks up fixes. Note that `3.14-slim` moves the base to
Debian trixie: the existing apt line (`libjpeg62-turbo`, `libtiff6`,
`libopenjp2-7`, `zlib1g`) has to be verified against trixie rather than assumed
to have carried over from bookworm.

**A `.dockerignore`.** `COPY . .` currently ships `tests/examples/`, `.scratch/`,
`prototype/`, `docs/` and `.git`. None of it is served and the corpus alone is
5.7 MB.

**The service worker's cache name, stamped at build.** `web/sw.js` holds
`const VERSION = "kpp-shell-1"`, bumped by hand when a shell file changes. A
release that changes the client and forgets the bump hands a knitter a stale
`app.js` — the exact failure the worker's cache-first rule exists to prevent. So
the Docker build takes `ARG APP_VERSION` and rewrites that line, and the release
version becomes the cache name. The checkout is untouched: `python server.py`
locally still serves the placeholder, and there is still no build step for
development. The cost, accepted: every release drops every knitter's cached
shell, including releases that changed only Python.

**Blocked by:** nothing.

**Status:** resolved

- [x] `gunicorn` is in `requirements.txt` and is the image's `CMD`, 2 workers, 120s timeout
- [x] The base image is `python:3.14-slim` and the apt package names are verified against it
- [x] `.dockerignore` keeps the corpus, `.scratch/`, `prototype/`, `docs/` and `.git` out of the image
- [x] `ARG APP_VERSION` stamps `web/sw.js`'s cache name; the working tree is not modified
- [x] `python server.py` still works locally with no build step

## Comments

**Built and run.** `python:3.14-slim` is Debian trixie, and the existing apt line
carried over unchanged — `libjpeg62-turbo`, `libtiff6`, `libopenjp2-7`, `zlib1g`
all resolve there, which was the one assumption in this ticket that could not be
reasoned about. The image builds and serves: `GET /` returns 200 under two
gunicorn workers, and `POST /api/parse` with no upload returns the endpoint's own
400.

`web/sw.js` now holds `kpp-shell-dev` as the literal, and the build rewrites the
whole quoted string rather than a number, so the placeholder cannot drift into a
version-shaped lie locally. Verified inside the image: `const VERSION =
"kpp-shell-0.1.0"` after a build with `--build-arg APP_VERSION=0.1.0`.

The image is 443 MB, nearly all of it scipy and scikit-image. `.dockerignore`
keeps the 5.7 MB corpus, `.scratch/`, `docs/`, `prototype/` and `.git` out; the
remaining size is the parser's dependency tree and is not worth a multi-stage
build to shave.
