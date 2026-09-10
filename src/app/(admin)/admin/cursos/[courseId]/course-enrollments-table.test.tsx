import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/actions", () => ({
  adjustEnrollmentExpirationAction: vi.fn(),
  blockEnrollmentAccessAction: vi.fn(),
  blockStudentPlatformAccessAction: vi.fn(),
  restoreEnrollmentAccessAction: vi.fn(),
  restoreStudentPlatformAccessAction: vi.fn(),
}));
vi.mock("@/features/certificates/actions", () => ({
  issueManualCertificateAction: vi.fn(),
  reissueCertificateAction: vi.fn(),
  revokeCertificateAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { CourseEnrollmentsTable } from "./course-enrollments-table";

describe("CourseEnrollmentsTable", () => {
  it("opens the shared contextual Sheet through one contextual action", () => {
    const markup = renderToStaticMarkup(
      <CourseEnrollmentsTable
        courseId="course-1"
        enrollments={[
          {
            courseId: "course-1",
            courseTitle: "Curso 1",
            email: "student@example.test",
            expiresAt: new Date("2026-12-01T00:00:00.000Z"),
            id: "enrollment-1",
            lastAccessAt: null,
            name: "Student",
            originalExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
            revokedReason: null,
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            status: "active",
            userId: "student-1",
          },
        ]}
      />
    );

    expect(markup).toContain("Ações de Student");
    expect(markup).toContain("Ativa");
    expect(markup).not.toContain(">Matrícula</th>");
    expect(markup).not.toContain("Expira em");
    expect(markup).not.toContain(">Ver<");
  });

  it("preserves the server-side filter and page navigation", () => {
    const markup = renderToStaticMarkup(
      <CourseEnrollmentsTable
        courseId="course-1"
        enrollments={[]}
        hasNextPage
        page={2}
        search="student"
        statusFilter="expired"
        totalCount={51}
      />
    );

    expect(markup).toContain("Nenhum Aluno nesta página");
    expect(markup).toContain('name="enrollmentQ"');
    expect(markup).toContain('name="enrollmentStatus"');
    expect(markup).toContain('value="expired"');
    expect(markup).toContain(
      'href="/admin/cursos/course-1?tab=students&amp;enrollmentQ=student&amp;enrollmentStatus=expired"'
    );
    expect(markup).toContain(
      'href="/admin/cursos/course-1?tab=students&amp;enrollmentQ=student&amp;enrollmentStatus=expired&amp;enrollmentPage=3"'
    );
    expect(markup).not.toContain("de 51 matrículas");
  });
});
