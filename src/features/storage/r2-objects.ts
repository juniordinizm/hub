export const MAX_LESSON_ATTACHMENT_BYTES = 150 * 1024 * 1024;
export const MAX_LESSON_RESOURCES = 15;
export const MAX_LESSON_R2_RESOURCES_BYTES = 750 * 1024 * 1024;
export const LESSON_RESOURCE_IMAGE_PREVIEW = {
  height: 180,
  maxSizeBytes: 180 * 1024,
  width: 320,
} as const;

const ALLOWED_LESSON_ATTACHMENT_TYPES_BY_EXTENSION = {
  csv: new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]),
  doc: new Set(["application/msword"]),
  docx: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  jpeg: new Set(["image/jpeg"]),
  jpg: new Set(["image/jpeg"]),
  pdf: new Set(["application/pdf"]),
  png: new Set(["image/png"]),
  ppt: new Set(["application/vnd.ms-powerpoint"]),
  pptx: new Set([
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
  txt: new Set(["text/plain"]),
  webp: new Set(["image/webp"]),
  xls: new Set(["application/vnd.ms-excel"]),
  xlsx: new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  zip: new Set(["application/zip", "application/x-zip-compressed"]),
} as const;

export const LESSON_ATTACHMENT_ACCEPT = Object.keys(
  ALLOWED_LESSON_ATTACHMENT_TYPES_BY_EXTENSION
)
  .map((extension) => `.${extension}`)
  .join(",");

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

const getFileExtension = (fileName: string): string | null => {
  const normalized = sanitizeR2FileName(fileName);
  const extension = normalized.split(".").pop();

  return extension && extension !== normalized ? extension : null;
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

export const buildLessonResourcePreviewObjectKey = ({
  lessonId,
  nonce,
}: {
  lessonId: string;
  nonce: string;
}): string => `lessons/${lessonId}/resources/${nonce}-preview.webp`;

export const validateLessonAttachmentUpload = ({
  contentType,
  fileName,
  maxSizeBytes = MAX_LESSON_ATTACHMENT_BYTES,
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

  const extension = getFileExtension(fileName);

  if (
    !(extension && extension in ALLOWED_LESSON_ATTACHMENT_TYPES_BY_EXTENSION)
  ) {
    throw new Error("Extensao de arquivo nao permitida.");
  }

  const allowedContentTypes =
    ALLOWED_LESSON_ATTACHMENT_TYPES_BY_EXTENSION[
      extension as keyof typeof ALLOWED_LESSON_ATTACHMENT_TYPES_BY_EXTENSION
    ];

  if (!allowedContentTypes.has(contentType)) {
    throw new Error("Extensao e tipo do arquivo nao correspondem.");
  }

  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("Tamanho de arquivo invalido.");
  }

  if (sizeBytes > maxSizeBytes) {
    throw new Error("Arquivo maior que 150 MB.");
  }
};

export const validateLessonImagePreviewUpload = ({
  contentType,
  height,
  sizeBytes,
  width,
}: {
  contentType: string;
  height: number;
  sizeBytes: number;
  width: number;
}): void => {
  if (contentType !== "image/webp") {
    throw new Error("Tipo de preview invalido.");
  }

  if (
    width !== LESSON_RESOURCE_IMAGE_PREVIEW.width ||
    height !== LESSON_RESOURCE_IMAGE_PREVIEW.height
  ) {
    throw new Error("Dimensoes do preview invalidas.");
  }

  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("Tamanho do preview invalido.");
  }

  if (sizeBytes > LESSON_RESOURCE_IMAGE_PREVIEW.maxSizeBytes) {
    throw new Error("Preview maior que o permitido.");
  }
};
