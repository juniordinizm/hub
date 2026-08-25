import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getSupportCourseOperations: vi.fn(),
  getSupportCourseStudents: vi.fn(),
}));

vi.mock("@/features/admin/support-server", () => dependencies);
vi.mock("./support-course-students-table", () => ({
  SupportCourseStudentsTable: ({
    students,
  }: {
    students: Array<{ email: string }>;
  }) => (
    <div>Consultar {students.map((student) => student.email).join(", ")}</div>
  ),
}));

import SupportCourseStudentsPage from "./page";

describe("SupportCourseStudentsPage", () => {
  it("renders only students from the selected course", async () => {
    dependencies.getSupportCourseOperations.mockResolvedValue([
      {
        activeEnrollmentCount: 1,
        id: "course-1",
        paidOrderCount: 1,
        paidRevenueInCents: 10_000,
        refundedOrderCount: 0,
        refundedRevenueInCents: 0,
        status: "active",
        title: "Curso operacional",
        totalEnrollmentCount: 1,
      },
    ]);
    dependencies.getSupportCourseStudents.mockResolvedValue({
      hasNextPage: false,
      page: 1,
      pageSize: 100,
      students: [
        {
          email: "student@example.test",
          enrollmentId: "enrollment-1",
          enrollmentStatus: "active",
          expiresAt: new Date("2027-01-01T00:00:00Z"),
          name: "Student",
          platformBlocked: false,
          startsAt: new Date("2026-01-01T00:00:00Z"),
          userId: "student-1",
        },
      ],
    });

    const markup = renderToStaticMarkup(
      await SupportCourseStudentsPage({
        params: Promise.resolve({ courseId: "course-1" }),
        searchParams: Promise.resolve({ page: "1" }),
      })
    );

    expect(markup).toContain("Curso operacional");
    expect(markup).toContain("student@example.test");
    expect(markup).toContain("Consultar");
    expect(markup).not.toContain("Gerenciar Curso");
    expect(dependencies.getSupportCourseStudents).toHaveBeenCalledWith(
      "course-1",
      { page: 1 }
    );
  });
});
