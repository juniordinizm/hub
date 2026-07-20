import { spawn } from "node:child_process";

const runE2eSeed = async (): Promise<void> =>
  await new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", "test:e2e:seed"], {
      cwd: process.cwd(),
      env: process.env,
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
  await runE2eSeed();
}
