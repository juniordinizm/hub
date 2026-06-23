import type { ProseMirrorJson } from "./lesson-content";

export const READING_WORDS_PER_MINUTE = 260;
const SECONDS_PER_MINUTE = 60;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu;

export interface LessonDurationBreakdown {
  textDurationSeconds: number;
  textWordCount: number;
  totalDurationSeconds: number;
  videoDurationSeconds: number;
}

export const extractTextFromDocument = (document: ProseMirrorJson): string => {
  const textParts: string[] = [];
  collectText(document, textParts);
  return textParts.join(" ").trim();
};

export const countTextWords = (document: ProseMirrorJson | null): number => {
  if (!document) {
    return 0;
  }

  return extractTextFromDocument(document).match(WORD_PATTERN)?.length ?? 0;
};

export const estimateReadingDurationSeconds = (wordCount: number): number => {
  if (!(Number.isFinite(wordCount) && wordCount > 0)) {
    return 0;
  }

  const readingMinutes = wordCount / READING_WORDS_PER_MINUTE;
  return Math.ceil(readingMinutes) * SECONDS_PER_MINUTE;
};

export const calculateLessonDurationBreakdown = ({
  textDocument,
  videoDurationSeconds,
}: {
  textDocument: ProseMirrorJson | null;
  videoDurationSeconds: number;
}): LessonDurationBreakdown => {
  const safeVideoDurationSeconds =
    Number.isFinite(videoDurationSeconds) && videoDurationSeconds > 0
      ? Math.round(videoDurationSeconds)
      : 0;
  const textWordCount = countTextWords(textDocument);
  const textDurationSeconds = estimateReadingDurationSeconds(textWordCount);

  return {
    videoDurationSeconds: safeVideoDurationSeconds,
    textWordCount,
    textDurationSeconds,
    totalDurationSeconds: safeVideoDurationSeconds + textDurationSeconds,
  };
};

const collectText = (
  node: ProseMirrorJson | undefined,
  textParts: string[]
): void => {
  if (!node) {
    return;
  }

  if (typeof node.text === "string" && node.text.trim()) {
    textParts.push(node.text);
  }

  for (const child of node.content ?? []) {
    collectText(child, textParts);
  }
};
