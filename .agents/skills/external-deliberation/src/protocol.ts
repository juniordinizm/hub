import { createHash } from "node:crypto";

export const CASE_STATES = [
  "IDLE",
  "CASE_OPENED",
  "BASELINED",
  "CONTEXT_READY",
  "INDEPENDENT_REVIEWING",
  "REPORTS_SEALED",
  "SYNTHESIS",
  "DEBATE",
  "CONSENSUS_NOT_READY",
  "CONSENSUS_READY",
  "UNRESOLVED_DISPUTE",
  "FINAL_REPORT_READY",
  "HUMAN_DECISION_REQUIRED",
  "BLOCKED",
  "CLOSED",
] as const;

export type CaseState = (typeof CASE_STATES)[number];
export type ReportSide = "external" | "codex";
export type ReviewActor = "CHATGPT_EXTERNAL_REVIEWER" | "CODEX_REVIEWER";
export type ReportStatus = "PENDING" | "INVALID" | "VALID";
export type Severity = "CRITICAL" | "MAJOR" | "MINOR" | "INFO";
export type Lifecycle = "OPEN" | "VERIFIED" | "REJECTED" | "NEEDS_EVIDENCE";
export type Agreement = "AGREED" | "DIVERGENT" | "UNRESOLVED";
export type Readiness = "READY" | "NOT_READY" | "UNRESOLVED";
export type Authorization = "LOCKED" | "HUMAN_APPROVED" | "HUMAN_REJECTED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
const REVIEW_ACTORS = [
  "CHATGPT_EXTERNAL_REVIEWER",
  "CODEX_REVIEWER",
] as const satisfies readonly ReviewActor[];
const SEVERITIES = [
  "CRITICAL",
  "MAJOR",
  "MINOR",
  "INFO",
] as const satisfies readonly Severity[];
const LIFECYCLES = [
  "OPEN",
  "VERIFIED",
  "REJECTED",
  "NEEDS_EVIDENCE",
] as const satisfies readonly Lifecycle[];
const CONFIDENCES = [
  "HIGH",
  "MEDIUM",
  "LOW",
] as const satisfies readonly Confidence[];
export type Verdict =
  | "PENDING"
  | "READY"
  | "NOT_READY"
  | "UNRESOLVED"
  | "BLOCKED";

export const MAX_DEBATE_ROUNDS = 4;
export const MAX_RECONNECT_ATTEMPTS = 3;

type SecretScanStatus = "PASS" | "BLOCKED";
type WorkingTreeScope = "CLEAN" | "DIRTY_UNRELATED" | "DIRTY_RELEVANT";

export interface SecretScan {
  readonly matchTypes: readonly string[];
  readonly status: SecretScanStatus;
  readonly version: "heuristic-v1";
}

export interface WorkingTreeFingerprint {
  readonly changedPaths: readonly string[];
  readonly diffSha256: string;
  readonly dirty: boolean;
  readonly scope: WorkingTreeScope;
  readonly secretScan: SecretScan;
  readonly status: string;
}

export interface FindingSemanticKeys {
  readonly claimKey: string;
  readonly evidenceKey: string;
  readonly impactKey: string;
  readonly rollbackKey: string;
  readonly scopeKey: string;
  readonly validationKey: string;
}

export interface ReviewFinding {
  readonly claim: string;
  readonly confidence: Confidence;
  readonly equivalenceKey: string;
  readonly evidence: readonly string[];
  readonly evidenceKey: string;
  readonly impact: string;
  readonly lifecycle: Lifecycle;
  readonly localId: string;
  readonly material: boolean;
  readonly priority: number;
  readonly rollback: readonly string[];
  readonly scope: string;
  readonly semantic: FindingSemanticKeys;
  readonly severity: Severity;
  readonly validation: readonly string[];
}

export interface CoverageLedger {
  readonly examined: readonly string[];
  readonly withoutEvidence: readonly string[];
}

export interface ReviewReport {
  readonly actor: ReviewActor;
  readonly claim: string;
  readonly commands: readonly string[];
  readonly confidence: Confidence;
  readonly coverageLedger: CoverageLedger;
  readonly evidence: readonly string[];
  readonly findings: readonly ReviewFinding[];
  readonly impact: string;
  readonly limitations: readonly string[];
  readonly rollback: readonly string[];
  readonly schemaVersion: 1;
  readonly severity: Severity;
  readonly sources: readonly string[];
  readonly validation: readonly string[];
  readonly verdict: Exclude<Verdict, "PENDING" | "BLOCKED">;
}

export interface ReportSlot {
  hash: string | null;
  invalidReasons: string[];
  reissueCount: number;
  sealed: boolean;
  status: ReportStatus;
}

export type AuditActor =
  | "CODEX_REVIEW"
  | "COMPARATOR"
  | "EXTERNAL_REVIEWER"
  | "SYSTEM";

export interface AuditEvent {
  readonly action: string;
  readonly actor: AuditActor;
  readonly allowed: boolean;
  readonly codexStatus: ReportStatus;
  readonly externalStatus: ReportStatus;
  readonly ordinal: number;
  readonly phase: CaseState;
  readonly reason: string | null;
}

