import {
  getLessonResourceUploadCorrelationId,
  logLessonResourceUploadEvent,
} from "@/features/storage/lesson-resource-upload-observability";
import { getPreparedLessonResourceUpload } from "@/features/storage/lesson-resource-upload-registry";
import { createLessonResourceUploadUrlForReference } from "@/features/storage/r2";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const session = await requireRole(["admin"]);
  const { lessonId } = await context.params;
  const correlationId = getLessonResourceUploadCorrelationId(request);
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const resourceId = isRecord(body) ? body.resourceId : undefined;
  if (!(typeof resourceId === "string" && resourceId.trim())) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const upload = await getPreparedLessonResourceUpload({
    actorUserId: session.user.id,
    lessonId,
    resourceId: resourceId.trim(),
  });
  if (!upload) {
    return Response.json(
      { error: "Upload temporario nao encontrado ou expirado." },
      { status: 404 }
    );
  }

  try {
    const prepared = await createLessonResourceUploadUrlForReference({
      reference: upload.reference,
    });
    logLessonResourceUploadEvent({
      correlationId,
      httpStatus: 200,
      lessonId,
      resourceId: upload.reference.id,
      sizeBytes: upload.reference.sizeBytes,
      stage: "reissue",
      success: true,
    });
    return Response.json(prepared);
  } catch (error) {
    logLessonResourceUploadEvent({
      correlationId,
      errorCode: "lesson_resource_upload_reissue_failed",
      httpStatus: 400,
      lessonId,
      resourceId: upload.reference.id,
      sizeBytes: upload.reference.sizeBytes,
      stage: "reissue",
      success: false,
    });
    return Response.json(
      {
        correlationId,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel renovar o upload.",
      },
      { status: 400 }
    );
  }
}
