const DEFAULT_MAX_LESSON_ATTACHMENT_BYTES = 50 * 1024 * 1024;

const ALLOWED_LESSON_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const normalizeAscii = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const sanitizeR2FileName = (fileName: string): string => {
  const normalized = normalizeAscii(fileName.trim())
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "arquivo";
};

export const buildLessonResourceObjectKey = ({
  fileName,
  lessonId,
  nonce,
}: {
  fileName: string;
  lessonId: string;
  nonce: string;
}): string =>
  `lessons/${lessonId}/resources/${nonce}-${sanitizeR2FileName(fileName)}`;

export const validateLessonAttachmentUpload = ({
  contentType,
  fileName,
  maxSizeBytes = DEFAULT_MAX_LESSON_ATTACHMENT_BYTES,
  sizeBytes,
}: {
  contentType: string;
  fileName: string;
  maxSizeBytes?: number;
  sizeBytes: number;
}): void => {
  if (!fileName.trim()) {
    throw new Error("Informe o nome do arquivo.");
  }

  if (!ALLOWED_LESSON_ATTACHMENT_TYPES.has(contentType)) {
    throw new Error("Tipo de arquivo nao permitido.");
  }

  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("Tamanho de arquivo invalido.");
  }

  if (sizeBytes > maxSizeBytes) {
    throw new Error("Arquivo maior que 50 MB.");
  }
};
