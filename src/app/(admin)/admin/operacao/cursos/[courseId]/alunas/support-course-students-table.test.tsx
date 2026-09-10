import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
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
vi.mock("@/components/admin/student-management-sheet", () => ({
  StudentManagementSheet: ({ trigger }: { trigger: ReactNode }) => (
    <>{trigger}</>
  ),
}));

import { SupportCourseStudentsTable } from "./support-course-students-table";

describe("SupportCourseStudentsTable", () => {
  it("keeps search and pagination in the server-owned page", () => {
    const markup = renderToStaticMarkup(
      <SupportCourseStudentsTable
        courseId="course-1"
        students={[
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
        ]}
      />
    );

    expect(markup).toContain("Ações de Student");
    expect(markup).toContain("Nome");
    expect(markup).toContain("E-mail");
    expect(markup).toContain('scope="col"');
    expect(markup).not.toContain('aria-label="Buscar na tabela"');
    expect(markup).not.toContain("Itens por página");
  });
});
