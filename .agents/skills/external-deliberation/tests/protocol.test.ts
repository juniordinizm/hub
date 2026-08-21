import { describe, expect, it } from "vitest";
import {
  beginDebate,
  buildExternalBrief,
  type CaseState,
  canImplement,
  createInitialState,
  createReviewReport,
  createWorkingTreeFingerprint,
  type DeliberationState,
  finalizeReport,
  finalizeSynthesis,
  isImplementationRequestForCase,
  markReportInvalid,
  type ReviewFinding,
  type ReviewReport,
  recordHumanDecision,
  recordReviewerFailure,
  registerReviewerConversation,
  reopenAfterMaterialFinding,
  requireHumanDecision,
  resolveDebate,
  sealReport,
  synthesizeReports,
  validateReviewReport,
} from "../src/protocol";

const CASE_ID = "HUB-EXTDEL-test-case";
const BARRIER_ERROR_PATTERN = /reports.*sealed|barrier/i;
const CASE_ID_ERROR_PATTERN = /CASE-ID/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_ROUNDS_ERROR_PATTERN = /maximum|four|round/i;
const RECONNECT_ERROR_PATTERN = /blocked|retry/i;
const THREAD_ERROR_PATTERN = /new conversation|reuse|thread/i;

const workingTree = createWorkingTreeFingerprint({
  diff: "",
  relevant: false,
  status: "",
});

const makeState = (
  overrides: Partial<Parameters<typeof createInitialState>[0]> = {}
): DeliberationState =>
  createInitialState({
    branch: "main",
    caseId: CASE_ID,
    repository: "hub",
    reviewer: {
      tabId: null,
      threadId: null,
    },
    runId: "run-1",
    targetSha: "a".repeat(40),
    taskHash: "b".repeat(64),
    workingTree,
    ...overrides,
  });

const reviewingState = (state = makeState()): DeliberationState => ({
  ...state,
  phase: "INDEPENDENT_REVIEWING",
});

const makeFinding = (
  overrides: Partial<ReviewFinding> = {}
): ReviewFinding => ({
  claim: "A protected operation lacks an authorization check.",
  confidence: "HIGH",
  impact: "Unauthorized users can invoke the operation.",
  equivalenceKey: "missing-authorization-check",
  evidence: ["src/example.ts:10"],
  evidenceKey: "example-route-auth",
  lifecycle: "OPEN",
  localId: "EXT-001",
  material: true,
  priority: 1,
  rollback: ["Revert the change."],
  scope: "the protected operation",
  semantic: {
    claimKey: "missing-authorization-check",
    impactKey: "unauthorized-operation",
    evidenceKey: "example-route-auth",
    rollbackKey: "revert-change",
    scopeKey: "protected-operation",
    validationKey: "authorization-test",
  },
  severity: "CRITICAL",
  validation: ["Run the authorization test."],
  ...overrides,
});

const makeReport = (
  actor: ReviewReport["actor"],
  findings: ReviewFinding[] = []
): ReviewReport =>
  createReviewReport({
    actor,
    claim: "The requested behavior is not ready for implementation.",
    commands: ["git status --short", "git diff --stat"],
    confidence: "HIGH",
    coverageLedger: {
      examined: ["source", "tests", "configuration"],
      withoutEvidence: ["provider runtime state"],
    },
    evidence: ["The target SHA and relevant source files were inspected."],
    findings,
    impact: "The case must remain locked until evidence is complete.",
    limitations: ["Provider runtime was not available."],
    rollback: ["Keep the case locked and revert only the approved package."],
    severity: findings.some((finding) => finding.severity === "CRITICAL")
      ? "CRITICAL"
      : "INFO",
    sources: ["AGENTS.md", "docs/README.md"],
    validation: ["Run the package-local test suite."],
    verdict: "NOT_READY",
  });

const sealBoth = (
  state: DeliberationState,
  external = makeReport("CHATGPT_EXTERNAL_REVIEWER"),
  codex = makeReport("CODEX_REVIEWER")
): DeliberationState =>
  sealReport(
    sealReport(reviewingState(state), "external", external),
    "codex",
    codex
  );

