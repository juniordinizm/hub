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
  SupportContextPanel,
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
const adminCapabilities = {
  canManageCertificates: true,
  canManageEnrollmentSupport: true,
  canManagePlatformAccess: true,
  canReissueCertificates: true,
} as const;
const supportCapabilities = {
  canManageCertificates: false,
  canManageEnrollmentSupport: true,
  canManagePlatformAccess: false,
  canReissueCertificates: true,
} as const;

if (!selectedEnrollment) {
  throw new Error("student fixture must include an enrollment");
}

describe("StudentManagementSheetContent", () => {
  it("shows global platform, enrollment, and certificate sections", () => {
    const markup = renderToStaticMarkup(
      <StudentManagementSheetContent
        capabilities={adminCapabilities}
        data={globalPayload}
        onRefresh={vi.fn()}
        showActions={false}
      />
    );

    expect(markup).toContain("Acesso na plataforma");
    expect(markup).toContain("Cursos do Aluno");
    expect(markup).toContain("Certificados");
    expect(markup).toContain("Curso 1");
    expect(markup).toContain("Curso 2");
    expect(markup).not.toContain("Bloquear acesso");
    expect(markup).not.toContain('data-slot="tabs"');
    expect(markup).not.toContain('data-slot="accordion"');
    expect(markup).toContain("Abrir no Curso");
    expect(markup).toContain(
      'href="/admin/cursos/course-1?tab=students&amp;enrollmentStudentId=student-1"'
    );
    expect(markup).not.toContain("aria-pressed=");
    expect(markup).not.toContain('aria-controls="enrollment-');
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
      <StudentManagementSheetContent
        capabilities={adminCapabilities}
        data={data}
        onRefresh={vi.fn()}
        showActions={false}
      />
    );

    expect(markup).toContain("Curso em contexto");
    expect(markup).toContain("Curso 1");
    expect(markup).not.toContain("Curso 2");
    expect(markup).not.toContain("Acesso na plataforma");
    expect(markup).not.toContain("Bloquear acesso na plataforma");
    expect(markup).not.toContain("Plataforma ativa");
    expect(markup).not.toContain("Ajustar validade");
    expect(markup).not.toContain('data-slot="tabs"');
    expect(markup).not.toContain('data-slot="accordion"');
    expect(markup).not.toContain('data-slot="dialog-trigger"');
    expect(markup).not.toContain("aria-pressed=");
    expect(markup).not.toContain('aria-controls="enrollment-');
  });

  it("explains why manual issuance is unavailable without enrollment", () => {
    const data: StudentSheetPayload = {
      ...globalPayload,
      certificates: [],
      student: { ...globalPayload.student, enrollments: [] },
    };
    const markup = renderToStaticMarkup(
      <StudentManagementSheetContent
        capabilities={adminCapabilities}
        data={data}
        onRefresh={vi.fn()}
      />
    );

    expect(markup).toContain("Sem matrículas");
  });

  it("explains why manual issuance is unavailable without enrollment", () => {
    const markup = renderToStaticMarkup(
      <StudentCertificateOperations
        canIssue={true}
        canReissue={true}
        canRevoke={true}
        certificates={[]}
        courses={[]}
        onRefresh={vi.fn()}
        userId="student-1"
      />
    );

    expect(markup).not.toContain("Emitir certificado manual");
    expect(markup).toContain("É necessário matricular o aluno em um Curso");
  });

  it("offers manual issuance only when the selected Course has no certificate", () => {
    const withCertificate = renderToStaticMarkup(
      <StudentCertificateOperations
        canIssue={true}
        canReissue={true}
        canRevoke={true}
        certificates={globalPayload.certificates.slice(0, 1)}
        courses={[selectedEnrollment]}
        onRefresh={vi.fn()}
        userId="student-1"
      />
    );
    const withoutCertificate = renderToStaticMarkup(
      <StudentCertificateOperations
        canIssue={true}
        canReissue={true}
        canRevoke={true}
        certificates={[]}
        courses={[selectedEnrollment]}
        onRefresh={vi.fn()}
        userId="student-1"
      />
    );

    expect(withCertificate).not.toContain("Nova emissão");
    expect(withCertificate).toContain("Ações");
    expect(withoutCertificate).toContain("Nova emissão");
    expect(withoutCertificate).toContain("Emitir certificado manual");
  });

  it("keeps support in course scope without platform controls", () => {
    const supportData: StudentSheetPayload = {
      ...globalPayload,
      context: { courseId: "course-1", courseTitle: "Curso 1" },
      student: {
        ...globalPayload.student,
        enrollments: [selectedEnrollment],
      },
      certificates: globalPayload.certificates.slice(0, 1),
      supportContext: {
        audit: [
          {
            action: "enrollment.expiration_extended",
            createdAt: "2026-05-02T00:00:00.000Z",
            targetId: "enrollment-1",
            targetType: "enrollment",
          },
        ],
        orders: [
          {
            amountInCents: 10_000,
            createdAt: "2026-05-01T00:00:00.000Z",
            id: "order-1",
            paidAmountInCents: 10_000,
            refundStatus: null,
            refundedAmountInCents: null,
            status: "paid",
          },
        ],
        progress: { completedRequiredLessons: 4, requiredLessons: 6 },
      },
    };
    const markup = renderToStaticMarkup(
      <StudentManagementSheetContent
        capabilities={supportCapabilities}
        data={supportData}
        onRefresh={vi.fn()}
      />
    );

    expect(markup).not.toContain("Acesso na plataforma");
    expect(markup).not.toContain("Bloquear acesso na plataforma");
    expect(markup).toContain("Detalhes da matrícula");
    expect(markup).not.toContain("Nova emissão");
    expect(markup).toContain("Operação");
  });

  it("renders the approved scoped progress, finance and history projection", () => {
    const context = {
      audit: [
        {
          action: "enrollment.expiration_extended",
          createdAt: "2026-05-02T00:00:00.000Z",
          targetId: "enrollment-1",
          targetType: "enrollment",
        },
      ],
      orders: [
        {
          amountInCents: 10_000,
          createdAt: "2026-05-01T00:00:00.000Z",
          id: "order-1",
          paidAmountInCents: 10_000,
          refundStatus: null,
          refundedAmountInCents: null,
          status: "paid",
        },
      ],
      progress: { completedRequiredLessons: 4, requiredLessons: 6 },
    };

    const markup = renderToStaticMarkup(
      <SupportContextPanel context={context} />
    );

    expect(markup).toContain("4 de 6 aulas obrigatórias");
    expect(markup).toContain("Pedido order-1");
    expect(markup).toContain("enrollment.expiration_extended");
  });

  it("announces an invalid content schedule without exposing mutation controls", () => {
    const markup = renderToStaticMarkup(
      <SupportContextPanel
        context={{
          audit: [],
          contentReleaseMode: "scheduled",
          contentReleaseState: "invalid_schedule",
          orders: [],
          progress: { completedRequiredLessons: 0, requiredLessons: 0 },
        }}
      />
    );

    expect(markup).toContain("Cronograma inválido. Encaminhe para Engenharia.");
    expect(markup).not.toContain("override");
  });

  it("lets support reissue but never issue or revoke certificates", () => {
    const markup = renderToStaticMarkup(
      <StudentCertificateOperations
        canIssue={false}
        canReissue={true}
        canRevoke={false}
        certificates={globalPayload.certificates}
        courses={globalPayload.student.enrollments}
        onRefresh={vi.fn()}
        userId="student-1"
      />
    );

    expect(markup).toContain("Ações do certificado");
    expect(markup).not.toContain("Emitir certificado manual");
    expect(markup).not.toContain("Revogar");
  });
});
