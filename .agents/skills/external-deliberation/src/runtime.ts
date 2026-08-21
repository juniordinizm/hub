import type { CaseStore } from "./case-store";
import {
  buildExternalBrief,
  type CaseState,
  canonicalJson,
  createInitialState,
  type DeliberationState,
  finalizeReport,
  finalizeSynthesis,
  markReportInvalid,
  ProtocolError,
  type ReviewReport,
  recordAuditEvent,
  recordReviewerFailure,
  registerReviewerConversation,
  requireHumanDecision,
  type SynthesisResult,
  sealReport,
  synthesizeReports,
  transitionState,
  validateReviewReport,
} from "./protocol";

export interface RuntimeCaseInput {
  readonly baselineMarkdown: string;
  readonly branch: string;
  readonly caseId: string;
  readonly repository: string;
  readonly reviewer: Pick<DeliberationState["reviewer"], "tabId" | "threadId">;
  readonly runId: string;
  readonly targetSha: string;
  readonly taskHash: string;
  readonly workingTree: DeliberationState["workingTree"];
}

export interface CodexReviewInput {
  readonly caseId: string;
  readonly restrictions: readonly string[];
  readonly source: "NEUTRAL_BASELINE";
  readonly targetSha: string;
  readonly task: string;
}

export type ExternalReviewProducer = (
  brief: ReturnType<typeof buildExternalBrief>
) => ReviewReport | Promise<ReviewReport>;

export type CodexReviewProducer = (
  input: CodexReviewInput
) => ReviewReport | Promise<ReviewReport>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const synthesisMarkdown = (result: SynthesisResult): string =>
  [
    "# Synthesis",
    "",
    "<!-- external-deliberation-synthesis:v1 -->",
    "",
    "```json",
    canonicalJson({
      canonicalFindings: result.canonicalFindings,
      conflicts: result.conflicts,
    }),
    "```",
    "",
  ].join("\n");

export class DeliberationRuntime {
  readonly store: CaseStore;
  private currentState: DeliberationState;
  private lastSynthesis: SynthesisResult | null = null;

  constructor(store: CaseStore, state: DeliberationState) {
    this.store = store;
    this.currentState = state;
  }

  static async open(
    store: CaseStore,
    input: RuntimeCaseInput
  ): Promise<DeliberationRuntime> {
    const runtime = new DeliberationRuntime(
      store,
      createInitialState({
        branch: input.branch,
        caseId: input.caseId,
        repository: input.repository,
        reviewer: input.reviewer,
        runId: input.runId,
        targetSha: input.targetSha,
        taskHash: input.taskHash,
        workingTree: input.workingTree,
      })
    );
    await runtime.persist();
    await runtime.advance("CASE_OPENED", "CASE_OPENED");
    await runtime.advance("BASELINED", "BASELINE_CAPTURED");
    runtime.currentState = await store.writeMarkdown(
      runtime.currentState,
      "baseline.md",
      input.baselineMarkdown
    );
    await runtime.advance("CONTEXT_READY", "CONTEXT_LOADED");
    await runtime.advance(
      "INDEPENDENT_REVIEWING",
      "INDEPENDENT_REVIEWS_STARTED"
    );
    return runtime;
  }

  get state(): DeliberationState {
    return JSON.parse(JSON.stringify(this.currentState)) as DeliberationState;
  }

  get synthesis(): SynthesisResult | null {
    return this.lastSynthesis
      ? (JSON.parse(JSON.stringify(this.lastSynthesis)) as SynthesisResult)
      : null;
  }

  async advance(
    nextPhase: CaseState,
    action: string
  ): Promise<DeliberationState> {
    const next = transitionState(this.currentState, nextPhase);
    this.currentState = recordAuditEvent(next, {
      action,
      actor: "SYSTEM",
      allowed: true,
      reason: null,
    });
    await this.persist();
    return this.state;
  }

  async registerReviewerConversation(input: {
    readonly tabId: string;
    readonly threadId: string;
    readonly usedThreadIds: readonly string[];
  }): Promise<DeliberationState> {
    const next = registerReviewerConversation(this.currentState, input);
    this.currentState = recordAuditEvent(next, {
      action: "REVIEWER_CONVERSATION_REGISTERED",
      actor: "SYSTEM",
      allowed: true,
      reason: null,
    });
    await this.persist();
    return this.state;
  }

  buildExternalReviewBrief(
    task: string,
    restrictions: readonly string[]
  ): ReturnType<typeof buildExternalBrief> {
    return buildExternalBrief({
      caseId: this.currentState.caseId,
      restrictions,
      targetSha: this.currentState.targetSha,
      task,
    });
  }

  buildCodexReviewInput(
    task: string,
    restrictions: readonly string[]
  ): CodexReviewInput {
    return {
      caseId: this.currentState.caseId,
      restrictions: [...restrictions],
      source: "NEUTRAL_BASELINE",
      targetSha: this.currentState.targetSha,
      task,
    };
  }

  async collectExternalReview(
    task: string,
    restrictions: readonly string[],
    produce: ExternalReviewProducer
  ): Promise<DeliberationState> {
    this.assertReviewing();
    const brief = this.buildExternalReviewBrief(task, restrictions);
    await this.audit("EXTERNAL_BRIEF_SENT", "EXTERNAL_REVIEWER", true, null);
    let report: ReviewReport;
    try {
      report = await produce(brief);
    } catch (error) {
      await this.registerReviewerFailure(errorMessage(error));
      throw error;
    }
    return this.sealAndPersist("external", report);
  }

