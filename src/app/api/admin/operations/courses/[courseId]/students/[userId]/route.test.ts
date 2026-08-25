import { describe, expect, it, vi } from "vitest";

const { getSupportStudentSheetData } = vi.hoisted(() => ({
  getSupportStudentSheetData: vi.fn(),
}));

vi.mock("@/features/admin/support-server", () => ({
  getSupportStudentSheetData,
}));

import { GET } from "./route";

describe("GET /api/admin/operations/courses/[courseId]/students/[userId]", () => {
  it("returns only the explicitly requested course and student context", async () => {
    const data = {
      certificates: [],
      context: { courseId: "course-1", courseTitle: "Curso 1" },
      student: {
        email: "student@example.test",
        enrollments: [],
        name: "Student",
        platformBlockedAt: null,
        platformBlockedReason: null,
        userId: "student-1",
      },
    };
    getSupportStudentSheetData.mockResolvedValue(data);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/operations/courses/course-1/students/student-1"
      ),
      {
        params: Promise.resolve({
          courseId: "course-1",
          userId: "student-1",
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(data);
    expect(getSupportStudentSheetData).toHaveBeenCalledWith({
      courseId: "course-1",
      userId: "student-1",
    });
  });

  it("does not disclose whether an out-of-scope student exists", async () => {
    getSupportStudentSheetData.mockResolvedValue(null);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/operations/courses/course-1/students/student-2"
      ),
      {
        params: Promise.resolve({
          courseId: "course-1",
          userId: "student-2",
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: "Contexto não encontrado.",
    });
  });
});
