import { spawnSync } from "node:child_process";
import { assertSafeE2eDatabaseEnvironment } from "../src/db/e2e-database-guard";

type Environment = Readonly<Record<string, string | undefined>>;

export const createE2eMigrationEnvironment = (
  environment: Environment
): NodeJS.ProcessEnv => {
  assertSafeE2eDatabaseEnvironment(environment);
  const e2eDatabaseUrl = environment.E2E_DATABASE_URL?.trim();
  if (!e2eDatabaseUrl) {
    throw new Error("E2E database guard accepted an absent database URL.");
  }

  const directDatabaseUrl = environment.DATABASE_URL_DIRECT?.trim();
  if (directDatabaseUrl && directDatabaseUrl !== e2eDatabaseUrl) {
    throw new Error("DATABASE_URL_DIRECT must exactly match E2E_DATABASE_URL.");
  }

  return {
    ...environment,
    DATABASE_URL: e2eDatabaseUrl,
    DATABASE_URL_DIRECT: e2eDatabaseUrl,
    E2E_DATABASE_URL: e2eDatabaseUrl,
    NODE_ENV: "test",
  };
};

if (import.meta.main) {
  const result = spawnSync(process.execPath, ["x", "drizzle-kit", "migrate"], {
    env: createE2eMigrationEnvironment(process.env),
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}
