import { describe, expect, it } from "vitest";
import {
  buildAdminCourseEditPath,
  buildAdminLessonEditPath,
  normalizeLessonDraftInput,
} from "./lesson-drafts";

describe("lesson drafts", () => {
  it("normalizes the minimal lesson draft form", () => {
    const formData = new FormData();
    formData.set("moduleId", "module-1");
    formData.set("title", " Aula inicial ");
    formData.set("sortOrder", "3");

    expect(normalizeLessonDraftInput(formData)).toEqual({
      description: null,
      moduleId: "module-1",
      sortOrder: 3,
      title: "Aula inicial",
    });
  });

  it("requires module and title before creating the editor page", () => {
    const formData = new FormData();
    formData.set("moduleId", "module-1");

    expect(() => normalizeLessonDraftInput(formData)).toThrow(
      "Informe o título da aula."
    );
  });

  it("builds the dedicated admin lesson editor path", () => {
    expect(
      buildAdminLessonEditPath({
        courseId: "course-1",
        lessonId: "lesson-1",
      })
    ).toBe("/admin/cursos/course-1/aulas/lesson-1");
  });

  it("builds the admin course edit path", () => {
    expect(buildAdminCourseEditPath("course-1")).toBe("/admin/cursos/course-1");
  });
});
