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
  profiles,
  sessions,
  users,
  verifications,
} from "../src/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

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

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // Limpa todos os usuários e dependências (perfis, matrículas, progresso, etc)
    await client.query("TRUNCATE TABLE users CASCADE;");

    // Limpa cursos, módulos, aulas, arquivos e compras
    await client.query("TRUNCATE TABLE courses CASCADE;");

    // Limpa outras tabelas periféricas
    await client.query("TRUNCATE TABLE faq_items CASCADE;");
    await client.query("TRUNCATE TABLE audit_logs CASCADE;");
    await client.query("TRUNCATE TABLE webhook_events CASCADE;");

    await client.query("COMMIT;");
    console.log("✔️ Banco de dados completamente limpo.");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Erro ao limpar banco:", err);
    process.exit(1);
  } finally {
    client.release();
  }

  type Role = "admin" | "student" | "support";

  const usersToCreate: Array<{
    email: string;
    name: string;
    password: string;
    role: Role;
  }> = [
    {
      email: "protear@gmail.com",
      name: "Admin",
      password: "Senha123",
      role: "admin",
    },
    {
      email: "aluno@gmail.com",
      name: "Aluno",
      password: "Senha123",
      role: "student",
    },
  ];

  for (const u of usersToCreate) {
    let userId: string | null = null;
    try {
      const result = await auth.api.signUpEmail({
        body: { email: u.email, name: u.name, password: u.password },
      });
      userId = result.user.id;
    } catch {
      // Se por algum motivo o usuário já existir (o que não deveria acontecer pós-truncate)
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);
      userId = existingUser?.id ?? null;
    }

    if (!userId) {
      console.error(`❌ Não foi possível criar o usuário ${u.email}`);
      continue;
    }

    const passwordHash = await hashPassword(u.password);
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
        role: u.role,
        userId,
      })
      .onConflictDoUpdate({
        set: { role: u.role },
        target: profiles.userId,
      });

    console.log(`✔️ Usuário recriado com sucesso: ${u.email} [role=${u.role}]`);
  }

  await pool.end();
  console.log("✅ Processo concluído com sucesso.");
}

main().catch((err) => {
  console.error("❌ Erro não tratado:", err);
  process.exit(1);
});
