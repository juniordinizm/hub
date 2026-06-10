import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  accounts,
  profiles,
  sessions,
  users,
  verifications,
} from "../src/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] ?? "Admin PROTEA-R";

if (!(email && password)) {
  throw new Error(
    "Usage: bun scripts/bootstrap-admin.ts <email> <password> [name]"
  );
}

const rawDatabaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
}

const databaseUrl = rawDatabaseUrl.includes("sslmode=")
  ? rawDatabaseUrl
  : `${rawDatabaseUrl}?sslmode=require`;
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, {
  schema: { accounts, profiles, sessions, users, verifications },
});
const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      accounts,
      sessions,
      users,
      verifications,
    },
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  secret: process.env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
});

let userId: string | null = null;

try {
  const result = await auth.api.signUpEmail({
    body: { email, name, password },
  });
  userId = result.user.id;
} catch {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  userId = existingUser?.id ?? null;
}

if (!userId) {
  await pool.end();
  throw new Error("Nao foi possivel criar ou localizar o usuario admin.");
}

await db
  .insert(profiles)
  .values({
    role: "admin",
    userId,
  })
  .onConflictDoUpdate({
    set: { role: "admin" },
    target: profiles.userId,
  });

await pool.end();

console.log(`Admin pronto: ${email}`);
