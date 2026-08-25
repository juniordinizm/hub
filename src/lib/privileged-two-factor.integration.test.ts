import { randomUUID } from "node:crypto";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { symmetricDecrypt } from "better-auth/crypto";
import { twoFactor } from "better-auth/plugins/two-factor";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  accounts,
  profiles,
  sessions,
  twoFactors,
  users,
  verifications,
} from "@/db/schema";
import { PASSWORD_MIN_LENGTH } from "./password-policy";
import { TWO_FACTOR_SERVER_OPTIONS } from "./two-factor-policy";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

const BASE_URL = "http://localhost:3000";
const AUTH_SECRET = "integration-secret-with-at-least-32-characters";
const DELETED_COOKIE_PATTERN = /max-age=0/i;
const TEST_PASSWORD = "integration-password";
const pool = new Pool({
  application_name: "protea-r-privileged-two-factor-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 2,
});
const db = drizzle(pool, {
  schema: { accounts, profiles, sessions, twoFactors, users, verifications },
});
const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: BASE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { accounts, sessions, twoFactors, users, verifications },
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
  },
  plugins: [twoFactor(TWO_FACTOR_SERVER_OPTIONS)],
  rateLimit: { enabled: false },
  secret: AUTH_SECRET,
});

type CookieJar = Map<string, string>;

const applyResponseCookies = (response: Response, jar: CookieJar): void => {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";", 1)[0];
    const separator = pair?.indexOf("=") ?? -1;
    if (separator < 1) {
      continue;
    }
    const name = pair?.slice(0, separator) ?? "";
    const value = pair?.slice(separator + 1) ?? "";
    if (!value || DELETED_COOKIE_PATTERN.test(header)) {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
};

const serializeCookies = (jar: CookieJar): string =>
  [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

const postAuth = async ({
  body,
  jar,
  path,
}: {
  body?: Record<string, unknown>;
  jar: CookieJar;
  path: string;
}): Promise<Response> => {
  const headers = new Headers({ "content-type": "application/json" });
  const cookie = serializeCookies(jar);
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      body: JSON.stringify(body ?? {}),
      headers,
      method: "POST",
    })
  );
  applyResponseCookies(response, jar);
  return response;
};

const signInForChallenge = async (
  email: string
): Promise<{ jar: CookieJar; response: Response }> => {
  const jar: CookieJar = new Map();
  const response = await postAuth({
    body: { email, password: TEST_PASSWORD },
    jar,
    path: "/sign-in/email",
  });
  return { jar, response };
};

const readSessionCount = async (userId: string): Promise<number> => {
  const result = await pool.query<{ count: number }>(
    "select count(*)::int as count from sessions where user_id = $1",
    [userId]
  );
  return result.rows[0]?.count ?? -1;
};

const readAuthCounts = async (
  userId: string
): Promise<{
  failedVerificationCount: number;
  locked: boolean;
  sessionCount: number;
  twoFactorEnabled: boolean;
  verified: boolean;
}> => {
  const result = await pool.query<{
    failed_verification_count: number;
    locked: boolean;
    session_count: number;
    two_factor_enabled: boolean;
    verified: boolean;
  }>(
    `select
       u.two_factor_enabled,
       tf.verified,
       tf.failed_verification_count,
       coalesce(tf.locked_until > now(), false) as locked,
       count(s.id)::int as session_count
     from users u
     join two_factors tf on tf.user_id = u.id
     left join sessions s on s.user_id = u.id
     where u.id = $1
     group by u.id, tf.id`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Two-factor integration state was not found.");
  }
  return {
    failedVerificationCount: row.failed_verification_count,
    locked: row.locked,
    sessionCount: row.session_count,
    twoFactorEnabled: row.two_factor_enabled,
    verified: row.verified,
  };
};

afterAll(async () => {
  await pool.end();
});

