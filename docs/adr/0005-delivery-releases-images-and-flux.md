# Delivery: semantic-release to GHCR, and CI moves the tag Flux reads

A push to `master` cuts a version with semantic-release, publishes
`ghcr.io/macht59/kpp:X.Y.Z`, and then commits that tag into `deploy/prod/` in
this repository. FluxCD, watching this repository from a private gitops repo,
reconciles the change into the cluster. The manifests here name no namespace and
no hostname; the `Ingress` for `kpp.istarhorse.com` lives in the private repo,
with the rest of the fleet.

Three things about this are surprising enough to write down.

**The image is not built on every push.** Only a release produces one, tagged
`X.Y.Z` and `latest`. A `docs` or `chore` commit runs the tests and builds the
image to prove it still builds, and pushes nothing. The alternative — an image
per commit, `latest` meaning "newest commit" — gives two names for "current" that
disagree, which is worth more confusion than it saves.

**Flux's image automation is deliberately not used**, although Flux is what
deploys. The `image-reflector` and `image-automation` controllers are not
installed in the cluster, and installing them would mean two more controllers, a
GHCR-scanning `ImageRepository`, and a git write credential inside the cluster —
all to re-derive a version that the release job held in a variable thirty
seconds earlier. So CI commits the bump itself, as
`chore(deploy): kpp X.Y.Z [skip ci]`, and Flux does what it does for every other
app in the fleet: sync git. The commit is made **after** the image push
succeeds, never before, because Flux reconciles every 60 seconds and a manifest
naming an image that does not exist yet is an `ImagePullBackOff` until the build
finishes.

**The manifests are split across a public and a private repository.** A future
reader will look at `deploy/prod/` and wonder where the `Ingress` is. It is in
the private gitops repo because the hostname is the one piece of this that is
not public — the version is already visible on the GHCR package page and the
Releases tab, but where the app is hosted should not be. The split follows the
fleet's existing shape: each app repo carries its own workload manifests, and
the gitops repo carries one `GitRepository`, one `Kustomization` and one
`Ingress` per app. It is why nothing here names a namespace: `targetNamespace`
is supplied from the other side.

## Considered Options

**release-please** instead of semantic-release. It needs no `package.json` and no
repository dependencies, which sat better with ADR-0004, and its release-PR gate
is a genuine feature on a repository pushed to directly. semantic-release was
chosen for its continuous behaviour — a release should not need a merge — and
`package.json` was accepted as a consequence rather than avoided.

**Manifests entirely in the private repo**, with this repository shipping only an
image. Rejected: it severs the manifests from the code they deploy, and a change
to the container's port or command would then span two repositories with no
common review.

**The version pin in the private repo**, via the Flux `Kustomization`'s `images:`
field, so that even the running version stays private. Rejected: it would leave
`deploy/prod/deployment.yaml` in this repository stating a tag that is never what
is running, which is the kind of file that misleads at 3am.

## Consequences

CI now writes to `master`. That is one commit per release, made by
`github-actions[bot]`, and it is the mechanism the deploy depends on — a branch
protection rule that blocks it stops deployments, not just commits.

The registry is public, so no pull secret exists in the cluster. If this
repository ever goes private, the GHCR package goes private with it and an
`imagePullSecret` becomes load-bearing.

There is one environment. A staging copy of a stateless parser with no secrets
and no schema would test the same image against the same code, so there is
nothing to rehearse — but adding one later means a second `deploy/` directory
here and a second app directory there, not a change to this decision.
