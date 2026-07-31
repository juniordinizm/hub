import { spawn } from "node:child_process";
import { join } from "node:path";
import { assertSafeE2eDatabaseEnvironment } from "../../src/db/e2e-database-guard";

const getBunExecutable = (): string => {
  if (process.platform !== "win32") {
    return "bun";
  }
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA is required to run E2E tests on Windows.");
  }
  return join(appData, "npm", "node_modules", "bun", "bin", "bun.exe");
};

const runE2eSeed = async (): Promise<void> =>
  await new Promise((resolve, reject) => {
    const child = spawn(getBunExecutable(), ["run", "test:e2e:seed"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CI: "true",
        ...(process.env.E2E_DATABASE_URL
          ? { DATABASE_URL: process.env.E2E_DATABASE_URL }
          : {}),
        E2E_TEST_MODE: "true",
      },
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`E2E seed exited with code ${code ?? "unknown"}.`));
    });
  });

export default async function globalSetup(): Promise<void> {
  assertSafeE2eDatabaseEnvironment(process.env);
  await runE2eSeed();
}
