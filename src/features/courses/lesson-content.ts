import type { JSONContent } from "@tiptap/core";

export type LessonType = "text" | "video";

export type ProseMirrorJson = JSONContent;

export interface LessonResource {
  id: string;
  label: string;
  url: string;
}

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

const normalizeResourcesFromForm = (formData: FormData): LessonResource[] => {
  const labels = readStringList(formData, "resourceLabel[]");
  const urls = readStringList(formData, "resourceUrl[]");
  const resources: LessonResource[] = [];
  const maxLength = Math.max(labels.length, urls.length);

  for (let index = 0; index < maxLength; index += 1) {
    const label = labels[index] ?? "";
    const rawUrl = urls[index] ?? "";

    if (!rawUrl) {
      continue;
    }

    const url = normalizeHttpUrl(rawUrl);

    if (!url) {
      throw new Error("Informe uma URL http ou https valida para o material.");
    }

    resources.push({
      id: `resource-${resources.length + 1}`,
      label: label || "Material da aula",
      url,
    });
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
    const rawUrl = typeof candidate.url === "string" ? candidate.url : "";
    const url = normalizeHttpUrl(rawUrl);

    if (!url) {
      continue;
    }

    resources.push({
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id.trim()
          : `resource-${resources.length + 1}`,
      label: rawLabel || "Material da aula",
      url,
    });
  }

  return resources.length > 0 ? resources : undefined;
};

export const normalizeLessonContentFromForm = ({
  formData,
  lessonType,
}: {
  formData: FormData;
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

    const resources = normalizeResourcesFromForm(formData);

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
