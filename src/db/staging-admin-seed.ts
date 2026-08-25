import { normalizeBuyerEmail } from "@/features/payments/buyer-identity";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type StagingAdminSeedLabel = "primary" | "recovery";

export interface StagingAdminSeedAccount {
  email: string;
  label: StagingAdminSeedLabel;
  name: string;
  password: string;
}

interface StagingAdminSeedQueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface StagingAdminSeedClient {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<StagingAdminSeedQueryResult>;
}

type StagingAdminSeedEnvironment = Record<string, string | undefined>;

const readRequiredEnvironment = (
  environment: StagingAdminSeedEnvironment,
  name: string
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Staging Admin seed.`);
  }
  return value;
};

const resolveAccount = ({
  emailVariable,
  environment,
  label,
  name,
  passwordVariable,
}: {
  emailVariable: string;
  environment: StagingAdminSeedEnvironment;
  label: StagingAdminSeedLabel;
  name: string;
  passwordVariable: string;
}): StagingAdminSeedAccount => {
  const password = readRequiredEnvironment(environment, passwordVariable);
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `${passwordVariable} must have at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  }

  return {
    email: normalizeBuyerEmail(
      readRequiredEnvironment(environment, emailVariable)
    ),
    label,
    name,
    password,
  };
};

export const resolveStagingAdminSeedAccounts = (
  environment: StagingAdminSeedEnvironment
): readonly [StagingAdminSeedAccount, StagingAdminSeedAccount] => {
  const primary = resolveAccount({
    emailVariable: "STAGING_ADMIN_EMAIL",
    environment,
    label: "primary",
    name: "Admin Staging",
    passwordVariable: "STAGING_ADMIN_PASSWORD",
  });
  const recovery = resolveAccount({
    emailVariable: "STAGING_RECOVERY_ADMIN_EMAIL",
    environment,
    label: "recovery",
    name: "Admin Recuperação Staging",
    passwordVariable: "STAGING_RECOVERY_ADMIN_PASSWORD",
  });

  if (primary.email === recovery.email) {
    throw new Error("Staging Admin accounts must use distinct emails.");
  }
  if (primary.password === recovery.password) {
    throw new Error("Staging Admin accounts must use distinct passwords.");
  }

  return [primary, recovery];
};

export const seedStagingAdminAccounts = async ({
  accounts,
  client,
  createId,
  hashPassword,
}: {
  accounts: readonly [StagingAdminSeedAccount, StagingAdminSeedAccount];
  client: StagingAdminSeedClient;
  createId: () => string;
  hashPassword: (password: string) => Promise<string>;
}): Promise<{ created: number; updated: number }> => {
  const passwordHashes = await Promise.all(
    accounts.map(({ password }) => hashPassword(password))
  );
  let created = 0;
  let updated = 0;

  await client.query("begin");
  try {
    await client.query(
      "select pg_advisory_xact_lock(hashtext('seed:staging-admins'))"
    );

    for (const [index, account] of accounts.entries()) {
      const existing = await client.query(
        "select id from users where lower(email) = $1 limit 1",
        [account.email]
      );
      const existingUserId = existing.rows[0]?.id;
      const userId =
        typeof existingUserId === "string" ? existingUserId : createId();

      if (existing.rowCount === 0) {
        created += 1;
        await client.query(
          "insert into users (id, name, email, email_verified) values ($1, $2, $3, true)",
          [userId, account.name, account.email]
        );
      } else {
        updated += 1;
        await client.query(
          "update users set email = $2, email_verified = true, updated_at = now() where id = $1",
          [userId, account.email]
        );
      }

      const credentialAccounts = await client.query(
        "select id from accounts where user_id = $1 and provider_id = 'credential' order by created_at",
        [userId]
      );
      const existingAccountId = credentialAccounts.rows[0]?.id;
      const credentialAccountId =
        typeof existingAccountId === "string" ? existingAccountId : createId();
      const passwordHash = passwordHashes[index];

      if (credentialAccounts.rowCount === 0) {
        await client.query(
          "insert into accounts (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)",
          [credentialAccountId, userId, passwordHash]
        );
      } else {
        await client.query(
          "update accounts set account_id = $2, password = $3, updated_at = now() where id = $1",
          [credentialAccountId, userId, passwordHash]
        );
        await client.query(
          "delete from accounts where user_id = $1 and provider_id = 'credential' and id <> $2",
          [userId, credentialAccountId]
        );
      }

      await client.query(
        "insert into profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin', updated_at = now()",
        [userId]
      );
      await client.query("delete from sessions where user_id = $1", [userId]);
    }

    await client.query("commit");
    return { created, updated };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};
