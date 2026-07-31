import { spawn } from "node:child_process";
import { join } from "node:path";
import { assertSafeE2eDatabaseEnvironment } from "../../src/db/e2e-database-guard";

const getBunExecutable = (): string => {
  if (process.platform !== "win32") {
    return "bun";
  }
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA is required to run E2E teardown on Windows.");
  }
  return join(appData, "npm", "node_modules", "bun", "bin", "bun.exe");
};

export default async function globalTeardown(): Promise<void> {
  assertSafeE2eDatabaseEnvironment(process.env);
  await new Promise<void>((resolveTeardown, rejectTeardown) => {
    const child = spawn(getBunExecutable(), ["run", "test:e2e:teardown"], {
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

    child.once("error", rejectTeardown);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveTeardown();
        return;
      }
      rejectTeardown(
        new Error(`E2E teardown exited with code ${code ?? "unknown"}.`)
      );
    });
  });
}
