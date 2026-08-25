import { appendFile, readFile } from "node:fs/promises";
import {
  collectPlaywrightMetrics,
  type PlaywrightReport,
} from "../src/tooling/playwright-metrics";

const reportPath = process.argv[2];

if (!reportPath) {
  throw new Error("Provide the Playwright JSON report path.");
}

const report = JSON.parse(
  await readFile(reportPath, "utf8")
) as PlaywrightReport;
const metrics = collectPlaywrightMetrics(report);
const projectLines = metrics.projects.map(
  (project) =>
    `- ${project.name}: ${project.results} resultados, ${(project.durationMs / 1000).toFixed(2)}s, ${project.retries} retries, ${project.failures} não aprovados`
);
const summary = [
  "## Métricas E2E",
  "",
  `- resultados: ${metrics.total.results}`,
  `- duração acumulada: ${(metrics.total.durationMs / 1000).toFixed(2)}s`,
  `- retries: ${metrics.total.retries}`,
  `- resultados não aprovados: ${metrics.total.failures}`,
  ...projectLines,
].join("\n");

const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
if (stepSummaryPath) {
  await appendFile(stepSummaryPath, `${summary}\n`, "utf8");
}

console.log(summary);

if (metrics.total.retries > 0) {
  throw new Error(
    "Playwright retried at least one test; investigate the flake."
  );
}
