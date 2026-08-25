import type { Result } from "axe-core";
import { describe, expect, it } from "vitest";
import {
  formatBlockingAccessibilityViolations,
  getBlockingAccessibilityViolations,
} from "./accessibility-violations";

const makeViolation = (
  impact: Exclude<Result["impact"], undefined>,
  id: string
): Result => ({
  description: "description",
  help: "help",
  helpUrl: `https://dequeuniversity.com/rules/axe/${id}`,
  id,
  impact,
  nodes: [
    {
      all: [],
      any: [],
      failureSummary: "sensitive rendered HTML must not be reported",
      html: "<input value='secret'>",
      impact: impact ?? null,
      none: [],
      target: ["#safe-selector"],
    },
  ],
  tags: [],
});

describe("accessibility violation diagnostics", () => {
  it("blocks moderate, serious, and critical impacts only", () => {
    const summaries = getBlockingAccessibilityViolations([
      makeViolation("minor", "minor-rule"),
      makeViolation("moderate", "moderate-rule"),
      makeViolation("serious", "serious-rule"),
      makeViolation("critical", "critical-rule"),
    ]);

    expect(summaries.map((summary) => summary.id)).toEqual([
      "moderate-rule",
      "serious-rule",
      "critical-rule",
    ]);
  });

  it("reports limited selectors without rendered HTML or failure summaries", () => {
    const message = formatBlockingAccessibilityViolations(
      getBlockingAccessibilityViolations([
        makeViolation("moderate", "moderate-rule"),
      ]),
      "login"
    );

    expect(message).toContain("moderate-rule");
    expect(message).toContain("#safe-selector");
    expect(message).not.toContain("<input");
    expect(message).not.toContain("sensitive rendered HTML");
  });
});
