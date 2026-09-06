import {
  assertProtectedLessonAccess,
  LessonAccessDeniedError,
} from "@/features/courses/protected-lesson-access";
import { getStudentLessonWorkspace } from "@/features/courses/server";
import { recordLearningAnalyticsEvent } from "@/features/learning-analytics/server";
import { createLessonResourceDownloadUrl } from "@/features/storage/r2";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

const redirectWithoutCaching = (location: string): Response =>
  new Response(null, {
    headers: { ...NO_STORE_HEADERS, Location: location },
    status: 302,
  });

export async function GET(
  request: Request,
  context: { params: Promise<{ lessonId: string; resourceId: string }> }
): Promise<Response> {
  const session = await requireSession();
  const { lessonId, resourceId } = await context.params;
  const data = await getStudentLessonWorkspace({
    lessonId,
    viewer: {
      role: session.role,
      userId: session.user.id,
    },
  });

  if (
    data.kind !== "available" ||
    data.data.lesson.contentJson?.type !== "text"
  ) {
    return Response.json(
      { error: "Material nao encontrado." },
      { headers: NO_STORE_HEADERS, status: 404 }
    );
  }

  const resources =
    "resources" in data.data.lesson.contentJson
      ? data.data.lesson.contentJson.resources
      : [];
  const resource = resources?.find(
    (item) => item.id === resourceId && item.storage === "r2"
  );

  if (resource?.storage !== "r2") {
    return Response.json(
      { error: "Material nao encontrado." },
      { headers: NO_STORE_HEADERS, status: 404 }
    );
  }

  try {
    await assertProtectedLessonAccess({
      courseId: data.data.course.id,
      lessonId,
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof LessonAccessDeniedError) {
      return Response.json(
        { error: "Material nao encontrado." },
        { headers: NO_STORE_HEADERS, status: 404 }
      );
    }
    throw error;
  }

  try {
    const downloadUrl = await createLessonResourceDownloadUrl({
      fileName: resource.fileName,
      key: resource.key,
    });

    return redirectWithoutCaching(downloadUrl);
  } catch {
    await recordLearningAnalyticsEvent({
      errorCode: "r2_download_unavailable",
      eventType: "resource_open_failed",
      idempotencyKey: `resource_open_failed/${session.user.id}/${lessonId}/${resourceId}/v1`,
      lessonId,
      userId: session.user.id,
    }).catch(() => undefined);
    const unavailableUrl = new URL(`/app/aulas/${lessonId}`, request.url);
    unavailableUrl.searchParams.set("material", "unavailable");
    return redirectWithoutCaching(unavailableUrl.toString());
  }
}
