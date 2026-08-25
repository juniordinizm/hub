import { describe, expect, it } from "vitest";
import { collectPlaywrightMetrics } from "./playwright-metrics";

describe("Playwright metrics", () => {
  it("aggregates duration and outcomes per project", () => {
    const metrics = collectPlaywrightMetrics({
      suites: [
        {
          specs: [
            {
              tests: [
                {
                  projectName: "chromium-desktop",
                  results: [{ duration: 1000, retry: 0, status: "passed" }],
                },
                {
                  projectName: "chromium-mobile",
                  results: [{ duration: 2500, retry: 1, status: "failed" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(metrics.total).toEqual({
      durationMs: 3500,
      failures: 1,
      results: 2,
      retries: 1,
    });
    expect(metrics.projects).toEqual([
      {
        durationMs: 1000,
        failures: 0,
        name: "chromium-desktop",
        results: 1,
        retries: 0,
      },
      {
        durationMs: 2500,
        failures: 1,
        name: "chromium-mobile",
        results: 1,
        retries: 1,
      },
    ]);
  });
});
