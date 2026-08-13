# Acceptance bar for automatic extraction

Type: grilling
Status: resolved

## Question

Extraction is fully automatic on the happy path, with correction only as a rescue. That decision only means something once "works" and "fails" are defined — otherwise the spike has no bar to hit and the correction path has no trigger.

Settle:

1. **What counts as a correct parse?** Every Cell exactly right is probably too strict — a chart of ~17,000 Cells will have some wrong. Is the bar per-Cell accuracy above some threshold, or is it stricter than that because a single wrong Cell corrupts a Run and therefore a whole row's readout? The Run is the unit the user consumes, so per-Run correctness may be the honest measure.
2. **What must never be wrong?** Grid dimensions and Palette size are structural — getting those wrong makes every Run wrong. These plausibly need a much higher bar than individual Cell colors.
3. **How does the app know it failed?** Self-detection is what routes the user to correction. Candidates: low confidence in pitch recovery, a Palette that clusters ambiguously, a suspicious count of one-Cell Runs (a strong smell of misalignment). Without a self-detection signal, "correction only when it fails" has no way to fire and silently-wrong output reaches the user — the worst outcome for this product.
4. **What does the user do when it fails?** Not the UI design (out of scope) but the *capability*: re-crop, adjust dimensions, merge Palette entries, or start over.

**Resolved when** there is a stated, measurable bar the spike can be judged against, and a decision on how failure is detected rather than discovered by the user mid-row.

## Answer

**There is no programmatic acceptance bar. The user reviews every parse and fixes what is wrong.**

The user's decision, verbatim: *"I do not know how to make 'Acceptable bar' programatically so I would suggest user to judge and fix pieces that are not OK."*

This dissolves questions 1–3 rather than answering them. The app never decides whether a parse passed, so it needs no per-Cell or per-Run threshold, and it needs no self-detection signal to route the user to correction — because the user is already there.

### This changes the shape of the product, not just this ticket

Correction moves from **rescue** to the **normal flow**. Every parse is reviewed; the correction UI is on the critical path of the very first user journey, not a branch off it. The map's charting constraint — *"extraction is fully automatic on the happy path; correction exists only as a rescue when it fails"* — no longer holds and has been amended on the map.

Worth stating plainly because it reverses an earlier call: this lands close to the assisted-by-default option offered during charting and declined then. The route there was different — not a preference for assistance, but the absence of any honest way to automate the judgement — and it arrives with better information, which is the map working as intended.

### What this does not dispose of

**The bar still exists; it just moved into the user's head.** The implicit standard is now *"the parse must be close enough that fixing it beats charting by hand"*. That is unmeasurable up front but entirely measurable after the fact, and it becomes the spike's scoring rule: **not accuracy, but how much manual correction is left**. [Automatic extraction spike](05-extraction-spike.md) is judged on correction burden — how many Cells, and how many structural errors, a human must repair per chart.

**Structural errors are categorically worse than Cell errors, and human review does not equalise them.** Question 2 survives the decision intact. A wrong Cell colour is one tap to fix. Wrong grid dimensions mean every Cell is in the wrong place and there is nothing to correct — the parse must be thrown away and redone. The spike must report these separately; a chart that needs 40 Cell fixes passed, and a chart off by one column did not, whatever its per-Cell accuracy reads.

**Surfacing suspicion is now an optimisation, not a gate.** Two silent-failure modes are already known: 0.25° of skew returns a plausible-but-wrong pitch ([Lattice recovery techniques](03-lattice-recovery.md)), and a fixed Palette merge threshold over-segments on noisy charts ([Palette recovery from anti-aliased, lossy charts](04-palette-recovery.md)). Both produce output that looks reasonable. A reviewer scanning a 17,000-Cell chart by eye will miss them. Highlighting low-confidence regions is no longer load-bearing — nothing depends on it firing — but it is what makes review tractable at chart scale, and the spike should still report whether the pipeline yields a usable confidence signal.

**Question 4 — what the user can actually do — is unanswered and now urgent.** It was the least important question on this ticket while correction was a rescue path; it is the first thing to specify now that correction is the normal flow. Graduated to the map's *Not yet specified* rather than guessed at here: the useful version of that question depends on which errors the spike actually produces, and inventing a correction vocabulary before seeing them would be designing for imagined failures.
