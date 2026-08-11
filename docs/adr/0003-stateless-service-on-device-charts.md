# The parsing service is stateless; Charts persist on the device

The service takes an image, returns a Chart, and retains nothing — no uploaded images, no parsed results, no identifiers. Charts a user wants to reopen are stored on their device in IndexedDB. There are no accounts.

This surprises in both directions. Having decided to run a backend at all ([ADR-0001](0001-parsing-on-the-backend.md)), storing the user's charts there is the obvious next step — a reader will wonder why we went to the trouble of a server and then refused to let it remember anything. And "charts can be reopened" normally implies server-side persistence.

## Considered Options

Server-side storage under opaque per-chart URLs would have given reopening without accounts too, and would have brought cross-device access with it. It was rejected for what it drags in: a storage layer, identifier generation, a retention policy, and the "anyone with the URL can read it" security question — none of which v1 needs, and all of which have to be designed before the first chart can be saved.

Keeping the service a pure function of its input matters specifically to where this project currently is. The extraction approach is unproven. A stateless service is the easiest thing to prototype, redeploy, and throw away entirely if the approach turns out wrong — no migration, no orphaned data, no schema to honour. Persistence would couple the riskiest component to durable state before we know the component survives.

## Consequences

Clearing browser data loses every Chart, and Charts do not follow a user to another device. This was accepted knowingly rather than overlooked.

One non-obvious downstream effect: because stored Charts outlive the service release that produced them, the Chart JSON contract needs versioning from the start. A user's device may hold a Chart parsed by a version of the service that no longer exists, and nothing server-side can migrate it.
