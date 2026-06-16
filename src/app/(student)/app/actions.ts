"use server";

import { redirect } from "next/navigation";
import { completeLesson } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const completeLessonAction = async (formData: FormData) => {
  const session = await requireSession();
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
