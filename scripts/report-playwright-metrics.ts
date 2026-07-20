import { appendFile, readFile } from "node:fs/promises";

interface PlaywrightResult {
  duration?: number;
  retry?: number;
  status?: string;
}

interface PlaywrightSpec {
  tests?: Array<{ results?: PlaywrightResult[] }>;
}

interface PlaywrightSuite {
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites?: PlaywrightSuite[];
}

const reportPath = process.argv[2];

if (!reportPath) {
  throw new Error("Provide the Playwright JSON report path.");
}

const collectResults = (suite: PlaywrightSuite): PlaywrightResult[] => [
  ...(suite.specs ?? []).flatMap((spec) =>
    (spec.tests ?? []).flatMap((test) => test.results ?? [])
  ),
  ...(suite.suites ?? []).flatMap(collectResults),
];

const report = JSON.parse(
  await readFile(reportPath, "utf8")
) as PlaywrightReport;
const results = (report.suites ?? []).flatMap(collectResults);
const durationMs = results.reduce(
  (total, result) => total + (result.duration ?? 0),
  0
);
const retries = results.filter((result) => (result.retry ?? 0) > 0);
const failures = results.filter((result) => result.status !== "passed");
const summary = [
  "## Métricas E2E",
  "",
  `- resultados: ${results.length}`,
  `- duração acumulada: ${(durationMs / 1000).toFixed(2)}s`,
  `- retries: ${retries.length}`,
  `- resultados não aprovados: ${failures.length}`,
].join("\n");

const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
if (stepSummaryPath) {
  await appendFile(stepSummaryPath, `${summary}\n`, "utf8");
}

console.log(summary);

if (retries.length > 0) {
  throw new Error(
    "Playwright retried at least one test; investigate the flake."
  );
}
