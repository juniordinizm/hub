import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { getBootstrapAdminDecision } from "@/lib/auth-policy";
import { getServerEnv } from "@/lib/env";

export const POST = async (request: Request) => {
  const env = getServerEnv();
  const decision = getBootstrapAdminDecision({
    authorization: request.headers.get("authorization"),
    nodeEnv: env.NODE_ENV,
    secret: env.INTERNAL_BOOTSTRAP_SECRET,
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.error },
      { status: decision.status }
    );
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
