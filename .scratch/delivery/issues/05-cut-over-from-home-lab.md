# 05 — Cut over from the home-lab endpoint

**What to build:** The two halves of this that live outside this repository, and
the order they happen in.

`kpp.istarhorse.com` resolves today through `../home-lab/deploy/kpp.yaml`: a
`Service` with a hand-written `Endpoints` object pointing at
`192.168.30.118:8004`, an `Ingress` in the `homelab` namespace, and the host
listed in that namespace's shared `Certificate`. The app itself runs on a box
outside the cluster that no repository describes.

**In `../gitops`**, a new `clusters/local-cluster/istarhorse/prod/kpp/`
following the shape every other app there uses: a `GitRepository` for
`github.com/Macht59/kpp` — no `secretRef`, because unlike the rest of the fleet
it is public and read-only to Flux — a `Kustomization` with `path: ./deploy/prod`
and `targetNamespace: istarhorse-prod`, and the `Ingress` for
`kpp.istarhorse.com` backed by Service `kpp` on port 80 with TLS from
`istarhorse-prod-certificate-secret`. The host joins `dnsNames` on the
`istarhorse-prod` `Certificate`, and the directory joins the prod
`kustomization.yaml`.

**In `../home-lab`**, the reverse: `deploy/kpp.yaml` deleted, its line removed
from `deploy/kustomization.yaml`, and `kpp.istarhorse.com` removed from
`deploy/certificate.yaml`.

**The order is the whole ticket.** Between the gitops change reconciling and the
home-lab change reconciling, two `Ingress` objects in two namespaces claim the
same host, and Traefik will pick one of them without asking. So:

1. This repo lands and cuts `0.1.0`, so an image exists to pull.
2. `../gitops` is pushed. Flux creates the Deployment in `istarhorse-prod`.
3. The new pods are confirmed serving — by hand, with cluster access, which the
   agent does not have.
4. Only then is `../home-lab` pushed, removing the old Ingress and endpoint.

Both outside repositories are committed but **not pushed** by the agent: they
deploy the whole house, and the keystroke that makes Flux act stays the
maintainer's. The box at `192.168.30.118:8004` is retired by hand afterwards; it
is not described by any of the three repositories.

**Blocked by:** 04 — The manifests and the moving tag.

**Status:** resolved

- [x] `../gitops` has `clusters/local-cluster/istarhorse/prod/kpp/` with a `GitRepository`, a `Kustomization` and an `Ingress`
- [x] `kpp.istarhorse.com` is in the `istarhorse-prod` `Certificate`'s `dnsNames`
- [x] The app is listed in the prod `kustomization.yaml`
- [x] `../home-lab` loses `deploy/kpp.yaml`, its `kustomization.yaml` entry and its `dnsNames` entry
- [x] Both outside repositories are committed and left unpushed
- [x] The home-lab removal is pushed only after the new pods are confirmed serving

## Comments

**Written and committed, not pushed.** Both outside repositories are staged as
described:

`../gitops` gains `clusters/local-cluster/istarhorse/prod/kpp/` with the
`GitRepository` (no `secretRef` — public GitHub), the `Kustomization`
(`./deploy/prod`, `targetNamespace: istarhorse-prod`) and the `Ingress`, and is
wired into the prod `kustomization.yaml`; `kpp.istarhorse.com` joins the
`istarhorse-prod` `Certificate`. The app-directory layout follows
`knitting-pattern-manager` rather than the older central `ingresses/` directory,
so the three files that describe this app sit together. `kubectl kustomize` on
the prod directory builds.

`../home-lab` loses `deploy/kpp.yaml`, its `kustomization.yaml` entry and its
`dnsNames` entry; that directory still builds too.

**Step 1 is done:** `kpp` is pushed, `0.1.1` is released and
`ghcr.io/macht59/kpp:0.1.1` is public and pullable, and `deploy/prod` names it.

**Left to a human, in this order:** push `../gitops`; confirm the pods in `istarhorse-prod` are serving;
only then push `../home-lab`. The agent has no cluster credentials here
(`kubectl` reports `the server has asked for the client to provide credentials`),
so the confirmation step cannot be automated from this machine. The box at
`192.168.30.118:8004` is retired by hand afterwards.

**Cut over.** Both outside repositories are pushed and level with their remotes:
`../gitops` at `Deploy kpp in istarhorse-prod`, `../home-lab` at `Remove kpp: it
runs in the cluster now`, in that order.

`https://kpp.istarhorse.com/` answers 200 with `server: gunicorn` and serves
`index.html`, and `POST /api/parse` with no image answers the app's own 400 — so
the host resolves to the container image, not the old box. The home-lab `Ingress`
and `Endpoints` are gone from git, so nothing else claims the host. This is the
outside-in check; there are still no cluster credentials on this machine, so
`kubectl get pods -n istarhorse-prod` remains a maintainer's command.

**Still by hand:** the box at `192.168.30.118:8004` answers 200 on its own port
and is now serving nobody. Retiring it is the last step, and no repository
describes it.
