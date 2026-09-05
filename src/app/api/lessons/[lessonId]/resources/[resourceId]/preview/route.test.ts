import { describe, expect, it, vi } from "vitest";

const { createR2ObjectReadUrl, getStudentLessonWorkspace, requireSession } =
  vi.hoisted(() => ({
    createR2ObjectReadUrl: vi.fn(),
    getStudentLessonWorkspace: vi.fn(),
    requireSession: vi.fn(),
  }));

vi.mock("@/features/courses/server", () => ({ getStudentLessonWorkspace }));
vi.mock("@/features/storage/r2", () => ({ createR2ObjectReadUrl }));
vi.mock("@/lib/session", () => ({ requireSession }));

import { GET } from "./route";

describe("lesson resource preview", () => {
  it("does not sign a future module resource", async () => {
    requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    getStudentLessonWorkspace.mockResolvedValue({
      availableAt: new Date("2026-09-12T12:00:00.000Z"),
      courseId: "course-1",
      kind: "time_locked",
    });

    const response = await GET(new Request("https://hub.example.test/api"), {
      params: Promise.resolve({
        lessonId: "lesson-1",
        resourceId: "resource-1",
      }),
    });

    expect(response.status).toBe(404);
    expect(createR2ObjectReadUrl).not.toHaveBeenCalled();
  });
});
