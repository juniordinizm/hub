export type RecoveryEnvironment = "development" | "production" | "staging";
export type RecoveryCheckStatus = "failed" | "passed";

export interface RecoveryCheck {
  name: string;
  status: RecoveryCheckStatus;
}

export interface RecoveryEvidenceInput {
  checks: readonly RecoveryCheck[];
  environment: RecoveryEnvironment;
  finishedAt: string;
  migrationJournal: string;
  owner: string;
  startedAt: string;
}

export interface RecoveryEvidence {
  checks: RecoveryCheck[];
  environment: RecoveryEnvironment;
  finishedAt: string;
  migrationJournal: string;
  owner: string;
  schemaVersion: 1;
  startedAt: string;
}

const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9._ -]{0,79}$/i;
const RECOVERY_ENVIRONMENTS = new Set<RecoveryEnvironment>([
  "development",
  "production",
  "staging",
]);
const RECOVERY_STATUSES = new Set<RecoveryCheckStatus>(["failed", "passed"]);

const requireIdentifier = (name: string, value: string): string => {
  const normalized = value.trim();
  if (!SAFE_IDENTIFIER.test(normalized)) {
    throw new Error(`${name} must be a bounded non-sensitive identifier.`);
  }
  return normalized;
};

const requireTimestamp = (name: string, value: string): string => {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${name} must be an ISO timestamp.`);
  }
  return normalized;
};

export const createRecoveryEvidence = (
  input: RecoveryEvidenceInput
): RecoveryEvidence => {
  if (!RECOVERY_ENVIRONMENTS.has(input.environment)) {
    throw new Error("environment is invalid.");
  }

  const owner = requireIdentifier("owner", input.owner);
  const migrationJournal = requireIdentifier(
    "migrationJournal",
    input.migrationJournal
  );
  const startedAt = requireTimestamp("startedAt", input.startedAt);
  const finishedAt = requireTimestamp("finishedAt", input.finishedAt);

  if (Date.parse(finishedAt) < Date.parse(startedAt)) {
    throw new Error("finishedAt must not precede startedAt.");
  }

  const checks = input.checks.map((check) => {
    const name = requireIdentifier("check.name", check.name);
    if (!RECOVERY_STATUSES.has(check.status)) {
      throw new Error("check.status is invalid.");
    }
    return { name, status: check.status };
  });

  return {
    checks,
    environment: input.environment,
    finishedAt,
    migrationJournal,
    owner,
    schemaVersion: 1,
    startedAt,
  };
};
