import type { Result } from "axe-core";

const BLOCKING_IMPACTS = new Set(["critical", "moderate", "serious"]);
const MAX_SELECTORS_PER_RULE = 3;
const MAX_SELECTOR_LENGTH = 160;

export interface AccessibilityViolationSummary {
  help: string;
  helpUrl: string;
  id: string;
  impact: string;
  nodeCount: number;
  selectors: string[];
}

const formatTarget = (target: unknown): string =>
  JSON.stringify(target).slice(0, MAX_SELECTOR_LENGTH);

export const getBlockingAccessibilityViolations = (
  violations: Result[]
): AccessibilityViolationSummary[] =>
  violations
    .filter(
      (violation): violation is Result & { impact: string } =>
        typeof violation.impact === "string" &&
        BLOCKING_IMPACTS.has(violation.impact)
    )
    .map((violation) => ({
      help: violation.help,
      helpUrl: violation.helpUrl,
      id: violation.id,
      impact: violation.impact,
      nodeCount: violation.nodes.length,
      selectors: violation.nodes
        .slice(0, MAX_SELECTORS_PER_RULE)
        .map((node) => formatTarget(node.target)),
    }));

export const formatBlockingAccessibilityViolations = (
  violations: AccessibilityViolationSummary[],
  surface: string
): string => {
  const details = violations.map(
    (violation) =>
      `[${violation.impact}] ${violation.id}: ${violation.help}\n` +
      `${violation.helpUrl}\n` +
      `selectors (${violation.selectors.length}/${violation.nodeCount}): ${violation.selectors.join(", ")}`
  );
  return `Accessibility violations on ${surface}:\n${details.join("\n\n")}`;
};
