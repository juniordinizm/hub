import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaseStore } from "../src/case-store";
import {
  createReviewReport,
  createWorkingTreeFingerprint,
  type ReviewActor,
} from "../src/protocol";
import { DeliberationRuntime } from "../src/runtime";

const roots: string[] = [];
const INDEPENDENCE_ERROR_PATTERN = /until codex-review|sealed/i;
const INTEGRITY_ERROR_PATTERN = /integrity|hash/i;

const makeReport = (
  actor: ReviewActor,
  claim = "The synthetic target was reviewed."
) =>
  createReviewReport({
    actor,
    claim,
    commands: ["git status --short"],
    confidence: "HIGH",
    coverageLedger: {
      examined: ["source", "tests"],
      withoutEvidence: ["provider runtime"],
    },
    evidence: ["Synthetic runtime evidence."],
    findings: [],
    impact: "No implementation authorization is implied.",
    limitations: ["Synthetic runtime test."],
    rollback: ["Keep implementation locked."],
    severity: "INFO",
    sources: ["AGENTS.md"],
    validation: ["Runtime test."],
    verdict: "READY",
  });

const openRuntime = async (caseId: string) => {
  const root = await mkdtemp(join(tmpdir(), "external-deliberation-runtime-"));
  roots.push(root);
  return DeliberationRuntime.open(new CaseStore(root), {
    baselineMarkdown: `# Baseline\n\nSHA: ${"a".repeat(40)}\n`,
    branch: "main",
    caseId,
    repository: "hub",
    reviewer: { tabId: "tab-runtime", threadId: "thread-runtime" },
    runId: "run-runtime",
    targetSha: "a".repeat(40),
    taskHash: "b".repeat(64),
    workingTree: createWorkingTreeFingerprint({
      diff: "",
      relevant: false,
      status: "",
    }),
  });
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("DeliberationRuntime", () => {
  it("runs the documented skill path with an observable temporal barrier", async () => {
    const runtime = await openRuntime("RUNTIME-SMOKE");
    await runtime.collectExternalReview(
      "Review the target SHA.",
      ["Do not read local reports."],
      () =>
        makeReport(
          "CHATGPT_EXTERNAL_REVIEWER",
          "EXTERNAL_ONLY_CANARY_NOT_IN_NEUTRAL_BASELINE"
        )
    );

    await expect(
      runtime.readReportFor("external", "CODEX_REVIEW")
    ).rejects.toThrow(INDEPENDENCE_ERROR_PATTERN);
    expect(
      JSON.stringify(
        runtime.buildCodexReviewInput("Review the target SHA.", [
          "Do not read local reports.",
        ])
      )
    ).not.toContain("EXTERNAL_ONLY_CANARY_NOT_IN_NEUTRAL_BASELINE");
    expect(
      runtime.state.auditEvents.some(
        (event) =>
          event.action === "EXTERNAL_REPORT_READ" &&
          event.actor === "CODEX_REVIEW" &&
          !event.allowed
      )
    ).toBe(true);

    await runtime.collectCodexReview(
      "Review the target SHA.",
      ["Do not read local reports."],
      () => makeReport("CODEX_REVIEWER")
    );
    await runtime.synthesize();
    await runtime.finalize("# Final\n\nIMPLEMENTATION_LOCKED\n");

    const state = runtime.state;
    expect(state.phase).toBe("FINAL_REPORT_READY");
    expect(state.reports.external.status).toBe("VALID");
    expect(state.reports.codex.status).toBe("VALID");
    expect(state.implementationStarted).toBe(false);
    expect(
      await runtime.store.verifyArtifact(state, "external-review.md")
    ).toBe(true);
    expect(await runtime.store.verifyArtifact(state, "codex-review.md")).toBe(
      true
    );
    expect(await runtime.store.verifyArtifact(state, "final-report.md")).toBe(
      true
    );
  });

  it("fails closed when a persisted report is tampered with", async () => {
    const runtime = await openRuntime("RUNTIME-TAMPER");
    await runtime.collectExternalReview(
      "Review the target SHA.",
      ["Do not read local reports."],
      () => makeReport("CHATGPT_EXTERNAL_REVIEWER")
    );
    await runtime.collectCodexReview(
      "Review the target SHA.",
      ["Do not read local reports."],
      () => makeReport("CODEX_REVIEWER")
    );

    const artifactPath = join(
      runtime.store.rootDirectory,
      runtime.state.caseId,
      "external-review.md"
    );
    const original = await readFile(artifactPath, "utf8");
    await writeFile(artifactPath, `${original}tampered\n`, "utf8");

    await expect(runtime.synthesize()).rejects.toThrow(INTEGRITY_ERROR_PATTERN);
    expect(runtime.state.phase).toBe("BLOCKED");
    expect(runtime.state.verdict).toBe("BLOCKED");
  });
});
