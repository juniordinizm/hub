import { LESSON_SERVER_FALLBACK_MAX_BYTES } from "@/features/storage/lesson-resource-upload";
import {
  getLessonResourceUploadCorrelationId,
  logLessonResourceUploadEvent,
} from "@/features/storage/lesson-resource-upload-observability";
import {
  getPreparedLessonResourceUpload,
  markLessonResourceUploadUploaded,
} from "@/features/storage/lesson-resource-upload-registry";
import {
  confirmLessonResourceUpload,
  uploadPrivateR2Object,
} from "@/features/storage/r2";
import {
  validateLessonAttachmentUpload,
  validateLessonImagePreviewUpload,
} from "@/features/storage/r2-objects";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const isValidResourceId = (value: FormDataEntryValue | null): value is string =>
  typeof value === "string" && value.trim().length > 0;

export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const session = await requireRole(["admin"]);
  const { lessonId } = await context.params;
  const correlationId = getLessonResourceUploadCorrelationId(request);
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const resourceId = formData.get("resourceId");
  const file = formData.get("file");
  if (!(isValidResourceId(resourceId) && file instanceof File)) {
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

  if (file.size > LESSON_SERVER_FALLBACK_MAX_BYTES) {
    logLessonResourceUploadEvent({
      correlationId,
      errorCode: "lesson_resource_upload_fallback_size_exceeded",
      httpStatus: 413,
      lessonId,
      resourceId: resourceId.trim(),
      sizeBytes: file.size,
      stage: "fallback",
      success: false,
    });
    return Response.json(
      {
        correlationId,
        error:
          "Este arquivo excede o limite do fallback. Atualize a pagina e tente o upload direto novamente.",
      },
      { status: 413 }
    );
  }

  const reference = upload.reference;
  const preview = formData.get("preview");

  try {
    validateLessonAttachmentUpload({
      contentType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
    });
    if (
      file.name !== reference.fileName ||
      file.type !== reference.contentType ||
      file.size !== reference.sizeBytes
    ) {
      throw new Error("O arquivo enviado nao corresponde ao upload preparado.");
    }

    await uploadPrivateR2Object({
      body: Buffer.from(await file.arrayBuffer()),
      contentType: reference.contentType,
      key: reference.key,
    });

    if (reference.preview) {
      if (!(preview instanceof File)) {
        throw new Error("Preview do arquivo ausente.");
      }
      validateLessonImagePreviewUpload({
        contentType: preview.type,
        height: reference.preview.height,
        sizeBytes: preview.size,
        width: reference.preview.width,
      });
      if (
        preview.type !== reference.preview.contentType ||
        preview.size !== reference.preview.sizeBytes
      ) {
        throw new Error("O preview enviado nao corresponde ao preparado.");
      }
      await uploadPrivateR2Object({
        body: Buffer.from(await preview.arrayBuffer()),
        contentType: reference.preview.contentType,
        key: reference.preview.key,
      });
    } else if (preview instanceof File) {
      throw new Error("Preview nao esperado.");
    }

    await confirmLessonResourceUpload({
      contentType: reference.contentType,
      key: reference.key,
      sizeBytes: reference.sizeBytes,
    });
    if (reference.preview) {
      await confirmLessonResourceUpload({
        contentType: reference.preview.contentType,
        key: reference.preview.key,
        sizeBytes: reference.preview.sizeBytes,
      });
    }
    await markLessonResourceUploadUploaded({
      actorUserId: session.user.id,
      lessonId,
      resourceId: reference.id,
    });
    logLessonResourceUploadEvent({
      correlationId,
      httpStatus: 200,
      lessonId,
      resourceId: reference.id,
      sizeBytes: reference.sizeBytes,
      stage: "fallback",
      success: true,
    });

    return Response.json({ reference });
  } catch (error) {
    logLessonResourceUploadEvent({
      correlationId,
      errorCode: "lesson_resource_upload_fallback_failed",
      httpStatus: 400,
      lessonId,
      resourceId: reference.id,
      sizeBytes: reference.sizeBytes,
      stage: "fallback",
      success: false,
    });
    return Response.json(
      {
        correlationId,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel concluir o upload pelo servidor.",
      },
      { status: 400 }
    );
  }
}