describe("privileged Better Auth two-factor PostgreSQL flow", () => {
  it("exercises setup, one-use backup recovery, lockout and role session revocation", async () => {
    const email = `privileged-two-factor-${randomUUID()}@example.test`;
    const setupJar: CookieJar = new Map();
    let userId: string | undefined;

    try {
      const signUpResponse = await postAuth({
        body: {
          email,
          name: "Privileged integration",
          password: TEST_PASSWORD,
        },
        jar: setupJar,
        path: "/sign-up/email",
      });
      expect(signUpResponse.status).toBe(200);
      const signUp = (await signUpResponse.json()) as { user: { id: string } };
      userId = signUp.user.id;
      expect(await readSessionCount(userId)).toBe(1);
      expect(
        [...setupJar.keys()].some((name) => name.includes("session_token"))
      ).toBe(true);
      await pool.query(
        "insert into profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin'",
        [userId]
      );
      expect(await readSessionCount(userId)).toBe(0);
      const setupSignIn = await signInForChallenge(email);
      expect(setupSignIn.response.status).toBe(200);

      const enableResponse = await postAuth({
        body: { password: TEST_PASSWORD },
        jar: setupSignIn.jar,
        path: "/two-factor/enable",
      });
      expect(enableResponse.status).toBe(200);
      const enabled = (await enableResponse.json()) as {
        backupCodes: string[];
        totpURI: string;
      };
      const backupCode = enabled.backupCodes[0];
      const unusedOriginalBackupCode = enabled.backupCodes[1];
      const secret = new URL(enabled.totpURI).searchParams.get("secret");
      expect(backupCode).toBeTruthy();
      expect(unusedOriginalBackupCode).toBeTruthy();
      expect(secret).toBeTruthy();

      const authenticatorSecret = new TextDecoder().decode(
        base32.decode(String(secret))
      );
      const generatedCode = await createOTP(authenticatorSecret, {
        digits: 6,
        period: 30,
      }).totp();
      const storedSecret = await pool.query<{ secret: string }>(
        "select secret from two_factors where user_id = $1",
        [userId]
      );
      const decryptedSecret = await symmetricDecrypt({
        data: String(storedSecret.rows[0]?.secret),
        key: AUTH_SECRET,
      });
      expect(decryptedSecret === authenticatorSecret).toBe(true);
      await expect(
        createOTP(authenticatorSecret, { digits: 6, period: 30 }).verify(
          generatedCode
        )
      ).resolves.toBe(true);
      expect(await readAuthCounts(userId)).toEqual({
        failedVerificationCount: 0,
        locked: false,
        sessionCount: 1,
        twoFactorEnabled: false,
        verified: false,
      });
      const setupVerification = await postAuth({
        body: { code: generatedCode, trustDevice: false },
        jar: setupSignIn.jar,
        path: "/two-factor/verify-totp",
      });
      expect(setupVerification.status).toBe(200);
      expect(await readAuthCounts(userId)).toEqual({
        failedVerificationCount: 0,
        locked: false,
        sessionCount: 1,
        twoFactorEnabled: true,
        verified: true,
      });
      expect(
        [...setupSignIn.jar.keys()].some((name) => name.includes("trust"))
      ).toBe(false);

      await postAuth({ jar: setupSignIn.jar, path: "/sign-out" });
      const firstRecovery = await signInForChallenge(email);
      expect(firstRecovery.response.status).toBe(200);
      await expect(
        firstRecovery.response.clone().json()
      ).resolves.toMatchObject({ twoFactorRedirect: true });
      expect((await readAuthCounts(userId)).sessionCount).toBe(0);

      const recoveryResponse = await postAuth({
        body: {
          code: backupCode,
          disableSession: false,
          trustDevice: false,
        },
        jar: firstRecovery.jar,
        path: "/two-factor/verify-backup-code",
      });
      expect(recoveryResponse.status).toBe(200);
      expect((await readAuthCounts(userId)).sessionCount).toBe(1);

      const replacementAuthenticatorResponse = await postAuth({
        body: { password: TEST_PASSWORD },
        jar: firstRecovery.jar,
        path: "/two-factor/get-totp-uri",
      });
      expect(replacementAuthenticatorResponse.status).toBe(200);
      const replacementAuthenticator =
        (await replacementAuthenticatorResponse.json()) as { totpURI: string };
      const replacementSecret = new URL(
        replacementAuthenticator.totpURI
      ).searchParams.get("secret");
      expect(replacementSecret).toBe(secret);
      const replacementAuthenticatorCode = await createOTP(
        new TextDecoder().decode(base32.decode(String(replacementSecret))),
        { digits: 6, period: 30 }
      ).totp();
      const replacementVerification = await postAuth({
        body: { code: replacementAuthenticatorCode, trustDevice: false },
        jar: firstRecovery.jar,
        path: "/two-factor/verify-totp",
      });
      expect(replacementVerification.status).toBe(200);

      const replacementCodesResponse = await postAuth({
        body: { password: TEST_PASSWORD },
        jar: firstRecovery.jar,
        path: "/two-factor/generate-backup-codes",
      });
      expect(replacementCodesResponse.status).toBe(200);
      const replacementCodes = (await replacementCodesResponse.json()) as {
        backupCodes: string[];
        status: true;
      };
      const replacementBackupCode = replacementCodes.backupCodes[0];
      expect(replacementCodes.status).toBe(true);
      expect(replacementBackupCode).toBeTruthy();
      await postAuth({ jar: firstRecovery.jar, path: "/sign-out" });

      const invalidatedOriginalChallenge = await signInForChallenge(email);
      const invalidatedOriginalResponse = await postAuth({
        body: {
          code: unusedOriginalBackupCode,
          disableSession: false,
          trustDevice: false,
        },
        jar: invalidatedOriginalChallenge.jar,
        path: "/two-factor/verify-backup-code",
      });
      expect(invalidatedOriginalResponse.ok).toBe(false);

      const replacementRecovery = await signInForChallenge(email);
      const replacementRecoveryResponse = await postAuth({
        body: {
          code: replacementBackupCode,
          disableSession: false,
          trustDevice: false,
        },
        jar: replacementRecovery.jar,
        path: "/two-factor/verify-backup-code",
      });
      expect(replacementRecoveryResponse.status).toBe(200);
      expect((await readAuthCounts(userId)).sessionCount).toBe(1);

      await pool.query(
        "update profiles set role = 'support', updated_at = now() where user_id = $1",
        [userId]
      );
      expect((await readAuthCounts(userId)).sessionCount).toBe(0);

      const reusedRecovery = await signInForChallenge(email);
      const reusedBackupResponse = await postAuth({
        body: {
          code: backupCode,
          disableSession: false,
          trustDevice: false,
        },
        jar: reusedRecovery.jar,
        path: "/two-factor/verify-backup-code",
      });
      expect(reusedBackupResponse.ok).toBe(false);

      const lockedChallenge = await signInForChallenge(email);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const invalidResponse = await postAuth({
          body: { code: "not-a-code", trustDevice: false },
          jar: lockedChallenge.jar,
          path: "/two-factor/verify-totp",
        });
        expect(invalidResponse.ok).toBe(false);
      }
      expect(await readAuthCounts(userId)).toMatchObject({
        failedVerificationCount: 5,
        locked: true,
        sessionCount: 0,
      });

      const validWhileLocked = await createOTP(authenticatorSecret, {
        digits: 6,
        period: 30,
      }).totp();
      const lockedResponse = await postAuth({
        body: { code: validWhileLocked, trustDevice: false },
        jar: lockedChallenge.jar,
        path: "/two-factor/verify-totp",
      });
      expect(lockedResponse.ok).toBe(false);
    } finally {
      if (userId) {
        await pool.query("delete from users where id = $1", [userId]);
      }
    }
  });
});
