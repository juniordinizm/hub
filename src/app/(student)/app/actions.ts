"use server";

import { redirect } from "next/navigation";
import {
  completeLesson,
  syncJmvstreamLessonDuration,
} from "@/features/courses/server";
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

export const syncJmvstreamLessonDurationAction = async ({
  durationSeconds,
  lessonId,
}: {
  durationSeconds: number;
  lessonId: string;
}): Promise<void> => {
  const session = await requireSession();

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  await syncJmvstreamLessonDuration({
    durationSeconds,
    lessonId,
    userId: session.user.id,
  });
};
