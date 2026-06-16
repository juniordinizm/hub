import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";

export const GET = async (): Promise<NextResponse> => {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ redirectTo: "/entrar" }, { status: 401 });
  }

  return NextResponse.json({
    redirectTo: session.role === "student" ? "/app" : "/admin",
  });
};
