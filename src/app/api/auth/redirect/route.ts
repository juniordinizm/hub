import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getCurrentSession } from "@/lib/session";

export const GET = async (): Promise<NextResponse> => {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ redirectTo: "/entrar" }, { status: 401 });
  }

  if (session.role === "student" && session.platformBlockedAt) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  if (
    session.role !== "student" &&
    getServerEnv().PRIVILEGED_MFA_ENFORCED &&
    !session.twoFactorEnabled
  ) {
    return NextResponse.json({
      redirectTo: "/configurar-segundo-fator",
    });
  }

  return NextResponse.json({
    redirectTo: session.role === "student" ? "/app" : "/admin",
  });
};
