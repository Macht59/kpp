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

**Status:** resolved

- [x] The spec's Out of Scope line is amended to say what is still out — canvas, gestures, end-to-end — rather than reading as "the client is not tested"
- [x] The visibility rules that are decisions about state, not about the DOM, are testable without a harness
- [x] Tests cover: a chooser hidden when there is one answer, a control that belongs to one mode never offered in the other, the facts line's wording for hidden Rows and Columns, and the Row the knitter lands on after a decision that changes what is hidden
- [x] No new dependency, or one that is a devDependency and a test-time requirement only
- [x] No build step: `web/` is still served exactly as it sits on disk
- [x] Whatever a harness would still catch that this does not is written down, here, rather than left implied

## Answer

**The first shape, as recommended.** `web/screen.js` holds what the client shows
— `measured`, `paletteWords`, `blankWords`, `separationChoices`,
`rowAfterAdopting` and `screenFor` — and `web/screen.test.js` covers them under
Node's runner. No dependency, no harness, no build step; the shell list in
`sw.js` gained the module and `tests/test_app_shell.py` proves it is served.
`app.js` keeps the elements and the drawing, and now writes answers rather than
reaching them: `drawTrim`, `drawSeparations`, `drawFacts`, `setMode` and `adopt`
each lost their decision to the module.

Suites: 68 JavaScript tests, 97 Python.

One wording change came with it. A Separation of one colour was labelled
`1 colours`; it shares `paletteWords` with the facts line now and reads
`1 colour`.

**What a DOM harness would still catch,** which is the honest measure asked for
above:

- An element renamed or removed in `index.html`, leaving `getElementById` null
  and a control that silently never updates.
- A listener never attached, so a button draws correctly and does nothing.
- A control in the wrong section of the markup. The Separation chooser is Review
  only *because* it sits inside `#review` — `screenFor` says the section is
  down in Knit, but nothing asserts the chooser is in that section.
- The order the drawing functions run in, and anything that reads state one of
  them has not written yet.
- Anything about the canvas: what is drawn, where a tap lands, pinch and pan.
  Still out of scope, still cheap to eyeball.

The first three are a real class and none of them is expensive to hit. They are
also all *wiring an element to a decision*, which is one shape of bug — worth a
harness only if one of them ever ships. None has yet.