export interface ArtifactRecord {
  readonly kind: "JSON" | "MARKDOWN";
  readonly path: string;
  readonly sha256: string;
  readonly status: "SEALED" | "TAMPERED";
}

export interface ReviewerSession {
  caseId: string;
  maxReconnectAttempts: 3;
  newConversationRequired: true;
  reconnectAttempts: number;
  tabId: string | null;
  threadId: string | null;
}

export interface DebateState {
  maxRounds: 4;
  openConflictIds: string[];
  round: number;
}

export interface DeliberationState {
  agreement: Agreement;
  artifacts: Record<string, ArtifactRecord>;
  auditEvents: AuditEvent[];
  authorization: Authorization;
  branch: string;
  caseId: string;
  debate: DebateState;
  humanDecision: "PENDING" | "APPROVED" | "REJECTED";
  implementationStarted: boolean;
  phase: CaseState;
  readiness: Readiness;
  reopenCount: number;
  reopenReason: string | null;
  reports: Record<ReportSide, ReportSlot>;
  repository: string;
  reviewer: ReviewerSession;
  runId: string;
  schemaVersion: 1;
  targetSha: string;
  taskHash: string;
  verdict: Verdict;
  workingTree: WorkingTreeFingerprint;
}

export interface CanonicalFinding {
  readonly agreement: Agreement;
  readonly claim: string;
  readonly codexLocalIds: readonly string[];
  readonly confidence: Confidence;
  readonly evidence: readonly string[];
  readonly externalLocalIds: readonly string[];
  readonly id: string;
  readonly impact: string;
  readonly lifecycle: Lifecycle;
  readonly material: boolean;
  readonly priority: number;
  readonly rollback: readonly string[];
  readonly scope: string;
  readonly severity: Severity;
  readonly validation: readonly string[];
}

export interface DebateConflict {
  readonly canonicalFindingId: string;
  readonly codexLocalIds: readonly string[];
  readonly dimensions: readonly string[];
  readonly externalLocalIds: readonly string[];
  readonly id: string;
  readonly kind: "UNILATERAL" | "SEMANTIC";
  readonly material: boolean;
}

