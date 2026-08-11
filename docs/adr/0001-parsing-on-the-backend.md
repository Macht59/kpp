# Chart parsing runs on a backend, not in the browser

kpp is a mobile-first web UI, so the obvious shape is a purely client-side app that parses charts in-browser with `<canvas>` and `getImageData` — no server, no upload, no hosting cost, and the image never leaves the device. We deliberately rejected that and put parsing behind a backend.

## Considered Options

The no-backend option was the original preference and was held until charting exposed what parsing actually demands. Two measurements moved it:

- Recovering the Chart's lattice by scanning for grey gridlines worked only in the example chart's white margin and collapsed across every saturated region, because gridlines are drawn over fills and take their colour from beneath. Recovering a lattice needs real computer vision — frequency-domain periodicity detection, Hough transforms, morphology — not a hand-rolled heuristic.
- The example image holds 121,369 distinct RGB values that must collapse to a design Palette of roughly 12–16. That is a clustering problem, and choosing the cluster count automatically is the part most likely to need iteration.

Both are OpenCV-shaped problems. Doing them in-browser means either reimplementing the algorithms in JavaScript or shipping OpenCV.js as a multi-megabyte WASM payload to a phone — while the whole feasibility of the approach is still unproven.

## Consequences

The cost is real and accepted: images now leave the device, there is a service to host and pay for, the app needs a network connection to parse, and mobile upload of a multi-megabyte screenshot becomes a concern the deployment shape has to answer.

What buys it back is iteration speed on the part of the system most likely to be wrong. Parsing improves centrally without shipping a new client, which matters while the extraction approach is still being proven.

This decision is worth revisiting only if extraction turns out simple enough that the CV ecosystem stops earning its cost.
