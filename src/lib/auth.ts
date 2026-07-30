import "server-only";
import { dash, sentinel } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { sendBetterAuthPasswordResetEmail } from "@/lib/auth-password-reset";
import {
  getBetterAuthRateLimitConfig,
  getResolvedBetterAuthInfraConfig,
} from "@/lib/auth-policy";
import { getServerEnv } from "@/lib/env";
import { parseTrustedOrigins } from "@/lib/trusted-origins";

const createAuth = () => {
  const env = getServerEnv();
  const betterAuthInfraConfig = getResolvedBetterAuthInfraConfig({
    apiKey: env.BETTER_AUTH_API_KEY,
    apiUrl: env.BETTER_AUTH_API_URL,
    isE2eTestMode: env.E2E_TEST_MODE,
    kvUrl: env.BETTER_AUTH_KV_URL,
  });
  const infraPlugins = betterAuthInfraConfig
    ? [
        dash(betterAuthInfraConfig),
        sentinel({
          ...betterAuthInfraConfig,
          security: {
            credentialStuffing: {
              enabled: true,
              thresholds: { block: 5, challenge: 3 },
            },
          },
        }),
      ]
    : [];

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    rateLimit: getBetterAuthRateLimitConfig(env.E2E_TEST_MODE),
    advanced: {
      trustedProxyHeaders: true,
    },
    trustedOrigins: parseTrustedOrigins({
      defaults: [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL],
      extraOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
    }),
    database: drizzleAdapter(getDb(), {
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
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async (input, request) => {
        await sendBetterAuthPasswordResetEmail(input, request);
      },
    },
    plugins: [...infraPlugins, nextCookies()],
  });
};

let authInstance: ReturnType<typeof createAuth> | null = null;

export const getAuth = (): ReturnType<typeof createAuth> => {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
};
