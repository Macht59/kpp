# The client is a no-build vanilla + canvas PWA

The web client is plain ES modules, a `<canvas>`, and a service worker. No framework, no bundler, no build step. It installs to the home screen and works offline for everything except parsing.

**Amended by [ADR-0005](0005-delivery-releases-images-and-flux.md): there is now a `package.json`.** It holds semantic-release and its plugins as pinned devDependencies, and names the web suite as `npm test`. No client code passes through it: nothing is bundled, nothing is transpiled, and `python server.py` still serves `web/` exactly as it sits on disk. The claim this ADR was making was never really "no manifest file" — it was no toolchain between the source and the browser, and that still holds. The one build-time transformation that exists, stamping the release version into the service worker's cache name, happens inside the Docker build and never touches the working tree.

A reader will expect a framework here, because almost every mobile-first web app built now has one, and because the repo is otherwise a normal Python project that could have hosted a normal Vite app beside it.

## Considered Options

**Flutter** was seriously considered, and is the option worth explaining. Its web target renders through a WebAssembly Skia build, so a multi-megabyte engine plus font data downloads before the first pixel — on the mobile connection this app exists for. It would also put a Dart toolchain into a Python repo and a second language between the code and a Chart object that is otherwise plain JSON. The thing Flutter would ship an engine to reach is a canvas, which the browser already has. It flips only if the destination is a store-distributed native app; it isn't, and a PWA covers the two things that actually matter to a knitter — home-screen install and working offline mid-project — without the download.

**React or Svelte via Vite** was the conventional choice. A framework's leverage is diffing a complex element tree, and this app doesn't have one: a canvas, a Readout pane, a Palette bar, and a single Chart object as state. The cost is a Node toolchain and a build step in a repo that currently has neither.

The deciding factor is that the UI is a canvas either way. Everything expensive about a chart on a phone — drawing 16,800 Cells, hit-testing a tap, panning — is canvas work that a framework neither helps with nor is aware of.

## Consequences

There is no component model, so if the UI grows past a handful of screens the hand-rolled structure will start to cost more than a framework would have. The reversal is a rewrite of the client, but the parser and the Chart JSON contract are untouched by it — `parse_chart` stays the seam, and the client is the only thing that would be thrown away.

Parsing requires the network. Offline gets the app shell and every stored Chart, including Select, Readout and Repaint; it does not get a new parse, and the UI has to say so rather than fail obscurely.
