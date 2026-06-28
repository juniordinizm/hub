import { NextResponse } from "next/server";
import { syncPendingJmvstreamPlayers } from "@/features/jmvstream/server";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const getBearerToken = (authorization: string | null): string | null => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

export const GET = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  const receivedToken = getBearerToken(request.headers.get("authorization"));

  if (env.CRON_SECRET) {
    if (receivedToken !== env.CRON_SECRET) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET nao configurado." },
      { status: 503 }
    );
  }

  const result = await syncPendingJmvstreamPlayers();

  return NextResponse.json(result);
};
