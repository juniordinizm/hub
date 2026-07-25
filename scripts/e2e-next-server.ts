import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const bunCommand = process.platform === "win32" ? "bun.cmd" : "bun";
const logDirectory = "test-results";
const logPath = join(logDirectory, "next-server.log");

let activeChild: ChildProcess | null = null;

const stopActiveChild = (): void => {
  activeChild?.kill("SIGTERM");
};

const runBunCommand = async ({
  args,
  output,
}: {
  args: string[];
  output: ReturnType<typeof createWriteStream>;
}): Promise<number> =>
  await new Promise((resolve, reject) => {
    const child = spawn(bunCommand, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    child.stdout?.pipe(process.stdout);
    child.stdout?.pipe(output, { end: false });
    child.stderr?.pipe(process.stderr);
    child.stderr?.pipe(output, { end: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      activeChild = null;
      if (signal) {
        reject(new Error(`Next.js command stopped by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });

const run = async (): Promise<void> => {
  await mkdir(logDirectory, { recursive: true });
  const output = createWriteStream(logPath, { flags: "a" });

  try {
    const buildExitCode = await runBunCommand({
      args: ["run", "build"],
      output,
    });
    if (buildExitCode !== 0) {
      process.exitCode = buildExitCode;
      return;
    }

    process.exitCode = await runBunCommand({
      args: ["run", "start", "--", "--port", "3100"],
      output,
    });
  } finally {
    output.end();
  }
};

process.once("SIGINT", stopActiveChild);
process.once("SIGTERM", stopActiveChild);

await run();
