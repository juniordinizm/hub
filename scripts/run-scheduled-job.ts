import { invokeScheduledJob } from "../src/config/scheduled-job-runner";

const jobName = process.argv[2] ?? "";

try {
  const result = await invokeScheduledJob({
    environment: process.env,
    jobName,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown scheduled job failure.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
