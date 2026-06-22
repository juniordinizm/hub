import {
  getPreviewLessonData,
  getStudentLessonData,
} from "@/features/courses/server";
import { createR2ObjectReadUrl } from "@/features/storage/r2";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ lessonId: string; resourceId: string }> }
): Promise<Response> {
  const session = await requireSession();
  const { lessonId, resourceId } = await context.params;
  const data =
    session.role === "admin" || session.role === "support"
      ? await getPreviewLessonData({ lessonId })
      : await getStudentLessonData({ lessonId, userId: session.user.id });

  if (data?.lesson.contentJson?.type !== "text") {
    return Response.json({ error: "Preview nao encontrado." }, { status: 404 });
  }

  const resources =
    "resources" in data.lesson.contentJson
      ? data.lesson.contentJson.resources
      : [];
  const resource = resources?.find(
    (item) => item.id === resourceId && item.storage === "r2"
  );

  if (resource?.storage !== "r2" || !resource.preview) {
    return Response.json({ error: "Preview nao encontrado." }, { status: 404 });
  }

  const previewUrl = await createR2ObjectReadUrl({ key: resource.preview.key });

  return new Response(null, {
    headers: {
      "Cache-Control": "private, max-age=300",
      Location: previewUrl,
    },
    status: 302,
  });
}
