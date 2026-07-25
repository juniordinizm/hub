import { describe, expect, it } from "vitest";
import { getAffectedLessonReorderGroups } from "./course-builder-reorder";

describe("getAffectedLessonReorderGroups", () => {
  it("renumbers both modules when an admin moves a lesson between them", () => {
    const initialLessons = [
      { id: "lesson-1", moduleId: "module-a" },
      { id: "lesson-2", moduleId: "module-a" },
      { id: "lesson-3", moduleId: "module-b" },
    ];
    const currentLessons = [
      { id: "lesson-1", moduleId: "module-a" },
      { id: "lesson-3", moduleId: "module-b" },
      { id: "lesson-2", moduleId: "module-b" },
    ];

    expect(
      getAffectedLessonReorderGroups({
        activeLessonId: "lesson-2",
        currentLessons,
        initialLessons,
      })
    ).toEqual([
      { lessonIds: ["lesson-1"], moduleId: "module-a" },
      { lessonIds: ["lesson-3", "lesson-2"], moduleId: "module-b" },
    ]);
  });

  it("returns only the current module for an in-module reorder", () => {
    const lessons = [
      { id: "lesson-2", moduleId: "module-a" },
      { id: "lesson-1", moduleId: "module-a" },
    ];

    expect(
      getAffectedLessonReorderGroups({
        activeLessonId: "lesson-1",
        currentLessons: lessons,
        initialLessons: [...lessons].reverse(),
      })
    ).toEqual([{ lessonIds: ["lesson-2", "lesson-1"], moduleId: "module-a" }]);
  });
});
