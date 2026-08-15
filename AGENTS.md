# kpp

Knitting Pattern Parser — converts image patterns into interactive ones.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Delivery

`master` releases itself: semantic-release cuts the version, CI pushes the image
to GHCR and commits the tag into `deploy/prod/`, Flux deploys it. Conventional
commits are the input — a `feat` or `fix` cuts a version, anything else does not.
See [ADR-0005](docs/adr/0005-delivery-releases-images-and-flux.md).

### Domain docs

Single-context — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
