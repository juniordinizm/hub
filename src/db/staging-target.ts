const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const POOLED_HOST_MARKER = "-pooler.";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const LEADING_SLASHES = /^\/+/;

export const assertStagingTarget = ({
  branchId,
  confirmation,
  databaseUrl,
  expectedBranchId,
  expectedHost,
}: {
  branchId: string | undefined;
  confirmation: string | undefined;
  databaseUrl: string;
  expectedBranchId: string | undefined;
  expectedHost: string | undefined;
}): { branchId: string; databaseName: string; host: string } => {
  if (confirmation?.trim().toLowerCase() !== "staging") {
    throw new Error("Set STAGING_OPERATION_CONFIRMATION=staging.");
  }
  if (!(branchId?.trim() && expectedBranchId?.trim())) {
    throw new Error("STAGING_NEON_BRANCH_ID is required.");
  }
  if (branchId.trim() !== expectedBranchId.trim()) {
    throw new Error("Staging branch does not match STAGING_NEON_BRANCH_ID.");
  }
  if (!expectedHost?.trim()) {
    throw new Error("STAGING_DATABASE_HOST is required.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Staging database URL is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Staging database URL must use PostgreSQL.");
  }

  const host = url.hostname
    .trim()
    .toLowerCase()
    .replace(POOLED_HOST_MARKER, ".");
  const confirmedHost = expectedHost
    .trim()
    .toLowerCase()
    .replace(POOLED_HOST_MARKER, ".");
  if (host.startsWith(PRODUCTION_NEON_COMPUTE)) {
    throw new Error("Staging command refuses the Production Neon compute.");
  }
  if (LOOPBACK_HOSTS.has(host)) {
    throw new Error("Staging command requires a remote Neon host.");
  }
  if (host !== confirmedHost) {
    throw new Error("Staging database does not match STAGING_DATABASE_HOST.");
  }

  const databaseName = decodeURIComponent(url.pathname).replace(
    LEADING_SLASHES,
    ""
  );
  if (!databaseName) {
    throw new Error("Staging database name is missing.");
  }
  return { branchId: branchId.trim(), databaseName, host };
};
