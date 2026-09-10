import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import { route } from "@/lib/routes";

export type AppRole = "admin" | "support" | "student";

export interface AppSession {
  platformBlockedAt: Date | null;
  platformBlockedReason: string | null;
  role: AppRole;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const STUDENT_LAST_ACCESS_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export const getCurrentSession = cache(async (): Promise<AppSession | null> => {
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
  };
});

export const recordStudentLastAccess = async (
  userId: string
): Promise<void> => {
  const now = new Date();
  const writeAfter = new Date(
    now.getTime() - STUDENT_LAST_ACCESS_WRITE_INTERVAL_MS
  );

  await getDb()
    .update(profiles)
    .set({ lastAccessAt: now })
    .where(
      and(
        eq(profiles.userId, userId),
        eq(profiles.role, "student"),
        or(isNull(profiles.lastAccessAt), lt(profiles.lastAccessAt, writeAfter))
      )
    );
};

export const requireSession = async (): Promise<AppSession> => {
  const session = await getCurrentSession();

  if (!session) {
    redirect(route("/entrar"));
  }

  if (session.role === "student" && session.platformBlockedAt) {
    redirect(route("/entrar"));
  }

  if (session.role === "student") {
    try {
      await recordStudentLastAccess(session.user.id);
    } catch {
      logOperationalEvent({
        correlationId: createCorrelationId(null),
        errorCode: "student_last_access_update_failed",
        operation: "auth.last_access",
        outcome: "failure",
        provider: "database",
      });
    }
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

  return { ...session, role: allowedRole };
};
