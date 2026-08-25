interface PlaywrightResult {
  duration?: number;
  retry?: number;
  status?: string;
}

interface PlaywrightTestResult {
  projectName?: string;
  results?: PlaywrightResult[];
}

interface PlaywrightSpec {
  tests?: PlaywrightTestResult[];
}

interface PlaywrightSuite {
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

export interface PlaywrightReport {
  suites?: PlaywrightSuite[];
}

interface ProjectMetrics {
  durationMs: number;
  failures: number;
  name: string;
  results: number;
  retries: number;
}

export interface PlaywrightMetrics {
  projects: ProjectMetrics[];
  total: Omit<ProjectMetrics, "name">;
}

interface CollectedResult {
  projectName: string;
  result: PlaywrightResult;
}

const collectResults = (suite: PlaywrightSuite): CollectedResult[] => [
  ...(suite.specs ?? []).flatMap((spec) =>
    (spec.tests ?? []).flatMap((test) =>
      (test.results ?? []).map((result) => ({
        projectName: test.projectName?.trim() || "unknown",
        result,
      }))
    )
  ),
  ...(suite.suites ?? []).flatMap(collectResults),
];

const summarize = (
  results: CollectedResult[]
): Omit<ProjectMetrics, "name"> => ({
  durationMs: results.reduce(
    (total, collected) => total + (collected.result.duration ?? 0),
    0
  ),
  failures: results.filter((collected) => collected.result.status !== "passed")
    .length,
  results: results.length,
  retries: results.filter((collected) => (collected.result.retry ?? 0) > 0)
    .length,
});

export const collectPlaywrightMetrics = (
  report: PlaywrightReport
): PlaywrightMetrics => {
  const results = (report.suites ?? []).flatMap(collectResults);
  const projectNames = [
    ...new Set(results.map((result) => result.projectName)),
  ].sort();
  return {
    projects: projectNames.map((name) => ({
      name,
      ...summarize(results.filter((result) => result.projectName === name)),
    })),
    total: summarize(results),
  };
};
