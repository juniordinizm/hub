import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportDashboard } from "./support-dashboard";

describe("SupportDashboard", () => {
  it("renders only operational course and financial aggregates", () => {
    const markup = renderToStaticMarkup(
      <SupportDashboard
        courses={[
          {
            activeEnrollmentCount: 8,
            id: "course-1",
            paidOrderCount: 7,
            paidRevenueInCents: 70_000,
            refundedOrderCount: 2,
            refundedRevenueInCents: 20_000,
            status: "active",
            title: "Curso operacional",
            totalEnrollmentCount: 10,
          },
        ]}
      />
    );

    expect(markup).toContain("Operação de suporte");
    expect(markup).toContain("Curso operacional");
    expect(markup).toContain("10");
    expect(markup).toContain("R$ 700,00");
    expect(markup).toContain('href="/admin/operacao/cursos/course-1/alunas"');
    expect(markup).toContain('href="/admin/financeiro"');
    expect(markup).not.toContain("Editar");
    expect(markup).not.toContain("Configurações");
    expect(markup).not.toContain("Aprendizagem");
  });
});
