// What the client puts on screen, decided from state alone: which controls are
// worth showing, what they say, and where the knitter lands after a decision.
// No DOM, no canvas, no storage — `app.js` reads these and does nothing with the
// answers but write them into elements, so the rules are testable without a
// browser and the drawing stays the part that is checked by eye.

import { rowCount, colCount, separations } from "./chart.js";

export const REVIEW = "review";
export const KNIT = "knit";

/** How big a Chart is, in the words Review and the library both use. */
export const measured = (chart) => `${rowCount(chart)} rows × ${colCount(chart)} columns`;

/** The Palette entry count, which is the number a knitter holds against their yarns. */
export const paletteWords = (entries) => `${entries} ${entries === 1 ? "colour" : "colours"}`;

const blanks = (count, line) => count && `${count} blank ${line}${count === 1 ? "" : "s"}`;

/**
 * What the crop caught beyond the pattern, and the way to have it back. A Chart
 * two Rows smaller than the knitter expected is explained rather than
 * suspicious — and a pattern that really does have a white edge Row is one tap
 * from showing it. Silent when the crop landed clean, which is most of them.
 */
export function blankWords({ blank, trimmed }) {
  const found = [blanks(blank.top + blank.bottom, "row"), blanks(blank.left + blank.right, "column")];
  const said = found.filter(Boolean);
  return {
    hidden: !said.length,
    words: `${said.join(" and ")} ${trimmed ? "hidden" : "shown"}`,
    control: trimmed ? "Show them" : "Hide them again",
  };
}

/**
 * The answers the parse offered for how many colours this Chart has, labelled by
 * the count the knitter can hold against the yarns on the table, with the one
 * being read marked.
 *
 * Hidden when the parse offered one answer — which is every Chart parsed before
 * Separations existed — because a list of one is a control that does nothing.
 * Marked from the Chart on screen rather than the knitter's stored choice: one
 * who has chosen nothing is still reading at the parser's default, and marking
 * their choice would mark nothing at all.
 */
export function separationChoices(chart, shown) {
  const labels = separations(chart).map(({ colours }) => paletteWords(colours));
  return { hidden: labels.length < 2, labels, marked: shown.separation };
}

/** How many Rows sit hidden beneath Row 1 — none, when nothing is hidden. */
const hiddenBelow = (chart) => (chart.trimmed ? chart.blank.bottom : 0);

/**
 * The Row the knitter stands on after a decision about how the Chart is read.
 * Row 1 is the bottom, so the blank Rows hidden beneath it renumber every Row
 * above — whether they hid them by hand or a finer Separation stopped counting
 * one of them as white. They stay on the Row they were on either way, and never
 * off the bottom of the Chart.
 */
export const rowAfterAdopting = (selected, shown, next) =>
  Math.max(selected + hiddenBelow(shown) - hiddenBelow(next), 1);

/**
 * Which of the two navigation models is up, and what the way out of it is
 * called. Review and Knit are opposite ways of moving over the same Chart, so
 * only one is ever on screen, and neither is until there is a Chart to show.
 */
export function screenFor(mode, hasChart) {
  const showing = hasChart ? mode : null;
  return {
    review: showing === REVIEW,
    knit: showing === KNIT,
    chrome: showing !== null,
    switchLabel: showing === REVIEW ? "Knit this chart" : "Review this parse",
  };
}
