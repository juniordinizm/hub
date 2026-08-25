import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebarNav } from "./admin-sidebar-nav";

const renderNav = (role: "admin" | "support"): string =>
  renderToStaticMarkup(
    <SidebarProvider>
      <AdminSidebarNav role={role} />
    </SidebarProvider>
  );

describe("AdminSidebarNav", () => {
  it("shows support only the panel, course operations and financial links", () => {
    const markup = renderNav("support");

    expect(markup).toContain('href="/admin"');
    expect(markup).toContain('href="/admin/operacao/cursos"');
    expect(markup).toContain('href="/admin/financeiro"');
    expect(markup).not.toContain('href="/admin/cursos"');
    expect(markup).not.toContain('href="/admin/alunos"');
    expect(markup).not.toContain('href="/admin/aprendizagem"');
    expect(markup).not.toContain('href="/admin/auditoria"');
    expect(markup).not.toContain('href="/admin/configuracoes"');
  });

  it("preserves every existing admin link", () => {
    const markup = renderNav("admin");

    for (const href of [
      "/admin",
      "/admin/aprendizagem",
      "/admin/cursos",
      "/admin/alunos",
      "/admin/financeiro",
      "/admin/auditoria",
      "/admin/configuracoes",
    ]) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup).not.toContain('href="/admin/operacao/cursos"');
  });
});
