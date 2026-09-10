import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEARNING_ANALYTICS_PERIOD,
  getLearningAnalyticsPeriodLabel,
  parseLearningAnalyticsPeriod,
} from "./period";

describe("learning analytics periods", () => {
  it("falls back to the 90-day window for missing or invalid values", () => {
    expect(parseLearningAnalyticsPeriod(undefined)).toBe(
      DEFAULT_LEARNING_ANALYTICS_PERIOD
    );
    expect(parseLearningAnalyticsPeriod("invalid")).toBe(
      DEFAULT_LEARNING_ANALYTICS_PERIOD
    );
  });

  it("exposes readable labels for supported windows", () => {
    expect(getLearningAnalyticsPeriodLabel("30d")).toBe("1 mês");
    expect(getLearningAnalyticsPeriodLabel("90d")).toBe("3 meses");
    expect(getLearningAnalyticsPeriodLabel("6m")).toBe("6 meses");
    expect(getLearningAnalyticsPeriodLabel("12m")).toBe("12 meses");
  });
});
