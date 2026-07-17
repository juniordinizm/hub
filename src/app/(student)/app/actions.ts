"use server";

import { redirect } from "next/navigation";
import { canMutateStudentExperience } from "@/features/courses/preview";
import {
  completeLesson,
  recordLessonWatchProgress,
} from "@/features/courses/server";
import { sendSupportRequestEmail } from "@/features/email/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const completeLessonAction = async (formData: FormData) => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("Preview de aluno nao permite gravar progresso.");
  }

  const lessonId = String(formData.get("lessonId") ?? "");

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  const result = await completeLesson({
    userId: session.user.id,
    lessonId,
  });

  if (result.nextLessonId) {
    redirect(route(`/app/aulas/${result.nextLessonId}`));
  }

  redirect(route(`/app/cursos/${result.courseId}`));
};

export const recordLessonWatchProgressAction = async ({
  currentSeconds,
  durationSeconds,
  eventName,
  lessonId,
}: {
  currentSeconds: number;
  durationSeconds: number;
  eventName: string;
  lessonId: string;
}): Promise<{
  completed: boolean;
  courseId: string;
  nextLessonId: string | null;
  watchedPercent: number;
}> => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("Preview de aluno nao permite gravar progresso.");
  }

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  return recordLessonWatchProgress({
    currentSeconds,
    durationSeconds,
    eventName,
    lessonId,
    userId: session.user.id,
  });
};

export const sendSupportRequestAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("Preview de aluno nao permite enviar suporte.");
  }

  const subject = readString(formData, "subject");
  const message = readString(formData, "message");
  const courseTitle = readString(formData, "courseTitle") || undefined;

  if (!(subject && message)) {
    throw new Error("Informe assunto e mensagem para o suporte.");
  }

  await sendSupportRequestEmail({
    ...(courseTitle ? { courseTitle } : {}),
    message,
    studentEmail: session.user.email,
    studentName: session.user.name,
    subject,
  });
};
