"use server";

import { revalidatePath } from "next/cache";
import {
  createLessonComment,
  hideLessonComment,
} from "@/features/comments/server";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { requireRole, requireSession } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const createLessonCommentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  const lessonId = readString(formData, "lessonId");
  const parentId = readString(formData, "parentId") || null;
  const body = readString(formData, "body");
  const context = readString(formData, "context") || "student";

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  if (context === "student" && !canMutateStudentExperience(session.role)) {
    throw new Error("Preview de aluno nao permite comentar.");
  }

  if (
    context === "admin" &&
    !(session.role === "admin" || session.role === "support")
  ) {
    throw new Error("Acesso administrativo necessario para comentar.");
  }

  const result = await createLessonComment({
    body,
    lessonId,
    parentId,
    role: session.role,
    userId: session.user.id,
  });

  revalidatePath(`/app/aulas/${lessonId}`);
  revalidatePath(`/admin/cursos/${result.courseId}/aulas/${lessonId}`);
};

export const hideLessonCommentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(["admin", "support"]);
  const commentId = readString(formData, "commentId");

  if (!commentId) {
    throw new Error("Comentario invalido.");
  }

  const result = await hideLessonComment({
    actorUserId: session.user.id,
    commentId,
  });

  revalidatePath(`/app/aulas/${result.lessonId}`);
  revalidatePath(`/admin/cursos/${result.courseId}/aulas/${result.lessonId}`);
};
