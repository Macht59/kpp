# 10 — The client's wiring is untested

**What to build:** a decision first, and only then code. This ticket reopens a
line in [the spec's Out of Scope](../spec.md) — "Browser and end-to-end tests" —
because the reason given there has stopped covering everything it is being read
as covering.

That line rules out driving canvas rendering, pinch-zoom and tap hit-testing,
and it is still right about all three: they are expensive to drive and cheap to
eyeball. But `web/app.js` is 1100 lines now, and the part of it that has grown
is not drawing. It is the wiring: which control is visible in which mode, what
the facts line says, which entry in a list is marked, what a decision does to
the Row the knitter is standing on. `web/chart.js` is covered — 54 tests — and
`app.js` has none, so all of that is held by reading alone.

Where this was noticed: closing
[separation ticket 04](../../separation/issues/04-choose-a-separation-in-review.md).
Its Separation list is Review-only, hides itself when a Chart offers one answer,
and marks the Separation actually being read rather than the knitter's stored
choice — three rules with a wrong answer each, all verified by reading the
source. None of them is a pixel.

**The question for triage** is which of two shapes this takes, because they cost
very differently:

- **Extract, then test what comes out.** The rules above are decisions about
  state, not about the DOM: *is the chooser worth showing*, *what does the facts
  line say*, *which Row is the knitter on after this decision*. Pull them out of
  `app.js` as pure functions, into `chart.js` or a module beside it, and Node's
  built-in runner tests them with no new dependency and no harness at all.
  `app.js` keeps only the part that puts a string into an element. This is the
  cheap shape, and it fits [ADR-0004](../../../docs/adr/0004-vanilla-canvas-pwa-client.md)
  without amending anything.
- **A DOM harness.** jsdom as a test-time devDependency, `app.js` loaded against
  a parsed `index.html`, assertions on what is hidden and what is marked. This
  catches a whole class the first shape cannot — an element renamed in the HTML,
  a listener never attached — at the cost of the first dependency the client has
  ever had, and a mock canvas, and the drift that comes with testing a fake DOM.

The recommendation is the first, and the second only for whatever is left over
once the decisions have moved out. Whoever picks this up should say what was
left over, because that list is the honest measure of what a harness would buy.

Either way this is a test-time concern only: nothing here may add a build step,
and `python server.py` must keep serving `web/` exactly as it sits on disk.

**Blocked by:** None.

**Status:** needs-triage

- [ ] The spec's Out of Scope line is amended to say what is still out — canvas, gestures, end-to-end — rather than reading as "the client is not tested"
- [ ] The visibility rules that are decisions about state, not about the DOM, are testable without a harness
- [ ] Tests cover: a chooser hidden when there is one answer, a control that belongs to one mode never offered in the other, the facts line's wording for hidden Rows and Columns, and the Row the knitter lands on after a decision that changes what is hidden
- [ ] No new dependency, or one that is a devDependency and a test-time requirement only
- [ ] No build step: `web/` is still served exactly as it sits on disk
- [ ] Whatever a harness would still catch that this does not is written down, here, rather than left implied
