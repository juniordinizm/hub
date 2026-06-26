import type { AppRole } from "@/lib/session";

export const COMMENT_BODY_MAX_LENGTH = 2000;

export type LessonCommentStatus = "hidden" | "visible";

export interface LessonCommentAuthor {
  id: string;
  name: string;
  role: AppRole;
}

export interface LessonCommentRecord {
  author: LessonCommentAuthor;
  body: string;
  createdAt: Date;
  id: string;
  lessonId: string;
  parentId: string | null;
  status: LessonCommentStatus;
  updatedAt: Date;
}

export interface LessonCommentView {
  author: LessonCommentAuthor;
  body: string | null;
  createdAt: Date;
  id: string;
  isHidden: boolean;
  parentId: string | null;
  replies: LessonCommentView[];
  updatedAt: Date;
}

export const normalizeCommentBody = (value: string): string => {
  const body = value.trim();

  if (!body) {
    throw new Error("Escreva um comentario antes de enviar.");
  }

  if (body.length > COMMENT_BODY_MAX_LENGTH) {
    throw new Error(
      `O comentario deve ter ate ${COMMENT_BODY_MAX_LENGTH} caracteres.`
    );
  }

  return body;
};

export const validateReplyTarget = ({
  lessonId,
  parent,
}: {
  lessonId: string;
  parent: Pick<LessonCommentRecord, "id" | "lessonId" | "parentId">;
}): void => {
  if (parent.lessonId !== lessonId) {
    throw new Error("Comentario de origem invalido.");
  }

  if (parent.parentId) {
    throw new Error("Responda apenas comentarios principais.");
  }
};

export const sanitizeLessonComment = (
  comment: LessonCommentRecord
): LessonCommentView => {
  const isHidden = comment.status === "hidden";

  return {
    id: comment.id,
    parentId: comment.parentId,
    body: isHidden ? null : comment.body,
    isHidden,
    author: comment.author,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    replies: [],
  };
};

export const buildLessonCommentTree = (
  comments: LessonCommentRecord[]
): LessonCommentView[] => {
  const orderedComments = comments.toSorted((a, b) => {
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    return createdDiff === 0 ? a.id.localeCompare(b.id) : createdDiff;
  });
  const roots = new Map<string, LessonCommentView>();

  for (const comment of orderedComments) {
    if (comment.parentId) {
      continue;
    }

    roots.set(comment.id, sanitizeLessonComment(comment));
  }

  for (const comment of orderedComments) {
    if (!comment.parentId) {
      continue;
    }

    roots.get(comment.parentId)?.replies.push(sanitizeLessonComment(comment));
  }

  return [...roots.values()].reverse();
};
