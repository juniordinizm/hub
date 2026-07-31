import { isProductionNeonHost } from "./migration-target";

type Environment = Readonly<Record<string, string | undefined>>;

const parsePostgresUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:"
      ? url
      : null;
  } catch {
    return null;
  }
};

export const assertSafeE2eDatabaseEnvironment = (
  environment: Environment
): void => {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const e2eDatabaseUrl = environment.E2E_DATABASE_URL?.trim();

  if (!(databaseUrl && e2eDatabaseUrl)) {
    throw new Error("DATABASE_URL and E2E_DATABASE_URL are required for E2E.");
  }
  if (databaseUrl !== e2eDatabaseUrl) {
    throw new Error("DATABASE_URL must exactly match E2E_DATABASE_URL.");
  }

  const parsedUrl = parsePostgresUrl(e2eDatabaseUrl);
  if (!parsedUrl) {
    throw new Error("E2E_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (isProductionNeonHost(parsedUrl.hostname)) {
    throw new Error(
      "E2E database must not target the Production Neon compute."
    );
  }
};
