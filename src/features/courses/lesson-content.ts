import type { JSONContent } from "@tiptap/core";
import {
  MAX_LESSON_R2_RESOURCES_BYTES,
  MAX_LESSON_RESOURCES,
} from "@/features/storage/r2-objects";

export type LessonType = "text" | "video";

export type ProseMirrorJson = JSONContent;

export type LessonResource =
  | {
      id: string;
      label: string;
      url: string;
      storage?: "external";
    }
  | {
      contentType: string;
      fileName: string;
      id: string;
      key: string;
      label: string;
      sizeBytes: number;
      storage: "r2";
    };

export type LessonContent =
  | {
      document: ProseMirrorJson;
      resources?: LessonResource[];
      type: "text";
    }
  | {
      body: string;
      type: "text";
    };

export interface LessonContentReadiness {
  isReady: boolean;
  missingLabel: string | null;
}

export const EMPTY_TEXT_DOCUMENT: ProseMirrorJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const LESSON_TYPES = new Set<LessonType>(["text", "video"]);
const LINE_BREAK_PATTERN = /\r?\n/;

export const toLessonType = (value: string): LessonType =>
  LESSON_TYPES.has(value as LessonType) ? (value as LessonType) : "video";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readStringList = (formData: FormData, key: string): string[] =>
  formData.getAll(key).map((value) => String(value ?? "").trim());

const normalizeBody = (value: string): string =>
  value
    .trim()
    .split(LINE_BREAK_PATTERN)
    .map((line) => line.trim())
    .join("\n");

export const createTextDocumentFromPlainText = (
  value: string
): ProseMirrorJson => {
  const body = normalizeBody(value);

  if (!body) {
    return EMPTY_TEXT_DOCUMENT;
  }

  return {
    type: "doc",
    content: body.split(LINE_BREAK_PATTERN).map((line) => ({
      type: "paragraph",
      ...(line
        ? {
            content: [{ type: "text", text: line }],
          }
        : {}),
    })),
  };
};

