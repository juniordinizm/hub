import {
  createRecoveryEvidence,
  type RecoveryCheckStatus,
  type RecoveryEnvironment,
  type RecoveryEvidence,
} from "../src/tooling/observability-recovery-evidence";

interface DrillChecks {
  alerts: RecoveryCheckStatus;
  migration: RecoveryCheckStatus;
  readiness: RecoveryCheckStatus;
}

export interface DrillEvidenceInput {
  checks: DrillChecks;
  environment: RecoveryEnvironment;
  migrationJournal: string;
  now?: string;
  owner: string;
}

const parseMode = (argv: readonly string[]): "dry-run" => {
  if (argv.length !== 1 || argv[0] !== "--dry-run") {
    throw new Error(
      "Use somente --dry-run; este comando não altera ambientes."
    );
  }
  return "dry-run";
};

export const createDrillEvidence = ({
  checks,
  environment,
  migrationJournal,
  now = new Date().toISOString(),
  owner,
}: DrillEvidenceInput): RecoveryEvidence =>
  createRecoveryEvidence({
    checks: Object.entries(checks).map(([name, status]) => ({ name, status })),
    environment,
    finishedAt: now,
    migrationJournal,
    owner,
    startedAt: now,
  });

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} é obrigatório.`);
  }
  return value;
};

const parseCheckStatus = (name: string): RecoveryCheckStatus => {
  const value = requiredEnvironmentValue(name);
  if (value !== "passed" && value !== "failed") {
    throw new Error(`${name} deve ser passed ou failed.`);
  }
  return value;
};

const main = (): void => {
  parseMode(process.argv.slice(2));
  const evidence = createDrillEvidence({
    checks: {
      alerts: parseCheckStatus("RECOVERY_DRILL_ALERTS"),
      migration: parseCheckStatus("RECOVERY_DRILL_MIGRATION"),
      readiness: parseCheckStatus("RECOVERY_DRILL_READINESS"),
    },
    environment: requiredEnvironmentValue(
      "RECOVERY_DRILL_ENVIRONMENT"
    ) as RecoveryEnvironment,
    migrationJournal: requiredEnvironmentValue(
      "RECOVERY_DRILL_MIGRATION_JOURNAL"
    ),
    owner: requiredEnvironmentValue("RECOVERY_DRILL_OWNER"),
  });

  process.stdout.write(`${JSON.stringify(evidence)}\n`);
};

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Recovery evidence failed."}\n`
    );
    process.exitCode = 1;
  }
}
