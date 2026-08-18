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

import { StudentCertificateOperations } from "./student-certificate-operations";
import {
  StudentManagementSheetContent,
  type StudentSheetPayload,
} from "./student-management-sheet";

const globalPayload: StudentSheetPayload = {
  certificates: [
    {
      canReissue: true,
      code: "PRT-1",
      courseId: "course-1",
      courseTitle: "Curso 1",
      id: "certificate-1",
      issuedAt: "2026-01-03T00:00:00.000Z",
      renderStatus: "ready",
      revokedAt: null,
      revokedReasonCategory: null,
      status: "valid",
      studentName: "Student",
      workloadHours: 8,
    },
  ],
  context: { courseId: null, courseTitle: null },
  student: {
    email: "student@example.test",
    enrollments: [
      {
        courseId: "course-1",
        courseTitle: "Curso 1",
        expiresAt: "2026-12-01T00:00:00.000Z",
        id: "enrollment-1",
        originalExpiresAt: "2026-12-01T00:00:00.000Z",
        revokedReason: null,
        startedAt: "2026-01-01T00:00:00.000Z",
        status: "active",
        userId: "student-1",
      },
      {
        courseId: "course-2",
        courseTitle: "Curso 2",
        expiresAt: "2027-01-01T00:00:00.000Z",
        id: "enrollment-2",
        originalExpiresAt: "2027-01-01T00:00:00.000Z",
        revokedReason: null,
        startedAt: "2026-02-01T00:00:00.000Z",
        status: "expired",
        userId: "student-1",
      },
    ],
    name: "Student",
    platformBlockedAt: null,
    platformBlockedReason: null,
    userId: "student-1",
  },
};
const selectedEnrollment = globalPayload.student.enrollments[0];

if (!selectedEnrollment) {
  throw new Error("student fixture must include an enrollment");
}

describe("StudentManagementSheetContent", () => {
  it("shows global platform, enrollment, and certificate sections", () => {
    const markup = renderToStaticMarkup(
      <StudentManagementSheetContent data={globalPayload} onRefresh={vi.fn()} />
    );

    expect(markup).toContain("Acesso na plataforma");
    expect(markup).toContain("Matrículas");
    expect(markup).toContain("Certificados");
    expect(markup).toContain("Curso 1");
    expect(markup).toContain("Curso 2");
    expect(markup).toContain('data-slot="tabs"');
    expect(markup).not.toContain('data-slot="accordion"');
    expect(markup).not.toContain('aria-expanded="');
  });

  it("limits the course context to the selected course and hides platform actions", () => {
    const data: StudentSheetPayload = {
      ...globalPayload,
      certificates: globalPayload.certificates,
      context: { courseId: "course-1", courseTitle: "Curso 1" },
      student: {
        ...globalPayload.student,
        enrollments: [selectedEnrollment],
      },
    };
    const markup = renderToStaticMarkup(
      <StudentManagementSheetContent data={data} onRefresh={vi.fn()} />
    );

    expect(markup).toContain("Curso em contexto");
    expect(markup).toContain("Curso 1");
    expect(markup).not.toContain("Curso 2");
    expect(markup).not.toContain("Acesso na plataforma");
    expect(markup).not.toContain("Bloquear acesso na plataforma");
    expect(markup).not.toContain("Plataforma ativa");
    expect(markup).toContain('data-slot="tabs"');
    expect(markup).not.toContain('data-slot="accordion"');
    expect(markup).not.toContain('aria-expanded="');
  });

  it("explains why manual issuance is unavailable without enrollment", () => {
    const data: StudentSheetPayload = {
      ...globalPayload,
      certificates: [],
      student: { ...globalPayload.student, enrollments: [] },
    };
    const markup = renderToStaticMarkup(
      <StudentManagementSheetContent data={data} onRefresh={vi.fn()} />
    );

    expect(markup).toContain("Sem matrículas");
  });

  it("explains why manual issuance is unavailable without enrollment", () => {
    const markup = renderToStaticMarkup(
      <StudentCertificateOperations
        certificates={[]}
        courses={[]}
        onRefresh={vi.fn()}
        userId="student-1"
      />
    );

    expect(markup).not.toContain("Emitir certificado manual");
    expect(markup).toContain("É necessário matricular a aluna em um Curso");
  });
});
