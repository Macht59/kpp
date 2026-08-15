# 04 — The manifests and the moving tag

**What to build:** `deploy/prod/` — a Deployment, a Service, and a
`kustomization.yaml` — and the CI step that moves the tag in it.

The manifests name no namespace. The fleet's convention, visible in every app
under `../gitops/clusters/local-cluster/istarhorse/prod/`, is that the Flux
`Kustomization` supplies `targetNamespace: istarhorse-prod`; an app repo that
hard-codes a namespace is an app repo that cannot be pointed anywhere else.
They also name no host: the `Ingress` for `kpp.istarhorse.com` lives in the
private gitops repo, and this repo stays silent about where the app runs.

The Service is `kpp`, port `80` → container `8000`. That name is the contract
the private `Ingress` binds to, so it is the one value here that cannot be
renamed casually.

One replica. Requests `250m`/`512Mi`, limits `2`/`2Gi` — generous ceilings
because scipy on the largest corpus chart is the only thing in this app that can
plausibly be OOMKilled, and an OOMKill mid-parse is a worse failure than a slow
parse. CI cannot catch that: the runner has no memory cap.

Readiness and liveness both `GET /`, which serves `web/index.html` off disk. No
health endpoint is added — an endpoint whose only caller is a probe is a second
thing to keep true.

**The moving tag.** After the image push succeeds, and only then, CI rewrites the
tag in `deploy/prod/deployment.yaml` and commits `chore(deploy): kpp X.Y.Z [skip ci]`
to `master`. Order matters: Flux reconciles this repo every minute, so a tag
written before the image is pushed is an `ImagePullBackOff` that lasts until the
build finishes. `chore` cuts no release, so the commit does not feed back into
the release job even if `[skip ci]` were ever dropped.

**Blocked by:** 02 — Release the version and publish the image.

**Status:** resolved

- [x] `deploy/prod/` holds a Deployment, a Service and a `kustomization.yaml`
- [x] No namespace and no hostname appear anywhere in this repo's manifests
- [x] Service `kpp`, port `80` → `8000`; 1 replica; requests `250m`/`512Mi`, limits `2`/`2Gi`
- [x] Readiness and liveness probes on `GET /`
- [x] CI commits the tag bump to `master` only after the image push succeeds
- [x] The bump commit is a `chore` and carries `[skip ci]`

## Comments

**Built.** `deploy/prod/` builds under `kubectl kustomize` and contains no
`namespace:` and no hostname. The Deployment's image is `ghcr.io/macht59/kpp:0.1.0`
— the version the first release will compute, so the first bump is a no-op.

That no-op is handled rather than left to fail: the bump step exits cleanly when
`git diff --quiet` finds nothing to commit, so an image job that produces an
identical manifest does not turn the run red. A `git pull --rebase` precedes the
push, so a commit landing during the build does not lose the deploy.
