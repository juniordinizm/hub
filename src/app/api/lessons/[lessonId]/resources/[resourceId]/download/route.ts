import { getStudentLessonWorkspace } from "@/features/courses/server";
import { recordLearningAnalyticsEvent } from "@/features/learning-analytics/server";
import { createLessonResourceDownloadUrl } from "@/features/storage/r2";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

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

  if (data?.lesson.contentJson?.type !== "text") {
    return Response.json(
      { error: "Material nao encontrado." },
      { status: 404 }
    );
  }

  const resources =
    "resources" in data.lesson.contentJson
      ? data.lesson.contentJson.resources
      : [];
  const resource = resources?.find(
    (item) => item.id === resourceId && item.storage === "r2"
  );

  if (resource?.storage !== "r2") {
    return Response.json(
      { error: "Material nao encontrado." },
      { status: 404 }
    );
  }

  try {
    const downloadUrl = await createLessonResourceDownloadUrl({
      fileName: resource.fileName,
      key: resource.key,
    });

    return Response.redirect(downloadUrl, 302);
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
    return Response.redirect(unavailableUrl, 302);
  }
}
