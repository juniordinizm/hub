import { NextResponse } from "next/server";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import { getCurrentSession, recordStudentLastAccess } from "@/lib/session";

export const GET = async (): Promise<NextResponse> => {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ redirectTo: "/entrar" }, { status: 401 });
  }

  if (session.role === "student" && session.platformBlockedAt) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
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

  return NextResponse.json({
    redirectTo: session.role === "student" ? "/app" : "/admin",
  });
};
