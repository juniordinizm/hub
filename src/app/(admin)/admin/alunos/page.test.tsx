import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminStudentsData: vi.fn(),
}));

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
vi.mock("@/features/admin/server", () => ({
  getAdminStudentsData: dependencies.getAdminStudentsData,
}));

import AdminStudentsPage from "./page";

const studentData = {
  accessSummary: {
    activeStudents: 4,
    expiringSoonStudents: 2,
    totalStudents: 6,
    withoutActiveAccessStudents: 2,
  },
  enrollments: [
    {
      contentReleaseMode: "full_access",
      contentReleaseStartedAt: null,
      courseId: "course-1",
      courseTitle: "Curso de exemplo",
      email: "aluno@example.test",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      id: "enrollment-1",
      lastAccessAt: null,
      name: "Aluno exemplo",
      nextModuleReleaseAt: null,
      originalExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
      revokedReason: null,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      status: "active",
      userId: "student-1",
    },
  ],
  hasNextPage: true,
  page: 1,
  pageSize: 50,
  search: "",
  students: [
    {
      activeEnrollments: 1,
      courseCount: 1,
      email: "aluno@example.test",
      firstEnrollmentAt: new Date("2026-01-01T00:00:00.000Z"),
      lastAccessAt: null,
      latestExpiration: new Date("2026-12-01T00:00:00.000Z"),
      name: "Aluno exemplo",
      nextExpiration: new Date("2026-12-01T00:00:00.000Z"),
      platformBlockedAt: null,
      platformBlockedReason: null,
      revokedEnrollments: 0,
      status: "active",
      userId: "student-1",
    },
  ],
  totalCount: 6,
};

beforeEach(() => {
  dependencies.getAdminStudentsData.mockReset();
  dependencies.getAdminStudentsData.mockResolvedValue(studentData);
});

describe("AdminStudentsPage", () => {
  it("keeps global access summary separate from the paginated table", async () => {
    dependencies.getAdminStudentsData.mockResolvedValue({
      ...studentData,
      hasNextPage: false,
      page: 2,
      search: "aluno",
      totalCount: 51,
    });

    const markup = renderToStaticMarkup(
      await AdminStudentsPage({
        searchParams: Promise.resolve({ page: "2", q: "aluno" }),
      })
    );

    expect(dependencies.getAdminStudentsData).toHaveBeenCalledWith({
      page: 2,
      search: "aluno",
    });
    expect(markup).toContain("Resumo de acesso");
    expect(markup).toContain("Lista de Alunos");
    expect(markup).toContain("Acesso ativo");
    expect(markup).not.toContain("Próxima expiração");
    expect(markup).toContain("Filtros");
    expect(markup).toContain("Busca: aluno");
  });

  it("explains an out-of-range page without claiming there are no students", async () => {
    dependencies.getAdminStudentsData.mockResolvedValue({
      ...studentData,
      hasNextPage: false,
      page: 2,
      students: [],
      totalCount: 51,
    });

    const markup = renderToStaticMarkup(
      await AdminStudentsPage({
        searchParams: Promise.resolve({ page: "2" }),
      })
    );

    expect(markup).toContain("Nenhum Aluno nesta página");
    expect(markup).toContain(
      "Volte uma página para continuar consultando os Alunos."
    );
    expect(markup).not.toContain("Nenhum Aluno cadastrado");
  });

  it("preserves the access filter in the server query and table controls", async () => {
    const markup = renderToStaticMarkup(
      await AdminStudentsPage({
        searchParams: Promise.resolve({ access: "blocked" }),
      })
    );

    expect(dependencies.getAdminStudentsData).toHaveBeenCalledWith({
      access: "blocked",
      page: 1,
    });
    expect(markup).toContain("Estado do acesso: Plataforma bloqueada");
    expect(markup).toContain('name="access"');
    expect(markup).toContain('value="blocked"');
  });
});
