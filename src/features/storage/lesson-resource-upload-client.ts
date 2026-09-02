import { LESSON_SERVER_FALLBACK_MAX_BYTES } from "@/features/storage/lesson-resource-upload";
import { validateLessonAttachmentUpload } from "@/features/storage/r2-objects";

export interface LessonResourceUploadPreview {
  blob: Blob;
  contentType: "image/webp";
  height: number;
  width: number;
}

export interface LessonResourceUploadReference {
  contentType: string;
  fileName: string;
  id: string;
  key: string;
  label: string;
  preview?: {
    contentType: "image/webp";
    height: number;
    key: string;
    sizeBytes: number;
    width: number;
  };
  sizeBytes: number;
  storage: "r2";
}

interface PreparedLessonResourceUpload {
  expiresAt: string;
  previewUploadUrl?: string;
  reference: LessonResourceUploadReference;
  uploadUrl: string;
}

class DirectLessonResourceUploadError extends Error {}
class InvalidLessonResourceUploadError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const SUPPORT_CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isPreviewReference = (
  value: unknown
): value is NonNullable<LessonResourceUploadReference["preview"]> => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.contentType === "image/webp" &&
    typeof value.height === "number" &&
    typeof value.key === "string" &&
    typeof value.sizeBytes === "number" &&
    typeof value.width === "number"
  );
};

const isReference = (
  value: unknown
): value is LessonResourceUploadReference => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.contentType === "string" &&
    typeof value.fileName === "string" &&
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    typeof value.label === "string" &&
    (value.preview === undefined || isPreviewReference(value.preview)) &&
    typeof value.sizeBytes === "number" &&
    value.storage === "r2"
  );
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const readSafeError = (value: unknown, fallback: string): string => {
  const message =
    isRecord(value) &&
    typeof value.error === "string" &&
    value.error.length <= 200 &&
    !value.error.includes("://")
      ? value.error
      : fallback;
  const correlationId =
    isRecord(value) &&
    typeof value.correlationId === "string" &&
    SUPPORT_CORRELATION_ID_PATTERN.test(value.correlationId)
      ? value.correlationId
      : null;

  return correlationId
    ? `${message} (ID de suporte: ${correlationId})`
    : message;
};

const readPreparedUpload = async (
  response: Response,
  fallback: string
): Promise<PreparedLessonResourceUpload> => {
  const value = await readJson(response);
  const rawReference = isRecord(value)
    ? (value.reference ?? value.resource)
    : undefined;

  if (
    !(response.ok && isRecord(value)) ||
    typeof value.expiresAt !== "string" ||
    typeof value.uploadUrl !== "string" ||
    !isReference(rawReference) ||
    !(
      value.previewUploadUrl === undefined ||
      typeof value.previewUploadUrl === "string"
    )
  ) {
    throw new Error(readSafeError(value, fallback));
  }

  return {
    expiresAt: value.expiresAt,
    ...(value.previewUploadUrl
      ? { previewUploadUrl: value.previewUploadUrl }
      : {}),
    reference: rawReference,
    uploadUrl: value.uploadUrl,
  };
};

