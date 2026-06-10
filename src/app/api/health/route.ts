import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = (): NextResponse =>
  NextResponse.json({
    ok: true,
    service: "protea-r-hub",
    timestamp: new Date().toISOString(),
  });
