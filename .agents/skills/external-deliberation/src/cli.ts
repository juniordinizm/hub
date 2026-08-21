import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CaseStore } from "./case-store";
import {
  createReviewReport,
  createWorkingTreeFingerprint,
  type ReviewActor,
} from "./protocol";
import { DeliberationRuntime } from "./runtime";

const makeSmokeReport = (actor: ReviewActor) =>
  createReviewReport({
    actor,
    claim: "The target case was reviewed against the immutable baseline.",
    commands: ["git status --short"],
    confidence: "HIGH",
    coverageLedger: {
      examined: ["source", "tests", "configuration"],
      withoutEvidence: ["provider runtime"],
    },
    evidence: ["Synthetic runtime smoke input."],
    findings: [],
    impact: "No implementation authorization is implied.",
    limitations: ["Synthetic smoke only."],
    rollback: ["Keep implementation locked."],
    severity: "INFO",
    sources: ["AGENTS.md"],
    validation: ["Package-local tests."],
    verdict: "READY",
  });

export const runSyntheticSmoke = async (): Promise<{
  readonly auditEvents: number;
  readonly blockedEarlyExternalRead: boolean;
  readonly finalPhase: string;
  readonly implementationStarted: boolean;
  readonly reportBarrierReached: boolean;
}> => {
  const root = await mkdtemp(join(tmpdir(), "external-deliberation-cli-"));
  try {
    const runtime = await DeliberationRuntime.open(new CaseStore(root), {
      baselineMarkdown: `# Baseline\n\nSHA: ${"a".repeat(40)}\n`,
      branch: "main",
      caseId: "CLI-SMOKE-CASE",
      repository: "hub",
      reviewer: { tabId: "tab-smoke", threadId: "thread-smoke" },
      runId: "run-smoke",
      targetSha: "a".repeat(40),
      taskHash: "b".repeat(64),
      workingTree: createWorkingTreeFingerprint({
        diff: "",
        relevant: false,
        status: "",
      }),
    });

    await runtime.collectExternalReview(
      "Review the target SHA.",
      ["Do not read local reports."],
      () => makeSmokeReport("CHATGPT_EXTERNAL_REVIEWER")
    );
    let blockedEarlyExternalRead = false;
    try {
      await runtime.readReportFor("external", "CODEX_REVIEW");
    } catch {
      blockedEarlyExternalRead = true;
    }
    await runtime.collectCodexReview(
      "Review the target SHA.",
      ["Do not read local reports."],
      () => makeSmokeReport("CODEX_REVIEWER")
    );
    const synthesis = await runtime.synthesize();
    await runtime.finalize(
      "# Final report\n\nIMPLEMENTATION_LOCKED\n\nThe human decides.\n"
    );
    return {
      auditEvents: runtime.state.auditEvents.length,
      blockedEarlyExternalRead,
      finalPhase: runtime.state.phase,
      implementationStarted: runtime.state.implementationStarted,
      reportBarrierReached: synthesis.state.phase === "SYNTHESIS",
    };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
};

const main = async (): Promise<void> => {
  if (process.argv[2] !== "smoke") {
    throw new Error(
      "Usage: bun .agents/skills/external-deliberation/src/cli.ts smoke"
    );
  }
  console.log(JSON.stringify(await runSyntheticSmoke()));
};

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/cli.ts")) {
  await main();
}
