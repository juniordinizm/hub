import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getAdminAuditData: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminAuditData: dependencies.getAdminAuditData,
}));
vi.mock("@/features/admin/audit-types", () => ({}));
vi.mock("./audit-log-details-sheet", () => ({
  AuditLogDetailsSheet: () => <button type="button">Detalhes</button>,
}));

import AuditoriaPage from "./page";

describe("AuditoriaPage", () => {
  it("renders a filterable administrative audit table without email data", async () => {
    dependencies.getAdminAuditData.mockResolvedValue({
      auditLogs: [
        {
          action: "course.updated",
          actorEmail: "admin@example.test",
          actorName: "Administradora",
          actorRole: "admin",
          createdAt: new Date("2026-09-07T12:30:00Z"),
          id: "audit-1",
          metadata: {},
          source: "administrative",
          targetId: "course-1",
          targetName: "Curso de exemplo",
          targetType: "course",
        },
      ],
      hasNextPage: true,
      page: 1,
      pageSize: 25,
      totalCount: 26,
    });

    const markup = renderToStaticMarkup(
      await AuditoriaPage({
        searchParams: Promise.resolve({
          q: "curso",
          source: "administrative",
          target: "course",
        }),
      })
    );

    expect(markup).toContain("Auditoria administrativa");
    expect(markup).toContain("Eventos registrados");
    expect(markup).toContain("Curso atualizado");
    expect(markup).toContain("Curso de exemplo");
    expect(markup).toContain("Administradora");
    expect(markup).toContain("07/09/2026");
    expect(markup).toContain("Detalhes");
    expect(markup).toContain("Próximos");
    expect(markup).not.toContain("admin@example.test");
    expect(markup).not.toContain("Sinais operacionais");
    expect(dependencies.getAdminAuditData).toHaveBeenCalledWith({
      page: 1,
      search: "curso",
      source: "administrative",
      targetType: "course",
    });
  });

  it("shows a useful empty state", async () => {
    dependencies.getAdminAuditData.mockResolvedValue({
      auditLogs: [],
      hasNextPage: false,
      page: 1,
      pageSize: 25,
      totalCount: 0,
    });

    const markup = renderToStaticMarkup(await AuditoriaPage());

    expect(markup).toContain("Nenhum evento de auditoria");
    expect(markup).toContain("Nenhum evento de auditoria encontrado");
  });
});
