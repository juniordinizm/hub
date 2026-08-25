import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import {
  getPrivilegedAssuranceRedirect,
  resolvePrivilegedAssurance,
} from "@/lib/privileged-assurance";
import { route } from "@/lib/routes";

export type AppRole = "admin" | "support" | "student";

export interface AppSession {
  platformBlockedAt: Date | null;
  platformBlockedReason: string | null;
  role: AppRole;
  twoFactorEnabled: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const getCurrentSession = async (): Promise<AppSession | null> => {
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const [profile] = await getDb()
    .select({
      platformBlockedAt: profiles.platformBlockedAt,
      platformBlockedReason: profiles.platformBlockedReason,
      role: profiles.role,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, session.user.id))
    .limit(1);

  return {
    platformBlockedAt: profile?.platformBlockedAt ?? null,
    platformBlockedReason: profile?.platformBlockedReason ?? null,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    role: profile?.role ?? "student",
    twoFactorEnabled: profile?.twoFactorEnabled ?? false,
  };
};

const requirePrivilegedAssurance = (session: AppSession): void => {
  const assurance = resolvePrivilegedAssurance({
    hasActiveSession: true,
    mfaEnforced: getServerEnv().PRIVILEGED_MFA_ENFORCED,
    role: session.role,
    twoFactorEnabled: session.twoFactorEnabled,
  });
  const redirectTo = getPrivilegedAssuranceRedirect(assurance);

  if (redirectTo) {
    redirect(route(redirectTo));
  }
};

export const requireSession = async (): Promise<AppSession> => {
  const session = await getCurrentSession();

  if (!session) {
    redirect(route("/entrar"));
  }

  if (session.role === "student" && session.platformBlockedAt) {
    redirect(route("/entrar"));
  }

  return session;
};

export const requireRole = async <Role extends AppRole>(
  roles: readonly Role[]
): Promise<AppSession & { role: Role }> => {
  const session = await requireSession();

  const allowedRole = roles.find((role) => role === session.role);
  if (!allowedRole) {
    redirect(route("/app"));
  }

  requirePrivilegedAssurance(session);

  return { ...session, role: allowedRole };
};
