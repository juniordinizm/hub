import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

const rawDatabaseUrl =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "";
const databaseUrl =
  rawDatabaseUrl && !rawDatabaseUrl.includes("sslmode=")
    ? `${rawDatabaseUrl}?sslmode=require`
    : rawDatabaseUrl;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