  async collectCodexReview(
    task: string,
    restrictions: readonly string[],
    produce: CodexReviewProducer
  ): Promise<DeliberationState> {
    this.assertReviewing();
    const input = this.buildCodexReviewInput(task, restrictions);
    await this.audit("CODEX_NEUTRAL_INPUT_OPENED", "CODEX_REVIEW", true, null);
    const report = await produce(input);
    return this.sealAndPersist("codex", report);
  }

  async readReportFor(
    side: "external" | "codex",
    actor: "CODEX_REVIEW" | "COMPARATOR"
  ): Promise<ReviewReport> {
    if (
      side === "external" &&
      actor === "CODEX_REVIEW" &&
      this.currentState.reports.codex.status !== "VALID"
    ) {
      await this.audit(
        "EXTERNAL_REPORT_READ",
        actor,
        false,
        "Codex report is not VALID and sealed."
      );
      throw new ProtocolError(
        "The external report is unreadable by Codex until codex-review is VALID and sealed."
      );
    }
    if (
      actor === "COMPARATOR" &&
      this.currentState.phase !== "REPORTS_SEALED"
    ) {
      await this.audit(
        "REPORT_READ",
        actor,
        false,
        "Comparison requires REPORTS_SEALED."
      );
      throw new ProtocolError(
        "Reports are unreadable by the comparator before REPORTS_SEALED."
      );
    }
    try {
      const report = await this.store.readReviewReport(this.currentState, side);
      await this.audit("REPORT_READ", actor, true, null);
      return report;
    } catch (error) {
      await this.blockIntegrity(
        `${side} report integrity failure: ${errorMessage(error)}`
      );
      throw error;
    }
  }

  async synthesize(): Promise<SynthesisResult> {
    const external = await this.readReportFor("external", "COMPARATOR");
    const codex = await this.readReportFor("codex", "COMPARATOR");
    const result = synthesizeReports(this.currentState, external, codex);
    this.lastSynthesis = result;
    const next = recordAuditEvent(result.state, {
      action: "SYNTHESIS_CREATED",
      actor: "COMPARATOR",
      allowed: true,
      reason: null,
    });
    this.currentState = await this.store.writeMarkdown(
      next,
      "synthesis.md",
      synthesisMarkdown(result)
    );
    return this.synthesis as SynthesisResult;
  }

  async finalize(markdown: string): Promise<DeliberationState> {
    if (!this.lastSynthesis) {
      throw new ProtocolError(
        "A synthesis is required before the final report."
      );
    }
    const consensus = finalizeSynthesis(
      this.currentState,
      this.lastSynthesis.canonicalFindings
    );
    const finalState = finalizeReport(consensus, markdown);
    const next = recordAuditEvent(finalState, {
      action: "FINAL_REPORT_SEALED",
      actor: "SYSTEM",
      allowed: true,
      reason: null,
    });
    this.currentState = await this.store.writeMarkdown(
      next,
      "final-report.md",
      markdown
    );
    return this.state;
  }

  async requestHumanDecision(): Promise<DeliberationState> {
    const next = requireHumanDecision(this.currentState);
    this.currentState = recordAuditEvent(next, {
      action: "HUMAN_DECISION_REQUESTED",
      actor: "SYSTEM",
      allowed: true,
      reason: null,
    });
    await this.persist();
    return this.state;
  }

  async registerReviewerFailure(reason: string): Promise<DeliberationState> {
    const next = recordReviewerFailure(this.currentState);
    this.currentState = recordAuditEvent(next, {
      action: "REVIEWER_RECONNECT_FAILED",
      actor: "EXTERNAL_REVIEWER",
      allowed: false,
      reason,
    });
    await this.persist();
    return this.state;
  }

  private assertReviewing(): void {
    if (this.currentState.phase !== "INDEPENDENT_REVIEWING") {
      throw new ProtocolError(
        "Independent review input is available only during INDEPENDENT_REVIEWING."
      );
    }
  }

  private async sealAndPersist(
    side: "external" | "codex",
    report: ReviewReport
  ): Promise<DeliberationState> {
    const validation = validateReviewReport(report);
    if (!validation.valid) {
      const invalid = markReportInvalid(
        this.currentState,
        side,
        validation.errors
      );
      this.currentState = recordAuditEvent(invalid, {
        action: "REPORT_REJECTED",
        actor: side === "external" ? "EXTERNAL_REVIEWER" : "CODEX_REVIEW",
        allowed: false,
        reason: validation.errors.join(" "),
      });
      await this.persist();
      throw new ProtocolError(
        `Cannot seal invalid ${side} report: ${validation.errors.join(" ")}`
      );
    }
    const sealed = sealReport(this.currentState, side, report);
    const next = recordAuditEvent(sealed, {
      action: "REPORT_SEALED",
      actor: side === "external" ? "EXTERNAL_REVIEWER" : "CODEX_REVIEW",
      allowed: true,
      reason: null,
    });
    this.currentState = await this.store.writeReviewReport(next, side, report);
    return this.state;
  }

  private async blockIntegrity(reason: string): Promise<void> {
    let next = this.currentState;
    if (next.phase !== "BLOCKED") {
      next = transitionState(next, "BLOCKED");
    }
    next.verdict = "BLOCKED";
    next.authorization = "LOCKED";
    this.currentState = recordAuditEvent(next, {
      action: "INTEGRITY_GATE_FAILED",
      actor: "SYSTEM",
      allowed: false,
      reason,
    });
    await this.persist();
  }

  private async audit(
    action: string,
    actor: "CODEX_REVIEW" | "COMPARATOR" | "EXTERNAL_REVIEWER" | "SYSTEM",
    allowed: boolean,
    reason: string | null
  ): Promise<void> {
    this.currentState = recordAuditEvent(this.currentState, {
      action,
      actor,
      allowed,
      reason,
    });
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.store.initialize(this.currentState);
  }
}
