import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import {
  accounts,
  profiles,
  sessions,
  users,
  verifications,
} from "../src/db/schema";
import { addMonths } from "../src/features/enrollments/rules";
import { createManualAccessGrant } from "../src/features/enrollments/server";
import { assertSharedDevelopmentDatabase } from "../src/lib/shared-development-database";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const readRequiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the shared Development seed.`);
  }
  return value;
};

const databaseUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL_DIRECT or DATABASE_URL is required.");
}

const target = assertSharedDevelopmentDatabase({
  confirmation: process.env.SHARED_DEVELOPMENT_SEED_CONFIRMATION,
  databaseUrl,
  expectedHost: process.env.DEVELOPMENT_DATABASE_HOST,
});
const pool = new Pool({
  connectionString: withVerifiedSslMode(databaseUrl),
});
const db = drizzle(pool, {
  schema: { accounts, profiles, sessions, users, verifications },
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
  secret: readRequiredEnvironment("BETTER_AUTH_SECRET"),
});

const ensureUser = async ({
  email,
  name,
  password,
  role,
}: {
  email: string;
  name: string;
  password: string;
  role: "admin" | "student";
}): Promise<string> => {
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
    throw new Error(`Could not create or locate the ${role} fixture.`);
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
    .values({ role, userId })
    .onConflictDoUpdate({ set: { role }, target: profiles.userId });
  return userId;
};

const seedCatalog = async (
  client: PoolClient
): Promise<{ courseId: string }> => {
  await client.query(
    "select pg_advisory_xact_lock(hashtext('seed:shared-development'))"
  );
  const { rows: courseRows } = await client.query<{ id: string }>(
    `
      insert into courses (
        slug, title, subtitle, description, workload_hours, price_in_cents,
        access_duration_months, status, certificate_enabled
      )
      values (
        'development-course', 'Curso de Desenvolvimento',
        'Fixture compartilhada e sem dados pessoais',
        'Curso persistente para validar as jornadas do ambiente Development.',
        2, 9900, 12, 'active', false
      )
      on conflict (slug) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        description = excluded.description,
        workload_hours = excluded.workload_hours,
        price_in_cents = excluded.price_in_cents,
        access_duration_months = excluded.access_duration_months,
        status = excluded.status,
        certificate_enabled = excluded.certificate_enabled,
        updated_at = now()
      returning id
    `
  );
  const courseId = courseRows[0]?.id;
  if (!courseId) {
    throw new Error("Could not create the Development course.");
  }

  const { rows: publicationRows } = await client.query<{ id: string }>(
    `
      insert into course_publications (
        course_id, publication_number, status, title_snapshot,
        workload_hours_snapshot, published_at
      )
      values ($1, 1, 'published', 'Curso de Desenvolvimento', 2, now())
      on conflict (course_id, publication_number) do update set
        status = 'published',
        title_snapshot = excluded.title_snapshot,
        workload_hours_snapshot = excluded.workload_hours_snapshot,
        published_at = coalesce(course_publications.published_at, now()),
        updated_at = now()
      returning id
    `,
    [courseId]
  );
  const publicationId = publicationRows[0]?.id;
  if (!publicationId) {
    throw new Error("Could not create the Development course publication.");
  }

  const { rows: moduleRows } = await client.query<{ id: string }>(
    `
      with existing as (
        select id from modules
        where course_publication_id = $2 and sort_order = 1
        limit 1
      ), updated as (
        update modules set
          course_id = $1,
          title = 'Modulo de Desenvolvimento',
          description = 'Fixture persistente para testes manuais.',
          status = 'active',
          updated_at = now()
        where id = (select id from existing)
        returning id
      ), inserted as (
        insert into modules (
          course_id, course_publication_id, title, description, sort_order,
          status
        )
        select $1, $2, 'Modulo de Desenvolvimento',
          'Fixture persistente para testes manuais.', 1, 'active'
        where not exists (select 1 from existing)
        returning id
      )
      select id from updated
      union all
      select id from inserted
    `,
    [courseId, publicationId]
  );
  const moduleId = moduleRows[0]?.id;
  if (!moduleId) {
    throw new Error("Could not create the Development module.");
  }

  for (const [sortOrder, title] of [
    "Primeira aula de Desenvolvimento",
    "Segunda aula de Desenvolvimento",
  ].entries()) {
    await client.query(
      `
        with existing as (
          select id from lessons
          where course_publication_id = $2 and sort_order = $4
          limit 1
        ), updated as (
          update lessons set
            module_id = $1,
            title = $3,
            description = 'Fixture persistente para testes manuais.',
            duration_seconds = 60,
            video_duration_seconds = 60,
            status = 'active',
            is_published = true,
            is_required = true,
            updated_at = now()
          where id = (select id from existing)
          returning id
        )
        insert into lessons (
          module_id, course_publication_id, title, description,
          duration_seconds, video_duration_seconds, sort_order, status,
          is_published, is_required
        )
        select $1, $2, $3, 'Fixture persistente para testes manuais.',
          60, 60, $4, 'active', true, true
        where not exists (select 1 from existing)
      `,
      [moduleId, publicationId, title, sortOrder + 1]
    );
  }
  return { courseId };
};

const main = async (): Promise<void> => {
  const adminEmail = readRequiredEnvironment("DEVELOPMENT_ADMIN_EMAIL");
  const adminPassword = readRequiredEnvironment("DEVELOPMENT_ADMIN_PASSWORD");
  const studentEmail = readRequiredEnvironment("DEVELOPMENT_STUDENT_EMAIL");
  const studentPassword = readRequiredEnvironment(
    "DEVELOPMENT_STUDENT_PASSWORD"
  );
  const [, studentId] = await Promise.all([
    ensureUser({
      email: adminEmail,
      name: "Admin Development",
      password: adminPassword,
      role: "admin",
    }),
    ensureUser({
      email: studentEmail,
      name: "Aluna Development",
      password: studentPassword,
      role: "student",
    }),
  ]);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { courseId } = await seedCatalog(client);
    const { rowCount } = await client.query(
      `
        select 1 from enrollment_grants
        where manual_reference = 'seed:shared-development:student'
      `
    );
    if (rowCount === 0) {
      await createManualAccessGrant({
        client,
        courseId,
        expiresAt: addMonths(new Date(), 12),
        manualReference: "seed:shared-development:student",
        reason: "shared Development fixture",
        userId: studentId,
      });
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(
    `Shared Development seed completed on ${target.databaseName} at ${target.host}.`
  );
  console.log("Fixtures ready: admin, student, course, module, and lessons.");
};

try {
  await main();
} finally {
  await pool.end();
}
