import { describe, expect, it, vi } from "vitest";

const {
  createLessonResourceDownloadUrl,
  getStudentLessonWorkspace,
  requireSession,
} = vi.hoisted(() => ({
  createLessonResourceDownloadUrl: vi.fn(),
  getStudentLessonWorkspace: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/features/courses/server", () => ({ getStudentLessonWorkspace }));
vi.mock("@/features/storage/r2", () => ({ createLessonResourceDownloadUrl }));
vi.mock("@/lib/session", () => ({ requireSession }));

import { GET } from "./route";

describe("lesson resource download", () => {
  it("returns to the lesson with a safe recovery state when R2 is unavailable", async () => {
    requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    getStudentLessonWorkspace.mockResolvedValue({
      lesson: {
        contentJson: {
          document: { type: "doc" },
          resources: [
            {
              fileName: "material.pdf",
              id: "resource-1",
              key: "lessons/lesson-1/material.pdf",
              label: "Material",
              storage: "r2",
            },
          ],
          type: "text",
        },
      },
    });
    createLessonResourceDownloadUrl.mockRejectedValue(new Error("R2 down"));

    const response = await GET(new Request("https://hub.example.test/api"), {
      params: Promise.resolve({
        lessonId: "lesson-1",
        resourceId: "resource-1",
      }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://hub.example.test/app/aulas/lesson-1?material=unavailable"
    );
  });
});
