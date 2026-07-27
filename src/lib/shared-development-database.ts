const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const LEADING_SLASHES = /^\/+/;

const normalizeNeonHost = (host: string): string =>
  host.replace("-pooler.", ".");

export const assertSharedDevelopmentDatabase = ({
  confirmation,
  databaseUrl,
  expectedHost,
}: {
  confirmation: string | undefined;
  databaseUrl: string;
  expectedHost: string | undefined;
}): { databaseName: string; host: string } => {
  if (confirmation?.trim().toLowerCase() !== "development") {
    throw new Error(
      "Set SHARED_DEVELOPMENT_SEED_CONFIRMATION=development to run this seed."
    );
  }
  if (!expectedHost?.trim()) {
    throw new Error("DEVELOPMENT_DATABASE_HOST is required.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Shared Development database URL is invalid.");
  }

  const host = normalizeNeonHost(url.hostname);
  const confirmedHost = normalizeNeonHost(expectedHost.trim());
  if (host.startsWith(PRODUCTION_NEON_COMPUTE)) {
    throw new Error(
      "Shared Development seed refuses the Production Neon compute."
    );
  }
  if (LOOPBACK_HOSTS.has(host)) {
    throw new Error("Shared Development seed requires a remote Neon host.");
  }
  if (host !== confirmedHost) {
    throw new Error(
      "Shared Development database host does not match DEVELOPMENT_DATABASE_HOST."
    );
  }

  const databaseName = decodeURIComponent(url.pathname).replace(
    LEADING_SLASHES,
    ""
  );
  if (!databaseName) {
    throw new Error("Shared Development database name is missing.");
  }

  return { databaseName, host };
};
