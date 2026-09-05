import { describe, expect, it, vi } from "vitest";

const {
  createLessonResourceDownloadUrl,
  getStudentLessonWorkspace,
  recordLearningAnalyticsEvent,
  requireSession,
} = vi.hoisted(() => ({
  createLessonResourceDownloadUrl: vi.fn(),
  getStudentLessonWorkspace: vi.fn(),
  recordLearningAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
  requireSession: vi.fn(),
}));

vi.mock("@/features/courses/server", () => ({ getStudentLessonWorkspace }));
vi.mock("@/features/storage/r2", () => ({ createLessonResourceDownloadUrl }));
vi.mock("@/features/learning-analytics/server", () => ({
  recordLearningAnalyticsEvent,
}));
vi.mock("@/lib/session", () => ({ requireSession }));

import { GET } from "./route";

describe("lesson resource download", () => {
  it("returns to the lesson with a safe recovery state when R2 is unavailable", async () => {
    requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    getStudentLessonWorkspace.mockResolvedValue({
      data: {
        course: { id: "course-1", title: "Course" },
        isPreview: false,
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
          description: null,
          durationSeconds: 1,
          id: "lesson-1",
          isCompleted: false,
          title: "Lesson",
          videoDurationSeconds: 0,
          videoEmbedUrl: null,
          videoExternalId: null,
          videoProcessingState: null,
          videoProvider: null,
          watchProgress: null,
        },
        modules: [],
        nextLessonId: null,
        previousLessonId: null,
        progressPercent: 0,
      },
      kind: "available",
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
    expect(recordLearningAnalyticsEvent).toHaveBeenCalledWith({
      errorCode: "r2_download_unavailable",
      eventType: "resource_open_failed",
      idempotencyKey: "resource_open_failed/student-1/lesson-1/resource-1/v1",
      lessonId: "lesson-1",
      userId: "student-1",
    });
  });
});
