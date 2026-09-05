import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  query,
  resolveCourseAccess,
  resolveLessonAccess,
  syncJmvstreamLessonPlayer,
} = vi.hoisted(() => ({
  query: vi.fn(),
  resolveCourseAccess: vi.fn(),
  resolveLessonAccess: vi.fn(),
  syncJmvstreamLessonPlayer: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/features/enrollments/access", () => ({
  resolveCourseAccess,
  resolveLessonAccess,
}));
vi.mock("@/features/jmvstream/server", () => ({
  syncJmvstreamLessonPlayer,
}));

import {
  getStudentCourseAccessStatus,
  getStudentLessonWorkspace,
} from "./server";

beforeEach(() => {
  vi.resetAllMocks();
  query.mockResolvedValue({ rows: [] });
  syncJmvstreamLessonPlayer.mockResolvedValue({ playerUrl: null });
});

describe("student course read access", () => {
  it("returns the course access decision from the Matrícula seam", async () => {
    resolveCourseAccess.mockResolvedValue(true);

    await expect(
      getStudentCourseAccessStatus({
        courseId: "course-1",
        userId: "student-1",
      })
    ).resolves.toEqual({
      canAccess: true,
      redirectTo: "/app/cursos/course-1",
    });

    expect(resolveCourseAccess).toHaveBeenCalledWith({
      courseId: "course-1",
      userId: "student-1",
    });
  });

  it("does not query lesson content after Matrícula access is denied", async () => {
    resolveLessonAccess.mockResolvedValue({ kind: "denied" });

    await expect(
      getStudentLessonWorkspace({
        lessonId: "lesson-1",
        viewer: { role: "student", userId: "student-1" },
      })
    ).resolves.toEqual({ kind: "unavailable" });

    expect(resolveLessonAccess).toHaveBeenCalledWith({
      lessonId: "lesson-1",
      userId: "student-1",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps preview reads independent from a Matrícula", async () => {
    await expect(
      getStudentLessonWorkspace({
        lessonId: "missing-lesson",
        viewer: { role: "admin", userId: "admin-1" },
      })
    ).resolves.toEqual({ kind: "unavailable" });

    expect(resolveLessonAccess).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.any(String), ["missing-lesson"]);
  });
});
