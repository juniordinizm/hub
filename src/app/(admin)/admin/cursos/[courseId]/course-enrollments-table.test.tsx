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
  it("opens the shared contextual Sheet through one Gerenciar action", () => {
    const markup = renderToStaticMarkup(
      <CourseEnrollmentsTable
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

    expect(markup).toContain("Gerenciar");
    expect(markup).not.toContain(">Ver<");
  });
});
