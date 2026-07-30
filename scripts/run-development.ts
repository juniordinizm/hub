import { spawn } from "node:child_process";
import { config } from "dotenv";
import { getDevelopmentEnvironmentProblems } from "../src/lib/development-environment";

const escapedDollarPattern = /\\\$/g;
const inheritedEnvironment = { ...process.env };
const isIsolatedE2eLaunch =
  inheritedEnvironment.CI?.trim().toLowerCase() === "true" &&
  inheritedEnvironment.E2E_TEST_MODE?.trim().toLowerCase() === "true";
const localEnvironment = config({
  path: ".env.local",
  override: true,
  quiet: true,
}).parsed;
const baseEnvironment = config({ path: ".env", quiet: true }).parsed;

for (const [key, value] of Object.entries({
  ...baseEnvironment,
  ...localEnvironment,
})) {
  process.env[key] = value.replace(escapedDollarPattern, "$");
}
if (isIsolatedE2eLaunch) {
  Object.assign(process.env, inheritedEnvironment);
}

const problems = getDevelopmentEnvironmentProblems(process.env);

if (problems.length > 0) {
  throw new Error(
    `Development environment is unsafe:\n- ${problems.join("\n- ")}`
  );
}

const [command, ...commandArguments] = process.argv.slice(2);

if (!command) {
  throw new Error("A development command is required.");
}

const executable = command === "bun" ? process.execPath : command;
const databaseUrl = new URL(process.env.DATABASE_URL as string);
const normalizedDatabaseHost = databaseUrl.hostname.replace("-pooler.", ".");

console.log(
  [
    "Development environment verified.",
    `Database host: ${normalizedDatabaseHost}`,
    `Private bucket: ${process.env.R2_BUCKET_NAME}`,
    `Public bucket: ${process.env.R2_PUBLIC_BUCKET_NAME}`,
    `JMVStream plan: ${process.env.JMVSTREAM_PLAN_ID}`,
    `Sentry project: ${process.env.DEVELOPMENT_SENTRY_PROJECT_ID}`,
  ].join("\n")
);

const child = spawn(executable, commandArguments, {
  env: process.env,
  stdio: "inherit",
});

const exitCode = await new Promise<number>((resolveExitCode, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) {
      reject(new Error(`Development command terminated by ${signal}.`));
      return;
    }
    resolveExitCode(code ?? 1);
  });
});

process.exitCode = exitCode;