describe("external deliberation protocol barriers", () => {
  it("rejects comparison before both reports are valid and sealed", () => {
    const state = makeState();

    expect(() =>
      synthesizeReports(
        state,
        makeReport("CHATGPT_EXTERNAL_REVIEWER"),
        makeReport("CODEX_REVIEWER")
      )
    ).toThrow(BARRIER_ERROR_PATTERN);
  });

  it("reissues an invalid report without consuming a debate round", () => {
    const state = makeState();
    const validReport = makeReport("CHATGPT_EXTERNAL_REVIEWER");
    const invalid = {
      ...validReport,
      coverageLedger: {
        ...validReport.coverageLedger,
        examined: [],
      },
    };
    const validation = validateReviewReport(invalid);
    expect(validation.valid).toBe(false);

    const invalidState = markReportInvalid(
      reviewingState(state),
      "external",
      validation.errors
    );
    const reissued = sealReport(
      invalidState,
      "external",
      makeReport("CHATGPT_EXTERNAL_REVIEWER")
    );

    expect(reissued.reports.external.status).toBe("VALID");
    expect(reissued.debate.round).toBe(0);
  });

  it("treats malformed reviewer payloads as invalid reports", () => {
    const validation = validateReviewReport({} as ReviewReport);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("opens debate for a material unilateral finding", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER", [makeFinding()]);
    const codex = makeReport("CODEX_REVIEWER");
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );

    expect(synthesis.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "UNILATERAL" })])
    );
    expect(beginDebate(synthesis.state, synthesis.conflicts).phase).toBe(
      "DEBATE"
    );
  });

  it("opens debate for semantic differences", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER", [makeFinding()]);
    const codex = makeReport("CODEX_REVIEWER", [
      makeFinding({
        localId: "CODEX-001",
        severity: "MAJOR",
      }),
    ]);
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );

    expect(synthesis.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "SEMANTIC" })])
    );
  });

  it("does not open debate for a purely textual difference", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER", [makeFinding()]);
    const codex = makeReport("CODEX_REVIEWER", [
      makeFinding({
        claim: "Authorization is missing before the protected operation runs.",
        localId: "CODEX-001",
      }),
    ]);
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );

    expect(synthesis.conflicts).toHaveLength(0);
    expect(synthesis.state.agreement).toBe("AGREED");
  });

  it("limits unresolved debate to four rounds", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER", [makeFinding()]);
    const codex = makeReport("CODEX_REVIEWER");
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );
    let state = synthesis.state;

    for (let round = 0; round < 4; round += 1) {
      state = beginDebate(state, synthesis.conflicts);
      state = resolveDebate(state, synthesis.conflicts);
    }

    expect(state.phase).toBe("UNRESOLVED_DISPUTE");
    expect(state.debate.round).toBe(4);
    expect(() => beginDebate(state, synthesis.conflicts)).toThrow(
      MAX_ROUNDS_ERROR_PATTERN
    );
  });

  it("keeps consensus separate from readiness when a critical finding is agreed but open", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER", [makeFinding()]);
    const codex = makeReport("CODEX_REVIEWER", [
      makeFinding({ localId: "CODEX-001" }),
    ]);
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );
    const state = finalizeSynthesis(
      synthesis.state,
      synthesis.canonicalFindings
    );

    expect(state.phase).toBe("CONSENSUS_NOT_READY");
    expect(state.agreement).toBe("AGREED");
    expect(state.readiness).toBe("NOT_READY");
  });

  it("blocks consensus when the relevant working tree is dirty but allows unrelated dirt", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER");
    const codex = makeReport("CODEX_REVIEWER");
    const unrelated = makeState({
      workingTree: createWorkingTreeFingerprint({
        diff: "unrelated diff",
        relevant: false,
        status: " M docs/unrelated.md",
      }),
    });
    const relevant = makeState({
      workingTree: createWorkingTreeFingerprint({
        diff: "relevant diff",
        relevant: true,
        status: " M .agents/skills/external-deliberation/SKILL.md",
      }),
    });

    const unrelatedResult = synthesizeReports(
      sealBoth(unrelated, external, codex),
      external,
      codex
    );
    const relevantResult = synthesizeReports(
      sealBoth(relevant, external, codex),
      external,
      codex
    );

    expect(
      finalizeSynthesis(
        unrelatedResult.state,
        unrelatedResult.canonicalFindings
      ).phase
    ).toBe("CONSENSUS_READY");
    expect(
      finalizeSynthesis(relevantResult.state, relevantResult.canonicalFindings)
        .agreement
    ).toBe("UNRESOLVED");
  });

  it("blocks implementation from an unresolved dispute", () => {
    let state = reviewingState();
    state = {
      ...state,
      phase: "UNRESOLVED_DISPUTE" as CaseState,
      authorization: "LOCKED",
    };

    expect(canImplement(state)).toBe(false);
  });

  it("enters BLOCKED after three reviewer failures", () => {
    let state = reviewingState(
      makeState({
        phase: "INDEPENDENT_REVIEWING",
      })
    );
    state = recordReviewerFailure(state);
    state = recordReviewerFailure(state);
    state = recordReviewerFailure(state);

    expect(state.reviewer.reconnectAttempts).toBe(3);
    expect(state.phase).toBe("BLOCKED");
    expect(() => recordReviewerFailure(state)).toThrow(RECONNECT_ERROR_PATTERN);
  });

  it("requires a new reviewer conversation per case", () => {
    const state = makeState();
    const started = registerReviewerConversation(state, {
      tabId: "tab-a",
      threadId: "thread-a",
      usedThreadIds: [],
    });

    expect(started.reviewer.threadId).toBe("thread-a");
    expect(() =>
      registerReviewerConversation(makeState({ caseId: "another-case" }), {
        tabId: "tab-b",
        threadId: "thread-a",
        usedThreadIds: ["thread-a"],
      })
    ).toThrow(THREAD_ERROR_PATTERN);
  });

  it("rejects ambiguous authorization and accepts only an explicit CASE-ID request", () => {
    expect(isImplementationRequestForCase("sim", CASE_ID)).toBe(false);
    expect(
      isImplementationRequestForCase(
        `Implementar o plano do CASE-ID ${CASE_ID}`,
        CASE_ID
      )
    ).toBe(true);
    expect(
      isImplementationRequestForCase(
        "Implementar o plano do CASE-ID another-case",
        CASE_ID
      )
    ).toBe(false);
  });

  it("reopens a closed case for a material post-implementation finding", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER");
    const codex = makeReport("CODEX_REVIEWER");
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );
    const consensus = finalizeSynthesis(
      synthesis.state,
      synthesis.canonicalFindings
    );
    const final = finalizeReport(consensus, "IMPLEMENTATION_LOCKED\n");
    const reopened = reopenAfterMaterialFinding(
      final,
      "post-implementation regression"
    );

    expect(reopened.phase).toBe("CASE_OPENED");
    expect(reopened.authorization).toBe("LOCKED");
    expect(reopened.implementationStarted).toBe(false);
  });

  it("keeps final-report generation separate from explicit human authorization", () => {
    const external = makeReport("CHATGPT_EXTERNAL_REVIEWER");
    const codex = makeReport("CODEX_REVIEWER");
    const synthesis = synthesizeReports(
      sealBoth(makeState(), external, codex),
      external,
      codex
    );
    const consensus = finalizeSynthesis(
      synthesis.state,
      synthesis.canonicalFindings
    );
    const final = finalizeReport(consensus, "IMPLEMENTATION_LOCKED\n");
    const awaitingDecision = requireHumanDecision(final);

    expect(awaitingDecision.authorization).toBe("LOCKED");
    expect(() => recordHumanDecision(awaitingDecision, "sim")).toThrow(
      CASE_ID_ERROR_PATTERN
    );

    const approved = recordHumanDecision(
      awaitingDecision,
      `Implementar o plano do CASE-ID ${CASE_ID}`
    );
    expect(approved.authorization).toBe("HUMAN_APPROVED");
    expect(approved.implementationStarted).toBe(false);
    expect(canImplement(approved)).toBe(true);
  });

  it("builds an external brief from an explicit allowlist", () => {
    const brief = buildExternalBrief({
      caseId: CASE_ID,
      restrictions: ["Do not read local reports."],
      targetSha: "a".repeat(40),
      task: "Review the target SHA.",
    });

    expect(brief).toEqual({
      caseId: CASE_ID,
      restrictions: ["Do not read local reports."],
      targetSha: "a".repeat(40),
      task: "Review the target SHA.",
    });
    expect(JSON.stringify(brief)).not.toContain("external-review.md");
  });

  it("detects likely secrets without persisting raw diff content", () => {
    const fingerprint = createWorkingTreeFingerprint({
      diff: "API_KEY=secret-canary-value",
      relevant: true,
      status: " M .env.local",
    });

    expect("diff" in fingerprint).toBe(false);
    expect(fingerprint.diffSha256).toMatch(HASH_PATTERN);
    expect(fingerprint.secretScan.status).toBe("BLOCKED");
    expect(JSON.stringify(fingerprint)).not.toContain("secret-canary-value");
  });
});