const normalizeHttpUrl = (value: string): string | null => {
  if (!value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const normalizeStorage = (value: string): "external" | "r2" =>
  value === "r2" ? "r2" : "external";

const normalizePositiveInteger = (value: string): number | null => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const isLessonResourceKey = ({
  key,
  lessonId,
}: {
  key: string;
  lessonId?: string | undefined;
}): boolean => {
  if (!(key && lessonId)) {
    return false;
  }

  return key.startsWith(`lessons/${lessonId}/resources/`);
};

const createR2ResourceFromForm = ({
  contentType,
  fileName,
  index,
  key,
  label,
  lessonId,
  size,
}: {
  contentType: string;
  fileName: string;
  index: number;
  key: string;
  label: string;
  lessonId?: string | undefined;
  size: string;
}): LessonResource | null => {
  if (!key) {
    return null;
  }

  if (!isLessonResourceKey({ key, lessonId })) {
    throw new Error("O arquivo enviado nao pertence a esta aula.");
  }

  const sizeBytes = normalizePositiveInteger(size);

  if (!(fileName && contentType && sizeBytes)) {
    throw new Error("Arquivo da aula invalido.");
  }

  return {
    contentType,
    fileName,
    id: `resource-${index}`,
    key,
    label: label || fileName,
    sizeBytes,
    storage: "r2",
  };
};

const createExternalResourceFromForm = ({
  index,
  label,
  rawUrl,
}: {
  index: number;
  label: string;
  rawUrl: string;
}): LessonResource | null => {
  if (!rawUrl) {
    return null;
  }

  const url = normalizeHttpUrl(rawUrl);

  if (!url) {
    throw new Error("Informe uma URL http ou https valida para o material.");
  }

  return {
    id: `resource-${index}`,
    label: label || "Material da aula",
    url,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isProseMirrorJson = (value: unknown): value is ProseMirrorJson => {
  if (!(isRecord(value) && typeof value.type === "string")) {
    return false;
  }

  if (value.content === undefined) {
    return true;
  }

  return (
    Array.isArray(value.content) &&
    value.content.every((child) => isProseMirrorJson(child))
  );
};

const hasTextContent = (document: ProseMirrorJson): boolean => {
  if (typeof document.text === "string" && document.text.trim()) {
    return true;
  }

  return document.content?.some((child) => hasTextContent(child)) ?? false;
};

const parseTextDocument = (value: string): ProseMirrorJson | null => {
  if (!value) {
    return null;
  }

  try {
    const document: unknown = JSON.parse(value);
    return isProseMirrorJson(document) ? document : null;
  } catch {
    return null;
  }
};

const normalizeResourcesFromForm = ({
  formData,
  lessonId,
}: {
  formData: FormData;
  lessonId?: string | undefined;
}): LessonResource[] => {
  const storages = readStringList(formData, "resourceStorage[]");
  const labels = readStringList(formData, "resourceLabel[]");
  const urls = readStringList(formData, "resourceUrl[]");
  const keys = readStringList(formData, "resourceKey[]");
  const fileNames = readStringList(formData, "resourceFileName[]");
  const contentTypes = readStringList(formData, "resourceContentType[]");
  const sizes = readStringList(formData, "resourceSizeBytes[]");
  const resources: LessonResource[] = [];
  const maxLength = Math.max(labels.length, urls.length, keys.length);

  for (let index = 0; index < maxLength; index += 1) {
    const storage = normalizeStorage(storages[index] ?? "");
    const label = labels[index] ?? "";

    const resource =
      storage === "r2"
        ? createR2ResourceFromForm({
            contentType: contentTypes[index] ?? "",
            fileName: fileNames[index] ?? "",
            index: resources.length + 1,
            key: keys[index] ?? "",
            label,
            lessonId,
            size: sizes[index] ?? "",
          })
        : createExternalResourceFromForm({
            index: resources.length + 1,
            label,
            rawUrl: urls[index] ?? "",
          });

    if (resource) {
      resources.push(resource);
    }
  }

  return resources;
};

const normalizeResources = (value: unknown): LessonResource[] | undefined => {
  if (!Array.isArray(value)) {
    return;
  }

  const resources: LessonResource[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const rawLabel =
      typeof candidate.label === "string" ? candidate.label.trim() : "";
    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id.trim()
        : `resource-${resources.length + 1}`;

    const resource =
      candidate.storage === "r2"
        ? normalizeR2Resource(candidate, id, rawLabel)
        : normalizeExternalResource(candidate, id, rawLabel);

    if (resource) {
      resources.push(resource);
    }
  }

  return resources.length > 0 ? resources : undefined;
};

const normalizeR2Resource = (
  candidate: Record<string, unknown>,
  id: string,
  rawLabel: string
): LessonResource | null => {
  const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
  const fileName =
    typeof candidate.fileName === "string" ? candidate.fileName.trim() : "";
  const contentType =
    typeof candidate.contentType === "string"
      ? candidate.contentType.trim()
      : "";
  const sizeBytes =
    typeof candidate.sizeBytes === "number" &&
    Number.isInteger(candidate.sizeBytes) &&
    candidate.sizeBytes > 0
      ? candidate.sizeBytes
      : null;

  if (!(key && fileName && contentType && sizeBytes)) {
    return null;
  }

  return {
    contentType,
    fileName,
    id,
    key,
    label: rawLabel || fileName,
    sizeBytes,
    storage: "r2",
  };
};

const normalizeExternalResource = (
  candidate: Record<string, unknown>,
  id: string,
  rawLabel: string
): LessonResource | null => {
  const rawUrl = typeof candidate.url === "string" ? candidate.url : "";
  const url = normalizeHttpUrl(rawUrl);

  if (!url) {
    return null;
  }

  return {
    id,
    label: rawLabel || "Material da aula",
    url,
  };
};

const validateLessonResourcesPolicy = (
  resources: LessonResource[]
): LessonResource[] => {
  if (resources.length > MAX_LESSON_RESOURCES) {
    throw new Error("Limite de 15 materiais por aula atingido.");
  }

  const totalR2Bytes = resources.reduce(
    (total, resource) =>
      resource.storage === "r2" ? total + resource.sizeBytes : total,
    0
  );

  if (totalR2Bytes > MAX_LESSON_R2_RESOURCES_BYTES) {
    throw new Error("Limite de 750 MB em materiais da aula atingido.");
  }

  return resources;
};

export const normalizeLessonContentFromForm = ({
  formData,
  lessonId,
  lessonType,
}: {
  formData: FormData;
  lessonId?: string | undefined;
  lessonType: LessonType | string;
}): LessonContent | null => {
  const normalizedLessonType = toLessonType(lessonType);

  if (normalizedLessonType === "video") {
    return null;
  }

  if (normalizedLessonType === "text") {
    const document = parseTextDocument(readString(formData, "textDocument"));

    if (!(document && hasTextContent(document))) {
      throw new Error("Informe o conteudo textual da aula.");
    }

    const resources = validateLessonResourcesPolicy(
      normalizeResourcesFromForm({ formData, lessonId })
    );

    return {
      type: "text",
      document,
      ...(resources.length > 0 ? { resources } : {}),
    };
  }

  return null;
};

const parseLegacyTextContent = (
  candidate: Record<string, unknown>
): LessonContent | null => {
  if (!(candidate.type === "text" && typeof candidate.body === "string")) {
    return null;
  }

  const body = normalizeBody(candidate.body);
  return body ? { type: "text", body } : null;
};

const parseRichTextLessonContent = (
  candidate: Record<string, unknown>
): LessonContent | null => {
  if (!(candidate.type === "text" && isProseMirrorJson(candidate.document))) {
    return null;
  }

  if (!hasTextContent(candidate.document)) {
    return null;
  }

  const resources = normalizeResources(candidate.resources);

  return {
    type: "text",
    document: candidate.document,
    ...(resources ? { resources } : {}),
  };
};

export const parseLessonContent = (value: unknown): LessonContent | null => {
  if (!isRecord(value)) {
    return null;
  }

  return parseRichTextLessonContent(value) ?? parseLegacyTextContent(value);
};

export const getLessonContentReadiness = ({
  contentJson,
  lessonType,
  videoEmbedUrl,
  videoExternalId,
  videoProvider,
}: {
  contentJson: unknown;
  lessonType: string;
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: string | null;
}): LessonContentReadiness => {
  const normalizedLessonType = toLessonType(lessonType);

  if (normalizedLessonType === "video") {
    const hasVideo =
      videoProvider === "jmvstream"
        ? Boolean(videoEmbedUrl?.trim())
        : Boolean(videoEmbedUrl?.trim() || videoExternalId?.trim());

    return hasVideo
      ? { isReady: true, missingLabel: null }
      : { isReady: false, missingLabel: "Adicionar video" };
  }

  const content = parseLessonContent(contentJson);

  if (normalizedLessonType === "text") {
    return content?.type === "text"
      ? { isReady: true, missingLabel: null }
      : { isReady: false, missingLabel: "Adicionar texto" };
  }

  return { isReady: false, missingLabel: "Adicionar video" };
};

export const getLessonContentStorageKeys = (value: unknown): string[] => {
  const content = parseLessonContent(value);

  if (content?.type !== "text" || !("resources" in content)) {
    return [];
  }

  const keys =
    content.resources
      ?.filter((resource) => resource.storage === "r2")
      .map((resource) => resource.key) ?? [];

  return Array.from(new Set(keys));
};
