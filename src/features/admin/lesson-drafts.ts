import {
  type LessonType,
  toLessonType,
} from "@/features/courses/lesson-content";

export interface LessonDraftInput {
  description: string;
  lessonType: LessonType;
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
  const description = readString(formData, "description");

  if (!(moduleId && title && description)) {
    throw new Error("Informe modulo, titulo e subtitulo da aula.");
  }

  return {
    description,
    lessonType: toLessonType(readString(formData, "lessonType") || "video"),
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
