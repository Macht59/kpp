# Delivery — v1 spec

Status: ready-for-agent
Feature: delivery
Collapsed from: a `/grill-with-docs` session (eight rounds, frontier empty)

Constrained by [ADR-0004](../../docs/adr/0004-vanilla-canvas-pwa-client.md),
which this work amends, and recorded as
[ADR-0005](../../docs/adr/0005-delivery-releases-images-and-flux.md).
Vocabulary is `CONTEXT.md`; nothing here adds to it, because none of this is
knitting language.

## Problem Statement

The app works and has no way to reach a knitter. `python server.py` serves it on
a laptop; a Dockerfile landed in `aba0534` that nothing else in the repo knows
about; and `kpp.istarhorse.com` currently resolves to a hand-written `Endpoints`
object in the `../home-lab` repo pointing at `192.168.30.118:8004` — a box
outside the cluster that no repo describes.

So there is no path from a commit to a running app. Tests are run by hand, the
image is built by hand if at all, the version is whatever the box happens to be
running, and the four other apps in the fleet are deployed by a mechanism this
one does not use.

## Solution

A commit to `master` that carries a `feat` or `fix` cuts a version, publishes an
image, and moves the running app to it, with no keystroke in between.

GitHub Actions runs the tests on every pull request and every push to `master`.
On `master`, semantic-release reads the conventional-commit history, decides
whether there is a release, and if there is, tags it and writes the notes onto a
GitHub Release. Only then is the image built and pushed to
`ghcr.io/macht59/kpp`, and only after that push succeeds does CI commit the new
tag into `deploy/prod/deployment.yaml`. Flux, reconciling this repo every
minute, sees the commit and rolls the Deployment.

The manifests are split: everything host-free lives here, in `deploy/prod/`, and
the `Ingress` that names `kpp.istarhorse.com` lives in the private `../gitops`
repo alongside every other app in the fleet. The public repo never states where
the app is hosted.

The cutover retires the external endpoint: `../home-lab` loses `deploy/kpp.yaml`
and its entry in the shared `Certificate`, and the app moves into the
`istarhorse-prod` namespace where the rest of the fleet lives.

## User Stories

**Releasing**

1. As the maintainer, I want the tests to run on every pull request, so that a break is visible before it is on `master`.
2. As the maintainer, I want a `feat` commit on `master` to cut a minor version by itself, so that releasing is not a thing I remember to do.
3. As the maintainer, I want a `docs` or `chore` commit to cut no version, so that the version means something.
4. As the maintainer, I want the release notes written from the commits, so that there is a changelog without a changelog file.
5. As the maintainer, I want the image tagged with the version and `latest`, so that a pull without a tag gets the newest release rather than the newest commit.
6. As the maintainer, I want the image pushed only for a release, so that the registry holds versions rather than commits.

**Deploying**

7. As the maintainer, I want the deployed tag to move by itself after a release, so that deploying is not a second thing I remember to do.
8. As the maintainer, I want the tag written to git only after the image is in the registry, so that Flux never pulls an image that does not exist yet.
9. As the maintainer, I want the manifests in this repo to be host-free, so that a public repo does not advertise where I host.
10. As the maintainer, I want the app in `istarhorse-prod` behind the same Traefik and the same cert-manager `Certificate` as the rest of the fleet, so that it is not a special case.
11. As the maintainer, I want to be the one who pushes the gitops and home-lab commits, so that nothing reconciles into my cluster without my keystroke.

**Running**

12. As a knitter, I want a parse in flight not to make the app look dead to the next request, so that the offline message means offline.
13. As a knitter, I want a new release to hand me the new app rather than a cached shell of the old one, so that a fix I am waiting on actually arrives.
14. As the maintainer, I want a parse that runs out of memory to be a limit I can raise in one line, so that the failure is legible.

## Out of Scope

- **Staging.** One environment. A stateless parser with no secrets and no schema has nothing to rehearse.
- **Flux image automation.** The two controllers are not installed in the cluster and are not being installed; CI moves the tag instead. See ADR-0005.
- **Multi-architecture images.** `amd64` only.
- **A `CHANGELOG.md`.** The notes live on the GitHub Release.
- **Commit-message linting.** A mistyped type costs a changelog line, not a deploy.
- **Retiring `192.168.30.118:8004`.** Nothing in any of the three repos describes what runs there.

## Decisions

| Decision | Choice |
| --- | --- |
| Registry | `ghcr.io/macht59/kpp`, public, no pull secret |
| Release tool | semantic-release, pinned devDependency, `npm ci && npx semantic-release` |
| First version | `0.1.0`, via a hand-placed `v0.0.0` seed tag (semantic-release would otherwise start at `1.0.0`) |
| Image tags | `X.Y.Z` and `latest`, on release only |
| Triggers | tests on pull requests and `master`; release and image on `master` |
| Python | `3.14`, floating patch, in CI and in the image |
| Architectures | `amd64` |
| WSGI server | gunicorn, 2 workers, 120s timeout |
| Service worker version | stamped at Docker build from the release version |
| Manifests here | `deploy/prod/`, no namespace, Service `kpp`, `80` → `8000` |
| Ingress | `../gitops`, `kpp.istarhorse.com`, Traefik, shared `istarhorse-prod` certificate |
| Tag movement | CI commits the bump after the image push; Flux syncs git |
| Replicas / resources | 1 replica, requests `250m`/`512Mi`, limits `2`/`2Gi` |
| Probes | readiness and liveness on `GET /` |

## Tickets

1. [01 — Tests on every change](issues/01-tests-on-every-change.md)
2. [02 — Release the version and publish the image](issues/02-release-and-publish.md)
3. [03 — A container fit to serve](issues/03-a-container-fit-to-serve.md)
4. [04 — The manifests and the moving tag](issues/04-manifests-and-the-moving-tag.md)
5. [05 — Cut over from the home-lab endpoint](issues/05-cut-over-from-home-lab.md)
