import { NextResponse } from "next/server";
import { getStudentCourseAccessStatus } from "@/features/courses/server";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = async (request: Request): Promise<Response> => {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");

  if (!courseId) {
    return NextResponse.json(
      { error: "Curso nao informado." },
      { status: 400 }
    );
  }

  const access = await getStudentCourseAccessStatus({
    courseId,
    userId: session.user.id,
  });

  return NextResponse.json(access);
};
