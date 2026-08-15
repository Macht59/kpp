# 01 — Tests on every change

**What to build:** A GitHub Actions workflow that runs both suites on every pull
request and every push to `master`, and proves the image still builds without
pushing it.

There are two suites and they are not alike. `pytest tests/` covers the parser
and the endpoint, and it now runs against the corpus for real — the four chart
screenshots have been in git since `52577ed`, so nothing skips and nothing needs
a fixture download. `node --test web/*.test.js` covers the client's pure logic.
Python is `3.14`, floating patch, matching the image; Node is whatever the
runner's current LTS is, because nothing shipped depends on it.

The `docker build` in this job pushes nothing. Its whole purpose is that a
Dockerfile broken by a base-image change fails on the pull request that broke it
rather than at release time, when the version has already been cut.

**Blocked by:** nothing.

**Status:** resolved

- [x] `.github/workflows/ci.yml` runs on pull requests and pushes to `master`
- [x] `pytest tests/` runs on Python 3.14 and the corpus tests do not skip
- [x] `node --test web/*.test.js` runs
- [x] The image is built and not pushed
- [x] The workflow needs no secrets beyond `GITHUB_TOKEN`

## Comments

**Built.** One workflow, `.github/workflows/ci.yml`, with the `test` job on both
triggers. `pytest tests/` and `npm test` were run locally on Python 3.14 and Node
26 before the workflow was written: 73 pytest, 26 node, nothing skipped — the
corpus is in git, so the four chart screenshots are parsed for real.

The `docker build` step passes `APP_VERSION=ci` so the build path CI exercises is
the same one the release uses, minus the push.

Not yet observed on GitHub's runners: the workflow has never run, because the
branch has not been pushed. Everything it does was run by hand here first.
