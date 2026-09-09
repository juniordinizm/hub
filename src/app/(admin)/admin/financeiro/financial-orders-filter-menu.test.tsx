import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FinancialOrdersFilterMenu,
  getOrdersFilterHref,
} from "./financial-orders-filter-menu";

describe("FinancialOrdersFilterMenu", () => {
  it("shows active filters as removable pills without duplicating controls", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        paymentMethod="CREDIT_CARD"
        search="Student"
        status="paid"
      />
    );

    expect(markup).toContain("Filtros");
    expect(markup).toContain("Status: Pago");
    expect(markup).toContain("Pagamento: Cartão de crédito");
    expect(markup).toContain("Remover filtro Status: Pago");
    expect(markup).toContain("Remover filtro Pagamento: Cartão de crédito");
    expect(markup).toContain("tab=orders");
    expect(markup).toContain("status=paid");
    expect(markup).toContain("paymentMethod=CREDIT_CARD");
  });

  it("represents search as active state and clears it from filter URLs", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        paymentMethod="CREDIT_CARD"
        search="Student"
        status="paid"
      />
    );
    const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) =>
      (match[1] ?? "").replaceAll("&amp;", "&")
    );

    expect(markup).toContain("Busca: Student");
    expect(markup).toContain("Remover filtro Busca: Student");
    expect(hrefs).toContain(
      "/admin/financeiro?tab=orders&status=paid&paymentMethod=CREDIT_CARD"
    );
    expect(hrefs).toContain(
      "/admin/financeiro?tab=orders&q=Student&status=paid"
    );
    expect(hrefs).toContain(
      "/admin/financeiro?tab=orders&q=Student&paymentMethod=CREDIT_CARD"
    );
    expect(
      getOrdersFilterHref({
        paymentMethod: undefined,
        search: "",
        status: undefined,
      })
    ).toBe("/admin/financeiro?tab=orders");
  });

  it("keeps the filter trigger quiet when no filter is active", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu search="" />
    );

    expect(markup).toContain("Filtros");
    expect(markup).not.toContain("Status:");
    expect(markup).not.toContain("Pagamento:");
  });

  it("keeps checkout state visible and encoded with the other filters", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrdersFilterMenu
        checkout="open"
        paymentMethod="PIX"
        search=""
        status="pending"
      />
    );

    expect(markup).toContain("Checkout: Em aberto");
    expect(markup).toContain("checkout=open");
    expect(markup).toContain("status=pending");
    expect(markup).toContain("paymentMethod=PIX");
    expect(markup).toContain("Remover filtro Checkout: Em aberto");
  });
});
