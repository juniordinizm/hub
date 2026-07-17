import { NextResponse } from "next/server";
import { runDataRetention } from "@/features/privacy/server";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (
    env.CRON_SECRET ? token !== env.CRON_SECRET : env.NODE_ENV === "production"
  ) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, ...(await runDataRetention()) });
};
