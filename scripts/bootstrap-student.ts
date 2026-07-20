import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import {
  accounts,
  courses,
  profiles,
  sessions,
  users,
  verifications,
} from "../src/db/schema";
import { addMonths } from "../src/features/enrollments/rules";
import { createManualAccessGrant } from "../src/features/enrollments/server";
import { assertSafeLocalDatabaseCommand } from "../src/lib/local-database-command";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const email = process.argv[2] ?? "aluno@gmail.com";
const password = process.argv[3] ?? "Camila15!";
const name = process.argv[4] ?? "Camila Aluna";
const courseSlug = process.argv[5] ?? "protea-r";
const rawDatabaseUrl =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
}

assertSafeLocalDatabaseCommand({
  databaseUrl: rawDatabaseUrl,
  environment: process.env.NODE_ENV ?? "development",
  operation: "seed",
});

const pool = new Pool({
  connectionString: withVerifiedSslMode(rawDatabaseUrl),
});
const db = drizzle(pool, {
  schema: { accounts, courses, profiles, sessions, users, verifications },
});
const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { accounts, sessions, users, verifications },
    usePlural: true,
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  secret: process.env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
});

const main = async (): Promise<void> => {
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
    throw new Error("Nao foi possivel criar ou localizar a aluna.");
  }

  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.slug, courseSlug))
    .limit(1);

  if (!course) {
    throw new Error(`Curso nao encontrado para slug: ${courseSlug}`);
  }

  const passwordHash = await hashPassword(password);
  const updatedAccount = await db
    .update(accounts)
    .set({
      accountId: userId,
      password: passwordHash,
      providerId: "credential",
      updatedAt: new Date(),
    })
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))
    )
    .returning({ id: accounts.id });

  if (updatedAccount.length === 0) {
    await db.insert(accounts).values({
      accountId: userId,
      id: randomUUID(),
      password: passwordHash,
      providerId: "credential",
      userId,
    });
  }

  await db
    .insert(profiles)
    .values({ role: "student", userId })
    .onConflictDoUpdate({ set: { role: "student" }, target: profiles.userId });

  const client = await pool.connect();
  try {
    await client.query("begin");
    await createManualAccessGrant({
      client,
      courseId: course.id,
      expiresAt: addMonths(new Date(), 12),
      manualReference: `seed-student:${email}:${courseSlug}`,
      reason: "bootstrap local",
      userId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(`Aluna pronta: ${email} / ${course.title}`);
};

try {
  await main();
} finally {
  await pool.end();
}
