import { Pool } from "pg";
import {
  resolveExpiryWarningSupersedeTarget,
  runExpiryWarningV1Supersede,
} from "../src/tooling/supersede-expiry-warning-v1";

const main = async (): Promise<void> => {
  const target = resolveExpiryWarningSupersedeTarget({
    argv: process.argv.slice(2),
    environment: process.env,
  });
  const pool = new Pool({
    application_name: "protea-r-expiry-warning-v1-supersede",
    connectionString: target.databaseUrl,
    max: 1,
  });
  try {
    const client = await pool.connect();
    try {
      const result = await runExpiryWarningV1Supersede({
        client,
        mode: target.mode,
      });
      process.stdout.write(
        `${JSON.stringify({
          ...result,
          environment: target.environment,
          mode: target.mode,
          status: target.mode === "execute" ? "superseded" : "planned",
        })}\n`
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    process.stderr.write("Expiry warning v1 supersede failed.\n");
    process.exitCode = 1;
  }
}
