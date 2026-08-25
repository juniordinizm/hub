import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const bunCommand = process.platform === "win32" ? "bun.cmd" : "bun";
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const logDirectory = "test-results";
const logPath = join(logDirectory, "next-server.log");

let activeChild: ChildProcess | null = null;

const stopActiveChild = (): void => {
  activeChild?.kill("SIGTERM");
};

const runCommand = async ({
  args,
  command,
  cwd = process.cwd(),
  environment = process.env,
  output,
}: {
  args: string[];
  command: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
  output: ReturnType<typeof createWriteStream>;
}): Promise<number> =>
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: environment,
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
    const buildExitCode = await runCommand({
      args: ["run", "build"],
      command: bunCommand,
      output,
    });
    if (buildExitCode !== 0) {
      process.exitCode = buildExitCode;
      return;
    }

    const standaloneDirectory = join(process.cwd(), ".next", "standalone");
    await cp(
      join(process.cwd(), ".next", "static"),
      join(standaloneDirectory, ".next", "static"),
      { force: true, recursive: true }
    );
    await cp(
      join(process.cwd(), "public"),
      join(standaloneDirectory, "public"),
      {
        force: true,
        recursive: true,
      }
    );

    process.exitCode = await runCommand({
      args: ["server.js"],
      command: nodeCommand,
      cwd: standaloneDirectory,
      environment: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: "3100",
      },
      output,
    });
  } finally {
    output.end();
  }
};

process.once("SIGINT", stopActiveChild);
process.once("SIGTERM", stopActiveChild);

await run();
