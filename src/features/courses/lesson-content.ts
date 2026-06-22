export type LessonType = "bonus" | "presentation" | "text" | "video";

export type LessonContent =
  | {
      type: "presentation";
      url: string;
    }
  | {
      body: string;
      type: "text";
    }
  | {
      body: string;
      type: "bonus";
      url?: string;
    };

export interface LessonContentReadiness {
  isReady: boolean;
  missingLabel: string | null;
}

const LESSON_TYPES = new Set<LessonType>([
  "bonus",
  "presentation",
  "text",
  "video",
]);
const LINE_BREAK_PATTERN = /\r?\n/;

export const toLessonType = (value: string): LessonType =>
  LESSON_TYPES.has(value as LessonType) ? (value as LessonType) : "video";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const normalizeBody = (value: string): string =>
  value
    .trim()
    .split(LINE_BREAK_PATTERN)
    .map((line) => line.trim())
    .join("\n");

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

  if (normalizedLessonType === "presentation") {
    const url = normalizeHttpUrl(readString(formData, "presentationUrl"));

    if (!url) {
      throw new Error(
        "Informe uma URL http ou https valida para a apresentacao."
      );
    }

    return {
      type: "presentation",
      url,
    };
  }

  if (normalizedLessonType === "text") {
    const body = normalizeBody(readString(formData, "textBody"));

    if (!body) {
      throw new Error("Informe o conteudo textual da aula.");
    }

    return {
      type: "text",
      body,
    };
  }

  const body = normalizeBody(readString(formData, "bonusBody"));

  if (!body) {
    throw new Error("Informe o conteudo da aula bonus.");
  }

  const url = normalizeHttpUrl(readString(formData, "bonusUrl"));
  const content: LessonContent = {
    type: "bonus",
    body,
  };

  return url ? { ...content, url } : content;
};

export const parseLessonContent = (value: unknown): LessonContent | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.type === "presentation" && typeof candidate.url === "string") {
    const url = normalizeHttpUrl(candidate.url);
    return url ? { type: "presentation", url } : null;
  }

  if (candidate.type === "text" && typeof candidate.body === "string") {
    const body = normalizeBody(candidate.body);
    return body ? { type: "text", body } : null;
  }

  if (candidate.type === "bonus" && typeof candidate.body === "string") {
    const body = normalizeBody(candidate.body);
    const url =
      typeof candidate.url === "string"
        ? normalizeHttpUrl(candidate.url)
        : null;

    if (!body) {
      return null;
    }

    return url ? { type: "bonus", body, url } : { type: "bonus", body };
  }

  return null;
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

  if (normalizedLessonType === "presentation") {
    return content?.type === "presentation"
      ? { isReady: true, missingLabel: null }
      : { isReady: false, missingLabel: "Adicionar apresentacao" };
  }

  if (normalizedLessonType === "text") {
    return content?.type === "text"
      ? { isReady: true, missingLabel: null }
      : { isReady: false, missingLabel: "Adicionar texto" };
  }

  return content?.type === "bonus"
    ? { isReady: true, missingLabel: null }
    : { isReady: false, missingLabel: "Adicionar bonus" };
};
