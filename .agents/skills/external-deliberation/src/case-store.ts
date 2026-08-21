import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type ArtifactRecord,
  CASE_STATES,
  type CaseState,
  canonicalJson,
  type DeliberationState,
  deserializeReviewReport,
  hashCanonicalJson,
  hashMarkdown,
  type ReportSide,
  type ReviewReport,
  reportArtifactName,
  ProtocolError as StateProtocolError,
  scanTextForPotentialSecrets,
  serializeReviewReport,
} from "./protocol";

const CASE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const ARTIFACT_PATTERN =
  /^(?:baseline|external-review|codex-review|synthesis|final-report)\.md$/;
const DEBATE_PATTERN = /^debate-0[1-4]\.md$/;

const assertCaseId = (caseId: string): void => {
  if (!CASE_ID_PATTERN.test(caseId)) {
    throw new StateProtocolError(
      "Invalid CASE-ID for a local artifact directory."
    );
  }
};

const assertArtifactName = (name: string): void => {
  if (!(ARTIFACT_PATTERN.test(name) || DEBATE_PATTERN.test(name))) {
    throw new StateProtocolError(`Artifact path is not allowed: ${name}`);
  }
};

const atomicWrite = async (
  filePath: string,
  content: string
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    try {
      await rename(temporaryPath, filePath);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? error.code : undefined;
      if (code !== "EEXIST" && code !== "EPERM") {
        throw error;
      }
      await rm(filePath, { force: true });
      await rename(temporaryPath, filePath);
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const cloneState = (state: DeliberationState): DeliberationState =>
  JSON.parse(JSON.stringify(state)) as DeliberationState;

const assertPersistedState = (value: unknown): DeliberationState => {
  if (!value || typeof value !== "object") {
    throw new StateProtocolError("Persisted state must be an object.");
  }
  const record = value as Partial<DeliberationState>;
  if (
    record.schemaVersion !== 1 ||
    typeof record.caseId !== "string" ||
    !CASE_STATES.includes(record.phase as CaseState) ||
    !record.reports ||
    !record.artifacts ||
    !record.auditEvents
  ) {
    throw new StateProtocolError("Persisted state failed schema validation.");
  }
  return value as DeliberationState;
};

export class CaseStore {
  readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = rootDirectory;
  }

  private caseDirectory(caseId: string): string {
    assertCaseId(caseId);
    return join(this.rootDirectory, caseId);
  }

  private statePath(caseId: string): string {
    return join(this.caseDirectory(caseId), "state.json");
  }

  private artifactPath(caseId: string, name: string): string {
    assertArtifactName(name);
    return join(this.caseDirectory(caseId), name);
  }

  async initialize(state: DeliberationState): Promise<void> {
    await atomicWrite(
      this.statePath(state.caseId),
      `${canonicalJson(state)}\n`
    );
  }

  async readState(caseId: string): Promise<DeliberationState> {
    try {
      const content = await readFile(this.statePath(caseId), "utf8");
      return assertPersistedState(JSON.parse(content));
    } catch (error) {
      throw new StateProtocolError(
        `Cannot read state for ${caseId}: ${String(error)}`
      );
    }
  }

  async writeMarkdown(
    state: DeliberationState,
    name: string,
    content: string
  ): Promise<DeliberationState> {
    const secretMatches = scanTextForPotentialSecrets(content);
    if (secretMatches.length > 0) {
      throw new StateProtocolError(
        `Artifact rejected because it resembles a secret: ${secretMatches.join(", ")}`
      );
    }
    const filePath = this.artifactPath(state.caseId, name);
    await atomicWrite(filePath, content);
    const next = cloneState(state);
    const record: ArtifactRecord = {
      kind: "MARKDOWN",
      path: name,
      sha256: hashMarkdown(content),
      status: "SEALED",
    };
    next.artifacts[name] = record;
    await this.initialize(next);
    return next;
  }

  async verifyArtifact(
    state: DeliberationState,
    name: string
  ): Promise<boolean> {
    const record = state.artifacts[name];
    if (record?.status !== "SEALED") {
      return false;
    }
    try {
      const content = await readFile(
        this.artifactPath(state.caseId, name),
        "utf8"
      );
      return hashMarkdown(content) === record.sha256;
    } catch {
      return false;
    }
  }

  readMarkdown(state: DeliberationState, name: string): Promise<string> {
    return readFile(this.artifactPath(state.caseId, name), "utf8");
  }

  writeReviewReport(
    state: DeliberationState,
    side: ReportSide,
    report: ReviewReport
  ): Promise<DeliberationState> {
    const expectedReportHash = state.reports[side].hash;
    if (expectedReportHash !== hashCanonicalJson(report)) {
      throw new StateProtocolError(
        `${side} report does not match its sealed structured-report hash.`
      );
    }
    return this.writeMarkdown(
      state,
      reportArtifactName(side),
      serializeReviewReport(report)
    );
  }

  async readReviewReport(
    state: DeliberationState,
    side: ReportSide
  ): Promise<ReviewReport> {
    const artifactName = reportArtifactName(side);
    if (!(await this.verifyArtifact(state, artifactName))) {
      throw new StateProtocolError(
        `${side} report artifact failed its persisted-byte hash check.`
      );
    }
    const report = deserializeReviewReport(
      await this.readMarkdown(state, artifactName)
    );
    if (state.reports[side].hash !== hashCanonicalJson(report)) {
      throw new StateProtocolError(
        `${side} report artifact failed its structured-report hash check.`
      );
    }
    return report;
  }
}
