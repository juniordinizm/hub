import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { withVerifiedSslMode } from "./src/db/connection-url";

config({ path: ".env.local" });
config({ path: ".env" });

const rawDatabaseUrl =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "";
const databaseUrl = withVerifiedSslMode(rawDatabaseUrl);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
