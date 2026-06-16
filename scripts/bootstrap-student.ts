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
  enrollments,
  profiles,
  sessions,
  users,
  verifications,
} from "../src/db/schema";
import { addMonths } from "../src/features/enrollments/rules";

config({ path: ".env.local" });
config({ path: ".env" });

const email = process.argv[2] ?? "aluno@gmail.com";
const password = process.argv[3] ?? "Camila15!";
const name = process.argv[4] ?? "Camila Aluna";
const courseSlug = process.argv[5] ?? "protea-r";

const rawDatabaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
}

const databaseUrl = withVerifiedSslMode(rawDatabaseUrl);
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, {
  schema: {
    accounts,
    courses,
    enrollments,
    profiles,
    sessions,
    users,
    verifications,
  },
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
    minPasswordLength: 8,
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
  throw new Error("Nao foi possivel criar ou localizar a aluna.");
}

const [course] = await db
  .select({ id: courses.id, title: courses.title })
  .from(courses)
  .where(eq(courses.slug, courseSlug))
  .limit(1);

if (!course) {
  await pool.end();
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
  .values({
    role: "student",
    userId,
  })
  .onConflictDoUpdate({
    set: { role: "student" },
    target: profiles.userId,
  });

const expiresAt = addMonths(new Date(), 12);

await db
  .insert(enrollments)
  .values({
    courseId: course.id,
    expiresAt,
    status: "active",
    userId,
  })
  .onConflictDoUpdate({
    set: {
      expiresAt,
      revokedAt: null,
      revokedReason: null,
      status: "active",
      updatedAt: new Date(),
    },
    target: [enrollments.userId, enrollments.courseId],
  });

await pool.end();

console.log(`Aluna pronta: ${email} / ${course.title}`);