const prepareLessonResourceUpload = async ({
  file,
  lessonId,
  preview,
}: {
  file: File;
  lessonId: string;
  preview: LessonResourceUploadPreview | null | undefined;
}): Promise<PreparedLessonResourceUpload> => {
  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/upload-url`,
    {
      body: JSON.stringify({
        contentType: file.type,
        fileName: file.name,
        ...(preview
          ? {
              preview: {
                contentType: preview.contentType,
                height: preview.height,
                sizeBytes: preview.blob.size,
                width: preview.width,
              },
            }
          : {}),
        sizeBytes: file.size,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );

  return await readPreparedUpload(
    response,
    "Nao foi possivel preparar o upload."
  );
};

const reissueLessonResourceUpload = async ({
  lessonId,
  resourceId,
}: {
  lessonId: string;
  resourceId: string;
}): Promise<PreparedLessonResourceUpload> => {
  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/reissue-url`,
    {
      body: JSON.stringify({ resourceId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );

  return await readPreparedUpload(
    response,
    "Nao foi possivel renovar o upload."
  );
};

const assertSamePreparedObject = (
  initial: LessonResourceUploadReference,
  renewed: LessonResourceUploadReference
): void => {
  if (
    initial.id !== renewed.id ||
    initial.key !== renewed.key ||
    initial.contentType !== renewed.contentType ||
    initial.fileName !== renewed.fileName ||
    initial.sizeBytes !== renewed.sizeBytes ||
    JSON.stringify(initial.preview ?? null) !==
      JSON.stringify(renewed.preview ?? null)
  ) {
    throw new InvalidLessonResourceUploadError(
      "O upload renovado nao corresponde ao material preparado."
    );
  }
};

const putExact = async ({
  body,
  contentType,
  uploadUrl,
}: {
  body: Blob;
  contentType: string;
  uploadUrl: string;
}): Promise<void> => {
  try {
    const bodyBuffer = await body.arrayBuffer();
    const response = await fetch(uploadUrl, {
      body: bodyBuffer,
      headers: { "Content-Type": contentType },
      method: "PUT",
    });

    if (!response.ok) {
      throw new DirectLessonResourceUploadError(
        "O R2 recusou o upload direto."
      );
    }
  } catch (error) {
    if (error instanceof DirectLessonResourceUploadError) {
      throw error;
    }

    throw new DirectLessonResourceUploadError(
      "O upload direto para o R2 falhou."
    );
  }
};

const uploadPreparedObjects = async ({
  file,
  prepared,
  preview,
}: {
  file: File;
  prepared: PreparedLessonResourceUpload;
  preview: LessonResourceUploadPreview | null | undefined;
}): Promise<void> => {
  await putExact({
    body: file,
    contentType: prepared.reference.contentType,
    uploadUrl: prepared.uploadUrl,
  });

  if (preview) {
    if (!prepared.previewUploadUrl) {
      throw new DirectLessonResourceUploadError(
        "Upload de preview indisponivel."
      );
    }

    await putExact({
      body: preview.blob,
      contentType: preview.contentType,
      uploadUrl: prepared.previewUploadUrl,
    });
  }
};

const confirmLessonResourceUpload = async ({
  lessonId,
  resourceId,
}: {
  lessonId: string;
  resourceId: string;
}): Promise<LessonResourceUploadReference> => {
  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/confirm`,
    {
      body: JSON.stringify({ resourceId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
  const value = await readJson(response);

  if (!(response.ok && isRecord(value) && isReference(value.reference))) {
    throw new Error(
      readSafeError(value, "Nao foi possivel confirmar o upload.")
    );
  }

  return value.reference;
};

const uploadThroughServer = async ({
  file,
  lessonId,
  preview,
  resourceId,
}: {
  file: File;
  lessonId: string;
  preview: LessonResourceUploadPreview | null | undefined;
  resourceId: string;
}): Promise<LessonResourceUploadReference> => {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("resourceId", resourceId);
  if (preview) {
    formData.set(
      "preview",
      new File([preview.blob], "preview.webp", { type: preview.contentType })
    );
  }

  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/upload`,
    { body: formData, method: "POST" }
  );
  const value = await readJson(response);

  if (!(response.ok && isRecord(value) && isReference(value.reference))) {
    throw new Error(
      readSafeError(value, "Nao foi possivel concluir o upload pelo servidor.")
    );
  }

  return value.reference;
};

export const uploadLessonResource = async ({
  file,
  lessonId,
  preview,
}: {
  file: File;
  lessonId: string;
  preview?: LessonResourceUploadPreview | null;
}): Promise<LessonResourceUploadReference> => {
  validateLessonAttachmentUpload({
    contentType: file.type,
    fileName: file.name,
    sizeBytes: file.size,
  });

  const initial = await prepareLessonResourceUpload({
    file,
    lessonId,
    preview,
  });

  try {
    await uploadPreparedObjects({ file, prepared: initial, preview });
    return await confirmLessonResourceUpload({
      lessonId,
      resourceId: initial.reference.id,
    });
  } catch {
    let renewed: PreparedLessonResourceUpload;

    try {
      renewed = await reissueLessonResourceUpload({
        lessonId,
        resourceId: initial.reference.id,
      });
      assertSamePreparedObject(initial.reference, renewed.reference);
      await uploadPreparedObjects({ file, prepared: renewed, preview });
      return await confirmLessonResourceUpload({
        lessonId,
        resourceId: renewed.reference.id,
      });
    } catch (error) {
      if (error instanceof InvalidLessonResourceUploadError) {
        throw error;
      }

      if (file.size <= LESSON_SERVER_FALLBACK_MAX_BYTES) {
        return await uploadThroughServer({
          file,
          lessonId,
          preview,
          resourceId: initial.reference.id,
        });
      }

      throw new Error(
        "O R2 recusou o upload. Atualize a página e tente novamente."
      );
    }
  }
};
