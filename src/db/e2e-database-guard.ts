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
  if (parsedUrl.hostname.includes("-pooler.")) {
    throw new Error(
      "E2E database must use a direct PostgreSQL endpoint, not a pooled endpoint."
    );
  }
};

const isPooledCounterpart = (directUrl: URL, runtimeUrl: URL): boolean => {
  const normalizedRuntimeHost = runtimeUrl.hostname
    .toLowerCase()
    .replace("-pooler.", ".");

  return (
    runtimeUrl.hostname.toLowerCase().includes("-pooler.") &&
    normalizedRuntimeHost === directUrl.hostname.toLowerCase() &&
    runtimeUrl.protocol === directUrl.protocol &&
    runtimeUrl.username === directUrl.username &&
    runtimeUrl.password === directUrl.password &&
    runtimeUrl.port === directUrl.port &&
    runtimeUrl.pathname === directUrl.pathname &&
    runtimeUrl.search === directUrl.search &&
    runtimeUrl.hash === directUrl.hash
  );
};

export const resolveSafeE2eRuntimeDatabaseUrl = (
  environment: Environment
): string => {
  assertSafeE2eDatabaseEnvironment(environment);

  const directUrlValue = environment.E2E_DATABASE_URL?.trim();
  const runtimeUrlValue = environment.E2E_RUNTIME_DATABASE_URL?.trim();
  if (!(directUrlValue && runtimeUrlValue)) {
    return directUrlValue ?? "";
  }

  const directUrl = parsePostgresUrl(directUrlValue);
  const runtimeUrl = parsePostgresUrl(runtimeUrlValue);
  if (
    !(directUrl && runtimeUrl) ||
    isProductionNeonHost(runtimeUrl.hostname) ||
    !isPooledCounterpart(directUrl, runtimeUrl)
  ) {
    throw new Error(
      "E2E_RUNTIME_DATABASE_URL must be the pooled counterpart of E2E_DATABASE_URL."
    );
  }

  return runtimeUrlValue;
};
