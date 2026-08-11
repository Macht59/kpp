# Python for the parsing service, despite .NET being the house stack

The parsing service is written in Python. This is a deliberate deviation: .NET is the house language here, and a reader finding a lone Python service would reasonably assume it was an accident or the work of someone who didn't know the conventions.

## Considered Options

.NET has image-processing options — OpenCvSharp, Emgu CV, ImageSharp — so this was not a capability gap. It is a depth-of-ecosystem judgement.

The central risk of this project is whether automatic chart extraction works at all. That risk resolves through experimentation: trying a technique, finding it fails on some class of chart, and reaching for the next one. Python is where the computer-vision answers live — first-party OpenCV and scikit-image documentation, papers with reference implementations, and the accumulated trail of people who have already hit these exact failure modes. The .NET bindings are thinner, less trodden, and generally one translation step away from the material that would actually unblock us.

Buying speed on the riskiest part of the system is worth paying an unfamiliar-language cost on the least risky part.

## Consequences

This is a polyglot deployment: two runtimes, two dependency toolchains, two CI paths, and a team that is stronger in one of them than the other.

What contains the cost is the seam. The service is a pure function — image in, Chart JSON out, no state, no shared database, no domain logic beyond parsing. Nothing crosses the boundary except an image and a JSON document, so the language on the far side stays genuinely invisible to the rest of the system. If that seam ever widens — if the service starts holding state or owning domain concepts — this trade-off should be re-examined, because the containment is what justifies it.
