import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/payments/actions", () => ({
  confirmRefundPasswordAction: vi.fn(),
  reconcileAsaasPaymentAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
}));

import { FinancialOrdersTable } from "./financial-orders-table";

const paidOrder = {
  amountInCents: 12_990,
  checkoutAttemptCount: 1,
  checkoutErrorMessage: null,
  checkoutLastAttemptAt: new Date("2026-07-30T11:55:00.000Z"),
  checkoutNextAttemptAt: null,
  checkoutStatus: "active",
  courseId: "course-1",
  courseTitle: "Curso de organização",
  createdAt: new Date("2026-07-30T12:00:00.000Z"),
  customerEmail: "student@example.com",
  customerName: "Student",
  feeAmountInCents: 390,
  id: "order-1",
  netAmountInCents: 12_600,
  paymentInstallmentCount: null,
  paidAmountInCents: 12_990,
  paidAt: new Date("2026-07-30T12:00:00.000Z"),
  paymentMethod: "PIX",
  providerCheckoutId: "chk-1",
  providerInstallmentId: null,
  providerPaymentId: "pay-1",
  providerPaymentStatus: "RECEIVED",
  providerRefundCreatedAt: null,
  providerRefundEndToEndId: null,
  providerRefundReceiptUrl: null,
  providerRefundStatus: null,
  providerRiskStatus: null,
  refundConfirmedAt: null,
  refundErrorCode: null,
  refundRequestCreatedAt: null,
  refundRequestStatus: null,
  refundedAmountInCents: null,
  status: "paid",
} as const;

const renderOrdersTable = (
  overrides: Partial<Parameters<typeof FinancialOrdersTable>[0]> = {}
) =>
  renderToStaticMarkup(
    <FinancialOrdersTable
      canManageFinancialOperations={false}
      hasNextPage={false}
      orders={[paidOrder]}
      page={1}
      pageSize={20}
      search=""
      totalCount={1}
      {...overrides}
    />
  );

describe("FinancialOrdersTable", () => {
  it("renders the server-paginated order table with the key decision context", () => {
    const markup = renderOrdersTable({
      canManageFinancialOperations: true,
      hasNextPage: true,
      totalCount: 21,
    });

    expect(markup).toContain("Pedidos e pagamentos registrados");
    expect(markup).toContain("Compradora");
    expect(markup).toContain("Curso");
    expect(markup).toContain("Status");
    expect(markup).toContain("Valor");
    expect(markup).toContain("Registrado em");
    expect(markup).toContain("Detalhes");
    expect(markup).toContain("1–1 de 21 pedidos");
    expect(markup).toContain("Student");
    expect(markup).toContain("Curso de organização");
    expect(markup).toContain("R$");
    expect(markup).not.toContain("Ver IDs técnicos");
    expect(markup).not.toContain("Solicitar estorno integral");
    expect(markup).not.toContain("Conciliar pagamento");
    expect(markup).toContain("Próxima");
    expect(markup.match(/overflow-x-auto/g)).toHaveLength(1);
  });

  it("keeps the order table free of financial actions", () => {
    const markup = renderOrdersTable();

    expect(markup).toContain("Detalhes");
    expect(markup).not.toContain("Solicitar estorno integral");
    expect(markup).not.toContain("Conciliar pagamento");
  });

  it("renders a useful empty state for a filtered page", () => {
    const markup = renderOrdersTable({
      orders: [],
      search: "sem resultado",
      totalCount: 0,
    });

    expect(markup).toContain("Nenhum pedido corresponde aos filtros");
    expect(markup).toContain(
      "Ajuste ou limpe os filtros para consultar outro conjunto de pedidos."
    );
    expect(markup).toContain("Nenhum pedido");
  });

  it("does not label a refunded or disputed row as currently paid", () => {
    const refundedMarkup = renderOrdersTable({
      orders: [{ ...paidOrder, status: "refunded" }],
    });
    const disputedMarkup = renderOrdersTable({
      orders: [{ ...paidOrder, status: "disputed" }],
    });

    expect(refundedMarkup).toContain("Recebido");
    expect(disputedMarkup).toContain("Recebido");
    expect(refundedMarkup).not.toContain(">Pago</p>");
    expect(disputedMarkup).not.toContain(">Pago</p>");
  });

  it("does not confuse an out-of-range page with an empty history", () => {
    const markup = renderOrdersTable({
      hasNextPage: false,
      orders: [],
      page: 3,
      totalCount: 41,
    });

    expect(markup).toContain("Nenhum pedido nesta página");
    expect(markup).toContain("Volte uma página");
    expect(markup).not.toContain("Ainda não há pedidos registrados");
  });
});
