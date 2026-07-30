import { config } from "dotenv";
import { getDevelopmentEnvironmentProblems } from "../src/lib/development-environment";

config({ path: ".env.local", override: true, quiet: true });
config({ path: ".env", quiet: true });

const problems = getDevelopmentEnvironmentProblems(process.env);

if (problems.length > 0) {
  throw new Error(
    `Development environment is unsafe:\n- ${problems.join("\n- ")}`
  );
}

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
