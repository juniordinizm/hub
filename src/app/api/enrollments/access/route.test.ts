import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  canMutateStudentExperience,
  getCurrentSession,
  getStudentCourseAccessStatus,
} = vi.hoisted(() => ({
  canMutateStudentExperience: vi.fn(),
  getCurrentSession: vi.fn(),
  getStudentCourseAccessStatus: vi.fn(),
}));

vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience,
}));
vi.mock("@/features/courses/server", () => ({
  getStudentCourseAccessStatus,
}));
vi.mock("@/lib/session", () => ({ getCurrentSession }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  canMutateStudentExperience.mockReturnValue(true);
  getStudentCourseAccessStatus.mockResolvedValue({
    canAccess: true,
    redirectTo: "/app/cursos/course-1",
  });
});

describe("student enrollment access route", () => {
  it("rejects a platform-blocked student before reading course access", async () => {
    getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-08-19T00:00:00.000Z"),
      platformBlockedReason: "security",
      role: "student",
      user: { id: "student-1", name: "Student", email: "student@example.com" },
    });

    const response = await GET(
      new Request("http://localhost/api/enrollments/access?courseId=course-1")
    );

    expect(response.status).toBe(403);
    expect(getStudentCourseAccessStatus).not.toHaveBeenCalled();
  });
});
