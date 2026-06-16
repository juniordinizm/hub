import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { sendPasswordResetEmail } from "@/features/email/server";
import { getServerEnv } from "@/lib/env";

const createAuth = () => {
  const env = getServerEnv();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [
      new URL(env.BETTER_AUTH_URL).origin,
      new URL(env.NEXT_PUBLIC_APP_URL).origin,
    ],
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
      sendResetPassword: async ({ url, user }) => {
        await sendPasswordResetEmail({
          resetUrl: url,
          to: user.email,
          userName: user.name,
        });
      },
    },
    plugins: [nextCookies()],
  });
};

let authInstance: ReturnType<typeof createAuth> | null = null;

export const getAuth = (): ReturnType<typeof createAuth> => {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
};
