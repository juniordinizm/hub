import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/actions", () => ({
  blockStudentPlatformAccessAction: vi.fn(),
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

import { StudentsTable, type StudentTableRow } from "./students-table";
import { createGlobalStudentsTableContext } from "./students-table-context";

const student: StudentTableRow = {
  email: "aluno@example.com",
  lastAccessAt: null,
  name: "Aluno Teste",
  platformBlockedAt: null,
  platformBlockedReason: null,
  status: "active",
  userId: "student-1",
};

describe("StudentsTable", () => {
  it("exposes the shared student action menu with one-line identity columns", () => {
    const markup = renderToStaticMarkup(<StudentsTable students={[student]} />);

    expect(markup).toContain("Nome");
    expect(markup).toContain("E-mail");
    expect(markup).toContain("Ações de Aluno Teste");
    expect(markup).toContain("Acesso ativo");
    expect(markup).toContain("Último acesso");
    expect(markup).toContain("Sem registro");
    expect(markup).not.toContain("Cursos");
    expect(markup).not.toContain("Expiração");
    expect(markup).not.toContain("Gerenciar");
  });

  it("keeps pagination controls without repeating the result count", () => {
    const markup = renderToStaticMarkup(
      <StudentsTable page={2} students={[student]} totalCount={3} />
    );

    expect(markup).toContain("Anterior");
    expect(markup).not.toContain("de 3 alunos");
  });

  it("shows a recorded last access in the compact row", () => {
    const markup = renderToStaticMarkup(
      <StudentsTable
        students={[
          {
            ...student,
            lastAccessAt: "2026-08-05T12:00:00.000Z",
          },
        ]}
      />
    );

    expect(markup).toContain("05/08/2026");
    expect(markup).not.toContain("Sem registro");
  });

  it("exposes the access filter without adding another line to each row", () => {
    const markup = renderToStaticMarkup(
      <StudentsTable
        context={createGlobalStudentsTableContext("blocked")}
        students={[student]}
      />
    );

    expect(markup).toContain("Filtros");
    expect(markup).toContain("Estado do acesso: Plataforma bloqueada");
    expect(markup).not.toContain("Próxima expiração");
  });

  it("distinguishes a filtered empty result from an empty page", () => {
    const markup = renderToStaticMarkup(
      <StudentsTable search="sem resultado" students={[]} totalCount={0} />
    );

    expect(markup).toContain("Nenhum Aluno encontrado");
    expect(markup).toContain(
      "A busca por “sem resultado” não retornou Alunos."
    );
  });
});
