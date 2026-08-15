# kpp

Knitting Pattern Parser — converts image patterns into interactive ones.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Commit messages

Always write Conventional Commits — semantic-release parses them with the
default Angular preset, so the type decides whether a release happens.

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

- `feat` — minor version. `fix` and `perf` — patch version.
- `docs`, `refactor`, `test`, `style`, `build`, `ci`, `chore` — no release.
- A `BREAKING CHANGE: <what broke>` footer, or `!` after the type
  (`feat!:`), cuts a major version.
- Subject in the imperative, lower-case type, no trailing period.
- Scope is the touched area (`web`, `parser`, `deploy`) — optional but preferred.
- Reference issues in the footer (`Refs: .scratch/<feature>/<issue>.md`).

Never invent a type outside that list, and never bury a user-visible change
under a non-releasing type — an unreleased `fix` never reaches production.

### Delivery

`master` releases itself: semantic-release cuts the version, CI pushes the image
to GHCR and commits the tag into `deploy/prod/`, Flux deploys it. Conventional
commits are the input — a `feat` or `fix` cuts a version, anything else does not.
See [ADR-0005](docs/adr/0005-delivery-releases-images-and-flux.md).

### Domain docs

Single-context — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
