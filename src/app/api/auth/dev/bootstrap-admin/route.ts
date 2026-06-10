import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

export const POST = async (request: Request) => {
  const env = getServerEnv();

  if (env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const authorization = request.headers.get("authorization");

  if (
    env.INTERNAL_BOOTSTRAP_SECRET &&
    authorization !== `Bearer ${env.INTERNAL_BOOTSTRAP_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    password?: string;
  };

  if (!(body.email && body.name && body.password)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const result = await getAuth().api.signUpEmail({
    body: {
      email: body.email,
      name: body.name,
      password: body.password,
    },
  });

  await getDb()
    .insert(profiles)
    .values({
      role: "admin",
      userId: result.user.id,
    })
    .onConflictDoUpdate({
      set: { role: "admin" },
      target: profiles.userId,
    });

  return NextResponse.json({
    ok: true,
    userId: result.user.id,
  });
};
