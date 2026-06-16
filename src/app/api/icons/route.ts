import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}
