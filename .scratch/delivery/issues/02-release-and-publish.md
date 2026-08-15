# 02 — Release the version and publish the image

**What to build:** On `master`, after the tests pass, semantic-release reads the
commits since the last tag and decides whether there is a release. If there is,
it tags it and writes the notes onto a GitHub Release. If there is not — a
`docs` or `chore` push — nothing else in this ticket happens at all.

semantic-release is a pinned devDependency with a committed lockfile, run as
`npm ci && npx semantic-release`. The plugin set is `commit-analyzer`,
`release-notes-generator` and `github`, and nothing else: there is no npm
package to publish, and no `CHANGELOG.md`, because the notes live on the
Release. `package.json` carries `"version": "0.0.0-development"` and never has it
written back — the version lives in the git tag.

The first release is `0.1.0`, which takes one piece of setup: semantic-release
calls a first release `1.0.0` and offers no setting to say otherwise, so a
`v0.0.0` tag is placed by hand on `aba0534`. Everything after it is computed
normally, and the first `feat` becomes `0.1.0`.

The image job is gated on `new_release_published` and builds from the same
commit, tagging `X.Y.Z` and `latest`. There is no SHA tag: the version is now a
git tag, and a second name for the same image is a second thing to reconcile.
`latest` is not semver and nothing automated reads it — it is there so that a
pull without a tag gets the newest release.

`package.json` also gains `"test": "node --test web/*.test.js"`, so the web
suite has a name rather than a command that lives only in CI and the README.

That `package.json` exists at all contradicts [ADR-0004](../../../docs/adr/0004-vanilla-canvas-pwa-client.md)
as written. The ADR is amended by this work rather than ignored: no build step,
still; a release-time and test-time manifest, now.

**Blocked by:** 01 — Tests on every change.

**Status:** resolved

- [x] `package.json` and `package-lock.json` are committed, with semantic-release pinned
- [x] `.releaserc.json` runs on `master` with `commit-analyzer`, `release-notes-generator`, `github`
- [x] A `feat` on `master` cuts a minor version and a GitHub Release; a `docs` cuts nothing
- [x] The image is pushed to `ghcr.io/macht59/kpp` as `X.Y.Z` and `latest`, only when a release was cut
- [x] No `CHANGELOG.md` is committed
- [x] `npm test` runs the web suite

## Comments

**Built.** `semantic-release` 25.0.9 pinned in `package.json` with a committed
`package-lock.json`, and `.releaserc.json` naming exactly three plugins. The npm
plugin is absent, so nothing is published to a registry and `package.json`'s
version is never rewritten.

The release job reports what it did through the tag, not through a plugin: it
records the newest `v*` tag before and after `npx semantic-release` and sets
`published`/`version` outputs from the difference. That avoids adding
`@semantic-release/exec` purely to echo a value into `$GITHUB_OUTPUT`.

A `v0.0.0` seed tag was placed on `aba0534`, because semantic-release starts a
tagless repository at `1.0.0` and has no setting for it. The first `feat` on
`master` therefore computes `0.1.0`.

Unproven until the first push: that the release actually cuts, and that
`GITHUB_TOKEN` can create the GHCR package on first use.
