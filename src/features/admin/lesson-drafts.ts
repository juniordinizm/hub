import { LessonAuthoringError } from "@/features/admin/lesson-authoring-errors";

export interface LessonDraftInput {
  description: string | null;
  moduleId: string;
  sortOrder: number;
  title: string;
}

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readNumber = (formData: FormData, key: string, fallback = 1): number => {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
};

export const normalizeLessonDraftInput = (
  formData: FormData
): LessonDraftInput => {
  const moduleId = readString(formData, "moduleId");
  const title = readString(formData, "title");
  const description = readString(formData, "description") || null;

  if (!moduleId) {
    throw new LessonAuthoringError("Informe o módulo da aula.");
  }

  if (!title) {
    throw new LessonAuthoringError("Informe o título da aula.", "title");
  }

  return {
    description,
    moduleId,
    sortOrder: readNumber(formData, "sortOrder", 1),
    title,
  };
};

export const buildAdminLessonEditPath = ({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}): string => `/admin/cursos/${courseId}/aulas/${lessonId}`;

export const buildAdminCourseEditPath = (courseId: string): string =>
  `/admin/cursos/${courseId}`;
