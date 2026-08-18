import { describe, expect, it, vi } from "vitest";

const { getAdminStudentSheetData } = vi.hoisted(() => ({
  getAdminStudentSheetData: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminStudentSheetData,
}));

import { GET } from "./route";

describe("GET /api/admin/students/[userId]", () => {
  it("returns the requested context without caching it", async () => {
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
    getAdminStudentSheetData.mockResolvedValue(data);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/students/student-1?courseId=course-1"
      ),
      { params: Promise.resolve({ userId: "student-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(data);
    expect(getAdminStudentSheetData).toHaveBeenCalledWith({
      courseId: "course-1",
      userId: "student-1",
    });
  });

  it("returns not found when the protected projection has no context", async () => {
    getAdminStudentSheetData.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/admin/students/student-1"),
      { params: Promise.resolve({ userId: "student-1" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Aluno não encontrado." });
  });
});
