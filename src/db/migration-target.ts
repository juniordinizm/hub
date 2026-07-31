export const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const POOLED_HOST_MARKER = "-pooler.";

type Environment = Readonly<Record<string, string | undefined>>;
type MigrationTarget = "development";

const normalizeNeonHost = (host: string): string =>
  host.trim().toLowerCase().replace(POOLED_HOST_MARKER, ".");

export const isProductionNeonHost = (host: string): boolean =>
  normalizeNeonHost(host).startsWith(PRODUCTION_NEON_COMPUTE);

const parsePostgresUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

export const getMigrationTargetProblems = (
  environment: Environment,
  target: MigrationTarget
): string[] => {
  const problems: string[] = [];
  const expectedHostKey =
    target === "development"
      ? "DEVELOPMENT_DATABASE_HOST"
      : neverTarget(target);
  const rawDatabaseUrl = environment.DATABASE_URL_DIRECT?.trim();
  const expectedHost = environment[expectedHostKey]?.trim();

  if (rawDatabaseUrl) {
    const databaseUrl = parsePostgresUrl(rawDatabaseUrl);
    if (databaseUrl) {
      const normalizedDatabaseHost = normalizeNeonHost(databaseUrl.hostname);
      if (isProductionNeonHost(normalizedDatabaseHost)) {
        problems.push(
          "DATABASE_URL_DIRECT must not target the Production Neon compute"
        );
      }
      if (
        expectedHost &&
        normalizedDatabaseHost !== normalizeNeonHost(expectedHost)
      ) {
        problems.push(
          "DATABASE_URL_DIRECT must target DEVELOPMENT_DATABASE_HOST"
        );
      }
    } else {
      problems.push("DATABASE_URL_DIRECT must be a valid PostgreSQL URL");
    }
  } else {
    problems.push("DATABASE_URL_DIRECT is required");
  }

  if (!expectedHost) {
    problems.push(`${expectedHostKey} is required`);
  }

  return problems;
};

const neverTarget = (target: never): never => {
  throw new Error(`Unsupported migration target: ${target}`);
};
