import type { ReleaseState } from "./release-state";

export interface ProductionReleaseExpectation {
  canonicalAlias: string;
  journalEntryCount: number;
  latestMigrationTimestamp: number;
  neonBranchId: string;
  neonProjectId: string;
  releaseSha: string;
  requireCanonicalAlias: boolean;
  vercelProjectId: string;
}

export interface ProductionDatabaseObservation {
  journalEntryCount: number;
  latestMigrationTimestamp: number;
  readOnly: boolean;
  serverMajorVersion: number;
}

interface VerifyProductionReleaseStateInput {
  database: ProductionDatabaseObservation;
  expected: ProductionReleaseExpectation;
  neon: unknown;
  vercel: unknown;
  vercelDomains?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const vercelVerifiedProjectDomains = (
  domains: unknown,
  expectedProjectId?: string
): string[] => {
  const values =
    isRecord(domains) && Array.isArray(domains.domains)
      ? domains.domains.filter(isRecord)
      : [];
  return values
    .filter(
      (domain) =>
        domain.verified === true &&
        (!expectedProjectId || domain.projectId === expectedProjectId)
    )
    .map((domain) => stringValue(domain.name ?? domain.domain))
    .filter((domain): domain is string => Boolean(domain));
};

export const verifyDocumentedReleaseCheckpoint = ({
  checkpoint,
  releaseSha,
  releaseState,
}: {
  checkpoint: keyof ReleaseState | undefined;
  releaseSha: string;
  releaseState: ReleaseState | undefined;
}): string[] => {
  if (!checkpoint) {
    return [];
  }
  if (!releaseState) {
    return ["release_state_document_missing"];
  }

  const documented = releaseState[checkpoint];
  return documented.commit === releaseSha &&
    documented.environment === "production"
    ? []
    : [`release_state_${checkpoint}_mismatch`];
};

const vercelAlias = (alias: unknown): string | undefined => {
  if (typeof alias === "string") {
    return alias;
  }
  if (isRecord(alias)) {
    return stringValue(alias.alias ?? alias.domain);
  }
  return;
};

const vercelAliases = (deployment: Record<string, unknown>): string[] =>
  Array.isArray(deployment.alias)
    ? deployment.alias
        .map(vercelAlias)
        .filter((alias): alias is string => Boolean(alias))
    : [];

const vercelRelease = (
  deployment: Record<string, unknown>
): string | undefined => {
  if (isRecord(deployment.meta)) {
    const metaSha = stringValue(
      deployment.meta.githubCommitSha ?? deployment.meta.githubCommitSHA
    );
    if (metaSha) {
      return metaSha;
    }
  }
  return isRecord(deployment.gitSource)
    ? stringValue(deployment.gitSource.sha)
    : undefined;
};

const verifyVercel = (
  vercel: unknown,
  expected: ProductionReleaseExpectation,
  vercelDomains: unknown
): string[] => {
  if (!isRecord(vercel)) {
    return ["vercel_response_incomplete"];
  }

  const errors: string[] = [];
  if (vercel.readyState !== "READY" && vercel.state !== "READY") {
    errors.push("vercel_state_mismatch");
  }
  if (vercel.target !== "production") {
    errors.push("vercel_target_mismatch");
  }
  if (
    stringValue(vercel.projectId ?? vercel.project) !== expected.vercelProjectId
  ) {
    errors.push("vercel_project_mismatch");
  }
  if (vercelRelease(vercel) !== expected.releaseSha) {
    errors.push("vercel_release_mismatch");
  }
  if (
    expected.requireCanonicalAlias &&
    !(
      vercelAliases(vercel).includes(expected.canonicalAlias) ||
      vercelVerifiedProjectDomains(
        vercelDomains,
        expected.vercelProjectId
      ).includes(expected.canonicalAlias)
    )
  ) {
    errors.push("vercel_alias_mismatch");
  }
  return errors;
};

const verifyNeon = (
  neon: unknown,
  expected: ProductionReleaseExpectation
): string[] => {
  const branch = isRecord(neon) && isRecord(neon.branch) ? neon.branch : null;
  if (!branch) {
    return ["neon_response_incomplete"];
  }

  const errors: string[] = [];
  if (
    branch.id !== expected.neonBranchId ||
    branch.project_id !== expected.neonProjectId
  ) {
    errors.push("neon_branch_mismatch");
  }
  if (branch.current_state !== "ready") {
    errors.push("neon_branch_state_mismatch");
  }
  return errors;
};

const verifyDatabase = (
  database: ProductionDatabaseObservation,
  expected: ProductionReleaseExpectation
): string[] => {
  const errors: string[] = [];
  if (database.serverMajorVersion !== 18) {
    errors.push("postgres_version_mismatch");
  }
  if (database.latestMigrationTimestamp !== expected.latestMigrationTimestamp) {
    errors.push("migration_marker_mismatch");
  }
  if (database.journalEntryCount !== expected.journalEntryCount) {
    errors.push("migration_count_mismatch");
  }
  if (!database.readOnly) {
    errors.push("database_read_only_proof_missing");
  }
  return errors;
};

export const verifyProductionReleaseState = ({
  database,
  expected,
  neon,
  vercel,
  vercelDomains,
}: VerifyProductionReleaseStateInput): string[] => [
  ...verifyVercel(vercel, expected, vercelDomains),
  ...verifyNeon(neon, expected),
  ...verifyDatabase(database, expected),
];