export interface SynthesisResult {
  readonly canonicalFindings: readonly CanonicalFinding[];
  readonly conflicts: readonly DebateConflict[];
  readonly state: DeliberationState;
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

const ALLOWED_TRANSITIONS: Record<CaseState, readonly CaseState[]> = {
  IDLE: ["CASE_OPENED", "BLOCKED"],
  CASE_OPENED: ["BASELINED", "BLOCKED"],
  BASELINED: ["CONTEXT_READY", "BLOCKED"],
  CONTEXT_READY: ["INDEPENDENT_REVIEWING", "BLOCKED"],
  INDEPENDENT_REVIEWING: ["REPORTS_SEALED", "BLOCKED"],
  REPORTS_SEALED: ["SYNTHESIS", "INDEPENDENT_REVIEWING", "BLOCKED"],
  SYNTHESIS: [
    "DEBATE",
    "CONSENSUS_NOT_READY",
    "CONSENSUS_READY",
    "UNRESOLVED_DISPUTE",
    "BLOCKED",
  ],
  DEBATE: ["SYNTHESIS", "UNRESOLVED_DISPUTE", "BLOCKED"],
  CONSENSUS_NOT_READY: ["FINAL_REPORT_READY", "DEBATE", "BLOCKED"],
  CONSENSUS_READY: ["FINAL_REPORT_READY", "DEBATE", "BLOCKED"],
  UNRESOLVED_DISPUTE: ["FINAL_REPORT_READY", "CASE_OPENED", "BLOCKED"],
  FINAL_REPORT_READY: ["HUMAN_DECISION_REQUIRED", "CLOSED"],
  HUMAN_DECISION_REQUIRED: ["CLOSED", "CASE_OPENED"],
  BLOCKED: ["FINAL_REPORT_READY", "CASE_OPENED", "CLOSED"],
  CLOSED: ["CASE_OPENED"],
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(
  value: unknown,
  values: readonly T[]
): value is T => typeof value === "string" && values.includes(value as T);

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const canonicalJson = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new ProtocolError("Only JSON-compatible values can be canonicalized.");
};

export const hashMarkdown = (content: string): string => sha256(content);

export const hashCanonicalJson = (value: unknown): string =>
  sha256(canonicalJson(value));

const potentialSecretPatterns: readonly [string, RegExp][] = [
  ["private-key", /-----BEGIN [A-Z ]+ PRIVATE KEY-----/i],
  [
    "named-secret",
    /(?:api[_-]?key|secret|token|password|authorization)\s*[:=]\s*[^\s'"`]+/i,
  ],
  ["provider-token", /\b(?:sk|ghp|github_pat|xoxb|AKIA)[A-Za-z0-9_-]{8,}\b/],
];

const LINE_BREAK_PATTERN = /\r?\n/;
const SHA1_PATTERN = /^[a-f0-9]{40}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const STATUS_PREFIX_PATTERN = /^[MADRCU?!]{1,2}\s+/;
const QUOTE_BOUNDARY_PATTERN = /^"|"$/g;
const REPORT_JSON_BLOCK_PATTERN =
  /<!-- external-deliberation-report:v1 -->\s*```json\s*([\s\S]*?)\s*```/;
const REPORT_MARKER = "<!-- external-deliberation-report:v1 -->";

export const scanTextForPotentialSecrets = (
  content: string
): readonly string[] =>
  potentialSecretPatterns
    .filter(([, pattern]) => pattern.test(content))
    .map(([name]) => name);

const changedPathsFromStatus = (status: string): string[] =>
  status
    .split(LINE_BREAK_PATTERN)
    .map((line) => line.trim().replace(STATUS_PREFIX_PATTERN, ""))
    .map((line) => line.replace(QUOTE_BOUNDARY_PATTERN, ""))
    .filter(nonEmpty);

export const createWorkingTreeFingerprint = ({
  diff,
  relevant,
  status,
}: {
  diff: string;
  relevant: boolean;
  status: string;
}): WorkingTreeFingerprint => {
  const dirty = status.trim().length > 0 || diff.length > 0;
  const matchTypes = scanTextForPotentialSecrets(diff);
  let scope: WorkingTreeScope = "CLEAN";
  if (dirty) {
    scope = relevant ? "DIRTY_RELEVANT" : "DIRTY_UNRELATED";
  }

  return {
    changedPaths: changedPathsFromStatus(status),
    diffSha256: sha256(diff),
    dirty,
    scope,
    secretScan: {
      matchTypes,
      status: matchTypes.length > 0 ? "BLOCKED" : "PASS",
      version: "heuristic-v1",
    },
    status,
  };
};

const initialReportSlot = (): ReportSlot => ({
  hash: null,
  invalidReasons: [],
  reissueCount: 0,
  sealed: false,
  status: "PENDING",
});

export const createInitialState = ({
  branch,
  caseId,
  repository,
  reviewer,
  runId,
  targetSha,
  taskHash,
  workingTree,
}: {
  branch: string;
  caseId: string;
  repository: string;
  reviewer: Pick<ReviewerSession, "tabId" | "threadId">;
  runId: string;
  targetSha: string;
  taskHash: string;
  workingTree: WorkingTreeFingerprint;
}): DeliberationState => {
  if (!SHA1_PATTERN.test(targetSha)) {
    throw new ProtocolError(
      "targetSha must be a 40-character hexadecimal SHA."
    );
  }
  if (!SHA256_PATTERN.test(taskHash)) {
    throw new ProtocolError(
      "taskHash must be a 64-character hexadecimal SHA-256."
    );
  }
  if (![caseId, repository, branch, runId].every(nonEmpty)) {
    throw new ProtocolError(
      "caseId, repository, branch, and runId are required."
    );
  }

  return {
    agreement: "UNRESOLVED",
    auditEvents: [],
    artifacts: {},
    authorization: "LOCKED",
    debate: {
      maxRounds: MAX_DEBATE_ROUNDS,
      openConflictIds: [],
      round: 0,
    },
    humanDecision: "PENDING",
    implementationStarted: false,
    caseId,
    branch,
    phase: "IDLE",
    readiness: "UNRESOLVED",
    reopenCount: 0,
    reopenReason: null,
    reports: {
      codex: initialReportSlot(),
      external: initialReportSlot(),
    },
    repository,
    reviewer: {
      caseId,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      newConversationRequired: true,
      reconnectAttempts: 0,
      tabId: reviewer.tabId,
      threadId: reviewer.threadId,
    },
    runId,
    schemaVersion: 1,
    targetSha,
    taskHash,
    verdict: "PENDING",
    workingTree,
  };
};

export const transitionState = (
  state: DeliberationState,
  nextPhase: CaseState
): DeliberationState => {
  if (!ALLOWED_TRANSITIONS[state.phase].includes(nextPhase)) {
    throw new ProtocolError(
      `Invalid transition ${state.phase} -> ${nextPhase}.`
    );
  }
  return {
    ...clone(state),
    phase: nextPhase,
  };
};

export const recordAuditEvent = (
  state: DeliberationState,
  input: Omit<
    AuditEvent,
    "codexStatus" | "externalStatus" | "ordinal" | "phase"
  >
): DeliberationState => {
  const next = clone(state);
  next.auditEvents.push({
    ...input,
    codexStatus: state.reports.codex.status,
    externalStatus: state.reports.external.status,
    ordinal: state.auditEvents.length + 1,
    phase: state.phase,
  });
  return next;
};

const reportPrefix = (actor: ReviewActor): string =>
  actor === "CHATGPT_EXTERNAL_REVIEWER" ? "EXT-" : "CODEX-";

export const createReviewReport = (
  input: Omit<ReviewReport, "schemaVersion">
): ReviewReport => ({
  schemaVersion: 1,
  ...input,
});

const validateRequiredStrings = (
  fields: readonly [string, unknown][]
): string[] => {
  const errors: string[] = [];
  for (const [name, value] of fields) {
    if (!nonEmpty(value)) {
      errors.push(`${name} is required.`);
    }
  }
  return errors;
};

const validateRequiredArrays = (
  fields: readonly [string, unknown][]
): string[] => {
  const errors: string[] = [];
  for (const [name, values] of fields) {
    if (!Array.isArray(values)) {
      errors.push(`${name} must be an array.`);
    } else if (values.length === 0) {
      errors.push(`${name} must contain at least one entry.`);
    }
  }
  return errors;
};

const validateFinding = (
  finding: unknown,
  expectedPrefix: string,
  ids: Set<string>
): string[] => {
  const errors: string[] = [];
  if (!isRecord(finding)) {
    return ["Finding must be an object."];
  }
  const localId =
    typeof finding.localId === "string" ? finding.localId : "<missing>";
  if (!localId.startsWith(expectedPrefix)) {
    errors.push(`Finding ${localId} must use the ${expectedPrefix} prefix.`);
  }
  if (ids.has(localId)) {
    errors.push(`Finding ${localId} is duplicated.`);
  }
  ids.add(localId);
  if (!isOneOf(finding.severity, SEVERITIES)) {
    errors.push(`severity is invalid for ${localId}.`);
  }
  if (!isOneOf(finding.confidence, CONFIDENCES)) {
    errors.push(`confidence is invalid for ${localId}.`);
  }
  if (!isOneOf(finding.lifecycle, LIFECYCLES)) {
    errors.push(`lifecycle is invalid for ${localId}.`);
  }
  if (typeof finding.material !== "boolean") {
    errors.push(`material must be boolean for ${localId}.`);
  }
  if (
    typeof finding.priority !== "number" ||
    !Number.isInteger(finding.priority)
  ) {
    errors.push(`priority must be an integer for ${localId}.`);
  }
  const semantic = isRecord(finding.semantic) ? finding.semantic : {};
  if (!isRecord(finding.semantic)) {
    errors.push(`semantic must be an object for ${localId}.`);
  }

  errors.push(
    ...validateRequiredStrings([
      ["equivalenceKey", finding.equivalenceKey],
      ["claim", finding.claim],
      ["scope", finding.scope],
      ["impact", finding.impact],
      ["evidenceKey", finding.evidenceKey],
      ["semantic.claimKey", semantic.claimKey],
      ["semantic.scopeKey", semantic.scopeKey],
      ["semantic.evidenceKey", semantic.evidenceKey],
      ["semantic.impactKey", semantic.impactKey],
      ["semantic.validationKey", semantic.validationKey],
      ["semantic.rollbackKey", semantic.rollbackKey],
    ])
  );
  errors.push(
    ...validateRequiredArrays([
      ["evidence", finding.evidence],
      ["validation", finding.validation],
      ["rollback", finding.rollback],
    ]).map((error) => `${error.slice(0, -1)} for ${localId}.`)
  );
  return errors;
};

export const validateReviewReport = (
  report: ReviewReport
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!isRecord(report)) {
    return { errors: ["report must be an object."], valid: false };
  }
  if (report.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }
  if (!isOneOf(report.actor, REVIEW_ACTORS)) {
    errors.push("actor must identify the external reviewer or Codex reviewer.");
  }
  if (!isOneOf(report.severity, SEVERITIES)) {
    errors.push("severity must be one of CRITICAL, MAJOR, MINOR, or INFO.");
  }
  if (!isOneOf(report.confidence, CONFIDENCES)) {
    errors.push("confidence must be HIGH, MEDIUM, or LOW.");
  }
  if (!isOneOf(report.verdict, ["READY", "NOT_READY", "UNRESOLVED"] as const)) {
    errors.push("verdict must be READY, NOT_READY, or UNRESOLVED.");
  }
  errors.push(
    ...validateRequiredStrings([
      ["claim", report.claim],
      ["impact", report.impact],
    ])
  );
  const coverageLedger = isRecord(report.coverageLedger)
    ? report.coverageLedger
    : null;
  if (coverageLedger) {
    errors.push(
      ...validateRequiredArrays([
        ["coverageLedger.examined", coverageLedger.examined],
      ])
    );
    if (!Array.isArray(coverageLedger.withoutEvidence)) {
      errors.push("coverageLedger.withoutEvidence must be an array.");
    }
  } else {
    errors.push("coverageLedger must be an object.");
  }
  errors.push(
    ...validateRequiredArrays([
      ["evidence", report.evidence],
      ["validation", report.validation],
      ["rollback", report.rollback],
      ["limitations", report.limitations],
      ["sources", report.sources],
      ["commands", report.commands],
    ])
  );

  const ids = new Set<string>();
  const expectedPrefix = isOneOf(report.actor, REVIEW_ACTORS)
    ? reportPrefix(report.actor)
    : "INVALID-";
  if (Array.isArray(report.findings)) {
    for (const finding of report.findings) {
      errors.push(...validateFinding(finding, expectedPrefix, ids));
    }
  } else {
    errors.push("findings must be an array.");
  }

  return { errors, valid: errors.length === 0 };
};

export const reportArtifactName = (side: ReportSide): string =>
  side === "external" ? "external-review.md" : "codex-review.md";

export const serializeReviewReport = (report: ReviewReport): string => {
  const validation = validateReviewReport(report);
  if (!validation.valid) {
    throw new ProtocolError(
      `Cannot serialize invalid report: ${validation.errors.join(" ")}`
    );
  }
  const content = [
    "# External Deliberation Review",
    "",
    REPORT_MARKER,
    "",
    "```json",
    canonicalJson(report),
    "```",
    "",
  ].join("\n");
  const secretMatches = scanTextForPotentialSecrets(content);
  if (secretMatches.length > 0) {
    throw new ProtocolError(
      `Review artifact resembles a secret: ${secretMatches.join(", ")}`
    );
  }
  return content;
};

export const deserializeReviewReport = (content: string): ReviewReport => {
  const match = REPORT_JSON_BLOCK_PATTERN.exec(content);
  if (!match?.[1]) {
    throw new ProtocolError(
      "Review artifact does not contain its v1 report block."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new ProtocolError("Review artifact contains invalid report JSON.");
  }
  const report = parsed as ReviewReport;
  const validation = validateReviewReport(report);
  if (!validation.valid) {
    throw new ProtocolError(
      `Review artifact contains an invalid report: ${validation.errors.join(" ")}`
    );
  }
  return report;
};

export const markReportInvalid = (
  state: DeliberationState,
  side: ReportSide,
  errors: readonly string[]
): DeliberationState => {
  if (errors.length === 0) {
    throw new ProtocolError(
      "An invalid report must record at least one validation error."
    );
  }
  const next = clone(state);
  next.reports[side] = {
    hash: null,
    invalidReasons: [...errors],
    reissueCount: next.reports[side].reissueCount + 1,
    sealed: false,
    status: "INVALID",
  };
  if (next.phase === "REPORTS_SEALED") {
    next.phase = "INDEPENDENT_REVIEWING";
  }
  return next;
};

export const sealReport = (
  state: DeliberationState,
  side: ReportSide,
  report: ReviewReport
): DeliberationState => {
  if (state.phase !== "INDEPENDENT_REVIEWING") {
    throw new ProtocolError(
      "Reports can only be sealed during INDEPENDENT_REVIEWING."
    );
  }
  const validation = validateReviewReport(report);
  if (!validation.valid) {
    throw new ProtocolError(
      `Cannot seal invalid report: ${validation.errors.join(" ")}`
    );
  }
  const artifactContent = serializeReviewReport(report);
  const next = clone(state);
  const reportHash = hashCanonicalJson(report);
  next.reports[side] = {
    hash: reportHash,
    invalidReasons: [],
    reissueCount: next.reports[side].reissueCount,
    sealed: true,
    status: "VALID",
  };
  const artifactName = reportArtifactName(side);
  next.artifacts[artifactName] = {
    kind: "MARKDOWN",
    path: artifactName,
    sha256: hashMarkdown(artifactContent),
    status: "SEALED",
  };
  if (
    next.reports.external.status === "VALID" &&
    next.reports.codex.status === "VALID"
  ) {
    next.phase = "REPORTS_SEALED";
  }
  return next;
};

const assertReportsSealed = (state: DeliberationState): void => {
  if (
    state.phase !== "REPORTS_SEALED" ||
    state.reports.external.status !== "VALID" ||
    state.reports.codex.status !== "VALID" ||
    !state.reports.external.sealed ||
    !state.reports.codex.sealed ||
    state.reports.external.hash === null ||
    state.reports.codex.hash === null
  ) {
    throw new ProtocolError(
      "Comparison requires both reports to be VALID and sealed."
    );
  }
  for (const side of ["external", "codex"] as const) {
    const artifact = state.artifacts[reportArtifactName(side)];
    if (
      artifact?.status !== "SEALED" ||
      artifact.kind !== "MARKDOWN" ||
      artifact.sha256.length === 0
    ) {
      throw new ProtocolError(
        `${side} report artifact is not sealed with a content hash.`
      );
    }
  }
};

const assertReviewHash = (
  state: DeliberationState,
  side: ReportSide,
  report: ReviewReport
): void => {
  const expectedHash = state.reports[side].hash;
  if (expectedHash === null || expectedHash !== hashCanonicalJson(report)) {
    throw new ProtocolError(
      `${side} report hash does not match its sealed artifact.`
    );
  }
};

const semanticDifferences = (
  external: ReviewFinding,
  codex: ReviewFinding
): string[] => {
  const differences: string[] = [];
  const pairs: readonly [string, string, string][] = [
    ["claim", external.semantic.claimKey, codex.semantic.claimKey],
    ["scope", external.semantic.scopeKey, codex.semantic.scopeKey],
    ["evidence", external.semantic.evidenceKey, codex.semantic.evidenceKey],
    ["impact", external.semantic.impactKey, codex.semantic.impactKey],
    [
      "validation",
      external.semantic.validationKey,
      codex.semantic.validationKey,
    ],
    ["rollback", external.semantic.rollbackKey, codex.semantic.rollbackKey],
  ];
  for (const [dimension, externalValue, codexValue] of pairs) {
    if (normalizeKey(externalValue) !== normalizeKey(codexValue)) {
      differences.push(dimension);
    }
  }
  if (external.severity !== codex.severity) {
    differences.push("severity");
  }
  if (external.confidence !== codex.confidence) {
    differences.push("confidence");
  }
  if (external.priority !== codex.priority) {
    differences.push("priority");
  }
  return differences;
};

const toCanonicalFinding = (
  id: string,
  external: ReviewFinding | undefined,
  codex: ReviewFinding | undefined,
  agreement: Agreement
): CanonicalFinding => {
  const source = external ?? codex;
  if (!source) {
    throw new ProtocolError(
      "A canonical finding requires at least one source finding."
    );
  }
  return {
    agreement,
    claim: source.claim,
    codexLocalIds: codex ? [codex.localId] : [],
    evidence: source.evidence,
    externalLocalIds: external ? [external.localId] : [],
    id,
    impact: source.impact,
    lifecycle: source.lifecycle,
    material: source.material,
    priority: source.priority,
    rollback: source.rollback,
    scope: source.scope,
    severity: source.severity,
    confidence: source.confidence,
    validation: source.validation,
  } as CanonicalFinding;
};

const appendUnilateralSynthesisEntry = (
  canonicalId: string,
  external: ReviewFinding | undefined,
  codex: ReviewFinding | undefined,
  canonicalFindings: CanonicalFinding[],
  conflicts: DebateConflict[]
): void => {
  const finding = external ?? codex;
  if (!finding) {
    throw new ProtocolError(
      "A unilateral synthesis entry requires at least one source finding."
    );
  }
  const material = finding.material;
  canonicalFindings.push(
    toCanonicalFinding(
      canonicalId,
      external,
      codex,
      material ? "DIVERGENT" : "AGREED"
    )
  );
  if (material) {
    conflicts.push({
      canonicalFindingId: canonicalId,
      codexLocalIds: codex ? [codex.localId] : [],
      dimensions: ["presence"],
      externalLocalIds: external ? [external.localId] : [],
      id: `D-${String(conflicts.length + 1).padStart(3, "0")}`,
      kind: "UNILATERAL",
      material: true,
    });
  }
};

const appendPairedSynthesisEntry = (
  canonicalId: string,
  external: ReviewFinding,
  codex: ReviewFinding,
  canonicalFindings: CanonicalFinding[],
  conflicts: DebateConflict[]
): void => {
  const differences = semanticDifferences(external, codex);
  canonicalFindings.push(
    toCanonicalFinding(
      canonicalId,
      external,
      codex,
      differences.length > 0 ? "DIVERGENT" : "AGREED"
    )
  );
  if (differences.length > 0) {
    conflicts.push({
      canonicalFindingId: canonicalId,
      codexLocalIds: [codex.localId],
      dimensions: differences,
      externalLocalIds: [external.localId],
      id: `D-${String(conflicts.length + 1).padStart(3, "0")}`,
      kind: "SEMANTIC",
      material: external.material || codex.material,
    });
  }
};

const appendSynthesisEntry = (
  index: number,
  external: ReviewFinding | undefined,
  codex: ReviewFinding | undefined,
  canonicalFindings: CanonicalFinding[],
  conflicts: DebateConflict[]
): void => {
  const canonicalId = `F-${String(index + 1).padStart(3, "0")}`;
  if (external && codex) {
    appendPairedSynthesisEntry(
      canonicalId,
      external,
      codex,
      canonicalFindings,
      conflicts
    );
    return;
  }
  appendUnilateralSynthesisEntry(
    canonicalId,
    external,
    codex,
    canonicalFindings,
    conflicts
  );
};

export const synthesizeReports = (
  state: DeliberationState,
  externalReport: ReviewReport,
  codexReport: ReviewReport
): SynthesisResult => {
  assertReportsSealed(state);
  assertReviewHash(state, "external", externalReport);
  assertReviewHash(state, "codex", codexReport);
  const externalValidation = validateReviewReport(externalReport);
  const codexValidation = validateReviewReport(codexReport);
  if (!(externalValidation.valid && codexValidation.valid)) {
    throw new ProtocolError(
      "A sealed report must still satisfy its schema before synthesis."
    );
  }

  const externalByKey = new Map(
    externalReport.findings.map((finding) => [finding.equivalenceKey, finding])
  );
  const codexByKey = new Map(
    codexReport.findings.map((finding) => [finding.equivalenceKey, finding])
  );
  const keys = [
    ...new Set([...externalByKey.keys(), ...codexByKey.keys()]),
  ].sort();
  const canonicalFindings: CanonicalFinding[] = [];
  const conflicts: DebateConflict[] = [];

  for (const [index, key] of keys.entries()) {
    const external = externalByKey.get(key);
    const codex = codexByKey.get(key);
    appendSynthesisEntry(index, external, codex, canonicalFindings, conflicts);
  }

  const next = clone(state);
  next.phase = "SYNTHESIS";
  next.agreement = conflicts.length > 0 ? "DIVERGENT" : "AGREED";
  next.readiness = conflicts.length > 0 ? "UNRESOLVED" : "READY";
  next.verdict = conflicts.length > 0 ? "UNRESOLVED" : "READY";
  next.authorization = "LOCKED";
  return { canonicalFindings, conflicts, state: next };
};

export const beginDebate = (
  state: DeliberationState,
  conflicts: readonly DebateConflict[]
): DeliberationState => {
  if (state.debate.round >= state.debate.maxRounds) {
    throw new ProtocolError(
      "The maximum of four debate rounds has been reached."
    );
  }
  if (state.phase !== "SYNTHESIS" || conflicts.length === 0) {
    throw new ProtocolError("Debate requires a synthesized material conflict.");
  }
  const next = clone(state);
  next.debate.round += 1;
  next.debate.openConflictIds = conflicts.map((conflict) => conflict.id);
  next.phase = "DEBATE";
  next.agreement = "DIVERGENT";
  next.readiness = "UNRESOLVED";
  next.verdict = "UNRESOLVED";
  next.authorization = "LOCKED";
  return next;
};

export const resolveDebate = (
  state: DeliberationState,
  remainingConflicts: readonly DebateConflict[]
): DeliberationState => {
  if (state.phase !== "DEBATE") {
    throw new ProtocolError("Only an active debate can be resolved.");
  }
  const next = clone(state);
  next.debate.openConflictIds = remainingConflicts.map(
    (conflict) => conflict.id
  );
  if (remainingConflicts.length === 0) {
    next.phase = "SYNTHESIS";
    next.agreement = "AGREED";
    next.readiness = "UNRESOLVED";
    next.verdict = "UNRESOLVED";
    return next;
  }
  if (state.debate.round >= state.debate.maxRounds) {
    next.phase = "UNRESOLVED_DISPUTE";
    next.agreement = "UNRESOLVED";
    next.readiness = "UNRESOLVED";
    next.verdict = "UNRESOLVED";
    return next;
  }
  next.phase = "SYNTHESIS";
  next.agreement = "DIVERGENT";
  next.readiness = "UNRESOLVED";
  next.verdict = "UNRESOLVED";
  return next;
};

export const finalizeSynthesis = (
  state: DeliberationState,
  canonicalFindings: readonly CanonicalFinding[]
): DeliberationState => {
  if (state.phase !== "SYNTHESIS") {
    throw new ProtocolError("Consensus can only be finalized from SYNTHESIS.");
  }
  if (canonicalFindings.some((finding) => finding.agreement !== "AGREED")) {
    throw new ProtocolError(
      "Consensus cannot be finalized while a finding is divergent."
    );
  }
  const next = clone(state);
  next.authorization = "LOCKED";
  if (state.workingTree.scope === "DIRTY_RELEVANT") {
    next.agreement = "UNRESOLVED";
    next.phase = "CONSENSUS_NOT_READY";
    next.readiness = "UNRESOLVED";
    next.verdict = "UNRESOLVED";
    return next;
  }
  const openMaterialFinding = canonicalFindings.some(
    (finding) =>
      finding.material &&
      finding.lifecycle === "OPEN" &&
      (finding.severity === "CRITICAL" || finding.severity === "MAJOR")
  );
  next.agreement = "AGREED";
  next.phase = openMaterialFinding ? "CONSENSUS_NOT_READY" : "CONSENSUS_READY";
  next.readiness = openMaterialFinding ? "NOT_READY" : "READY";
  next.verdict = openMaterialFinding ? "NOT_READY" : "READY";
  return next;
};

export const finalizeReport = (
  state: DeliberationState,
  markdown: string
): DeliberationState => {
  if (
    ![
      "CONSENSUS_READY",
      "CONSENSUS_NOT_READY",
      "UNRESOLVED_DISPUTE",
      "BLOCKED",
    ].includes(state.phase)
  ) {
    throw new ProtocolError(
      "A final report requires a completed synthesis or a blocked case."
    );
  }
  if (!markdown.includes("IMPLEMENTATION_LOCKED")) {
    throw new ProtocolError(
      "The final report must contain IMPLEMENTATION_LOCKED."
    );
  }
  const next = clone(state);
  next.phase = "FINAL_REPORT_READY";
  next.authorization = "LOCKED";
  next.implementationStarted = false;
  next.artifacts["final-report.md"] = {
    kind: "MARKDOWN",
    path: "final-report.md",
    sha256: hashMarkdown(markdown),
    status: "SEALED",
  };
  return next;
};

export const requireHumanDecision = (
  state: DeliberationState
): DeliberationState => {
  if (state.phase !== "FINAL_REPORT_READY") {
    throw new ProtocolError(
      "Human decision can only be requested after final-report.md is sealed."
    );
  }
  return {
    ...clone(state),
    phase: "HUMAN_DECISION_REQUIRED",
  };
};

export const recordReviewerFailure = (
  state: DeliberationState
): DeliberationState => {
  if (state.phase === "BLOCKED") {
    throw new ProtocolError("Reviewer retries are disabled after BLOCKED.");
  }
  const next = clone(state);
  next.reviewer.reconnectAttempts += 1;
  if (next.reviewer.reconnectAttempts >= next.reviewer.maxReconnectAttempts) {
    next.phase = "BLOCKED";
    next.verdict = "BLOCKED";
    next.authorization = "LOCKED";
  }
  return next;
};

export const registerReviewerConversation = (
  state: DeliberationState,
  {
    tabId,
    threadId,
    usedThreadIds,
  }: {
    tabId: string;
    threadId: string;
    usedThreadIds: readonly string[];
  }
): DeliberationState => {
  if (!(nonEmpty(tabId) && nonEmpty(threadId))) {
    throw new ProtocolError(
      "A reviewer conversation requires opaque tab and thread identifiers."
    );
  }
  if (usedThreadIds.includes(threadId)) {
    throw new ProtocolError(
      "A reviewer thread cannot be reused across CASE-ID values."
    );
  }
  const next = clone(state);
  next.reviewer.tabId = tabId;
  next.reviewer.threadId = threadId;
  return next;
};

export const buildExternalBrief = ({
  caseId,
  restrictions,
  targetSha,
  task,
}: {
  caseId: string;
  restrictions: readonly string[];
  targetSha: string;
  task: string;
}): {
  caseId: string;
  restrictions: string[];
  targetSha: string;
  task: string;
} => {
  if (!SHA1_PATTERN.test(targetSha)) {
    throw new ProtocolError(
      "An external brief requires an immutable target SHA."
    );
  }
  if (
    ![caseId, task].every(nonEmpty) ||
    restrictions.some((item) => !nonEmpty(item))
  ) {
    throw new ProtocolError(
      "External brief allowlist fields must be non-empty."
    );
  }
  return {
    caseId,
    restrictions: [...restrictions],
    targetSha,
    task,
  };
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const isImplementationRequestForCase = (
  message: string,
  caseId: string
): boolean => {
  if (!(nonEmpty(message) && nonEmpty(caseId))) {
    return false;
  }
  const pattern = new RegExp(
    `\\b(?:implementar|implement)\\b[\\s\\S]*\\bCASE-ID\\s+${escapeRegExp(caseId)}\\b`,
    "i"
  );
  return pattern.test(message);
};

export const canImplement = (state: DeliberationState): boolean =>
  state.phase === "CLOSED" &&
  state.authorization === "HUMAN_APPROVED" &&
  !state.implementationStarted &&
  state.agreement === "AGREED" &&
  state.readiness !== "UNRESOLVED";

export const recordHumanDecision = (
  state: DeliberationState,
  message: string
): DeliberationState => {
  if (state.phase !== "HUMAN_DECISION_REQUIRED") {
    throw new ProtocolError("A human decision requires a sealed final report.");
  }
  if (isImplementationRequestForCase(message, state.caseId)) {
    if (state.agreement !== "AGREED" || state.readiness === "UNRESOLVED") {
      throw new ProtocolError(
        "An unresolved case cannot be authorized for implementation."
      );
    }
    const next = clone(state);
    next.authorization = "HUMAN_APPROVED";
    next.humanDecision = "APPROVED";
    next.phase = "CLOSED";
    return next;
  }
  const rejectPattern = new RegExp(
    `\\b(?:rejeitar|rejeito|reject|do not implement|não implementar|nao implementar)\\b[\\s\\S]*\\bCASE-ID\\s+${escapeRegExp(state.caseId)}\\b`,
    "i"
  );
  if (rejectPattern.test(message)) {
    const next = clone(state);
    next.authorization = "HUMAN_REJECTED";
    next.humanDecision = "REJECTED";
    next.phase = "CLOSED";
    return next;
  }
  throw new ProtocolError(
    "Human implementation decisions require an explicit CASE-ID request."
  );
};

export const reopenAfterMaterialFinding = (
  state: DeliberationState,
  reason: string
): DeliberationState => {
  if (
    !(
      ["FINAL_REPORT_READY", "HUMAN_DECISION_REQUIRED", "CLOSED"].includes(
        state.phase
      ) && nonEmpty(reason)
    )
  ) {
    throw new ProtocolError(
      "Only a completed case can be reopened with a material finding."
    );
  }
  const next = clone(state);
  next.phase = "CASE_OPENED";
  next.reopenCount += 1;
  next.reopenReason = reason;
  next.reports = {
    codex: initialReportSlot(),
    external: initialReportSlot(),
  };
  next.debate = {
    maxRounds: MAX_DEBATE_ROUNDS,
    openConflictIds: [],
    round: 0,
  };
  next.authorization = "LOCKED";
  next.agreement = "UNRESOLVED";
  next.readiness = "UNRESOLVED";
  next.verdict = "UNRESOLVED";
  next.humanDecision = "PENDING";
  next.implementationStarted = false;
  return next;
};
