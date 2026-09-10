/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAdminInstallmentPayments = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/payments/actions", () => ({
  confirmRefundPasswordAction: vi.fn(),
  getAdminInstallmentPaymentsAction: getAdminInstallmentPayments,
  importAsaasStatementAction: vi.fn(),
  reconcileAsaasPaymentAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
  resolvePaymentReviewAction: vi.fn(),
  retryFailedAsaasWebhookAction: vi.fn(),
}));

import { FinancialOrdersTableClient } from "./financial-orders-table-client";

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
  paymentInstallmentCount: 3,
  paidAmountInCents: 12_990,
  paidAt: new Date("2026-07-30T12:00:00.000Z"),
  paymentMethod: "CREDIT_CARD",
  providerCheckoutId: "chk-1",
  providerInstallmentId: "ins-1",
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
const CONFIRMED_INSTALLMENT_TOTAL_PATTERN = /1 · R\$\s*50,00/;
const PENDING_INSTALLMENT_TOTAL_PATTERN = /2 · R\$\s*100,00/;

describe("FinancialOrderDetailsDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getAdminInstallmentPayments.mockReset();
    getAdminInstallmentPayments.mockResolvedValue([]);
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        disconnect(): void {
          // Intentional no-op for Radix measurements in jsdom.
        }
        observe(): void {
          // Intentional no-op for Radix measurements in jsdom.
        }
        unobserve(): void {
          // Intentional no-op for Radix measurements in jsdom.
        }
      },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "ResizeObserver");
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens the detailed dialog only from the details button", () => {
    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations
              orders={[paidOrder]}
            />
          </tbody>
        </table>
      );
    });

    const row = document.querySelector("tr[data-slot='table-row']");
    expect(document.body.textContent).not.toContain("Integração Asaas");

    act(() => {
      row?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(document.body.textContent).not.toContain("Integração Asaas");
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const detailsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label^="Abrir detalhes do pedido"]'
    );
    expect(detailsButton).not.toBeNull();

    act(() => {
      detailsButton?.click();
    });

    expect(document.body.textContent).toContain("Integração Asaas");
    expect(document.body.textContent).toContain("chk-1");
    expect(document.body.textContent).toContain("pay-1");
    expect(document.body.textContent).toContain("Cartão de crédito");
    expect(document.body.textContent).toContain("Parcelado em 3x");
    expect(document.body.textContent).toContain("Evidência do checkout");
    expect(document.body.textContent).toContain("Solicitar reembolso integral");
    expect(document.body.textContent).toContain("Conciliar pagamento");
    expect(document.querySelector("details")?.open).toBe(false);
    const detailText = document.body.textContent ?? "";
    expect(detailText.indexOf("Valores")).toBeLessThan(
      detailText.indexOf("Ações")
    );
    expect(detailText.indexOf("Ações")).toBeLessThan(
      detailText.indexOf("Detalhes técnicos")
    );
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("keeps support actions scoped while preserving the refund operation", () => {
    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations={false}
              orders={[paidOrder]}
            />
          </tbody>
        </table>
      );
    });

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
    });

    expect(document.body.textContent).toContain("Solicitar reembolso integral");
    expect(document.body.textContent).not.toContain("Conciliar pagamento");
  });

  it("summarizes confirmed and outstanding installment values without calling them cash", async () => {
    getAdminInstallmentPayments.mockResolvedValue([
      {
        anticipated: true,
        clientPaymentDate: "2026-09-01",
        dueDate: "2026-09-01",
        feeAmountInCents: 100,
        installmentNumber: 1,
        netValueInCents: 4900,
        paymentDate: "2026-09-01",
        providerPaymentId: "payment-1",
        status: "RECEIVED",
        valueInCents: 5000,
      },
      {
        anticipated: false,
        clientPaymentDate: null,
        dueDate: "2026-10-01",
        feeAmountInCents: null,
        installmentNumber: 2,
        netValueInCents: null,
        paymentDate: null,
        providerPaymentId: "payment-2",
        status: "PENDING",
        valueInCents: 5000,
      },
      {
        anticipated: false,
        clientPaymentDate: null,
        dueDate: "2026-11-01",
        feeAmountInCents: null,
        installmentNumber: 3,
        netValueInCents: null,
        paymentDate: null,
        providerPaymentId: "payment-3",
        status: "OVERDUE",
        valueInCents: 5000,
      },
    ]);

    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations={false}
              orders={[paidOrder]}
            />
          </tbody>
        </table>
      );
    });

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Confirmadas no Asaas");
    expect(document.body.textContent).toMatch(
      CONFIRMED_INSTALLMENT_TOTAL_PATTERN
    );
    expect(document.body.textContent).toContain("Ainda não confirmadas");
    expect(document.body.textContent).toMatch(
      PENDING_INSTALLMENT_TOTAL_PATTERN
    );
    expect(document.body.textContent).toContain("Líquido R$");
    expect(document.body.textContent).toContain("Taxa R$");
    expect(document.body.textContent).toContain("Antecipada");
    expect(document.body.textContent).not.toContain("Em caixa");
  });

  it("keeps the identity review guard inside the dialog", () => {
    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations
              orders={[{ ...paidOrder, hasPendingBuyerIdentityReview: true }]}
            />
          </tbody>
        </table>
      );
    });

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
    });

    expect(document.body.textContent).toContain(
      "Revisão de identidade pendente"
    );
    expect(document.body.textContent).not.toContain(
      "Solicitar reembolso integral"
    );
    expect(document.body.textContent).not.toContain("Conciliar pagamento");
  });

  it("does not offer a duplicate refund while one is already processing", () => {
    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations
              orders={[
                {
                  ...paidOrder,
                  providerRefundStatus: "PENDING",
                  refundRequestStatus: "processing",
                },
              ]}
            />
          </tbody>
        </table>
      );
    });

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
    });

    expect(document.body.textContent).toContain("Evidência do reembolso");
    expect(document.body.textContent).toContain("Processando");
    expect(document.body.textContent).not.toContain(
      "Solicitar reembolso integral"
    );
  });

  it("preserves an Asaas refund timestamp whose timezone is not declared", () => {
    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations={false}
              orders={[
                {
                  ...paidOrder,
                  providerRefundCreatedAt: "2026-07-29 10:19:06",
                  providerRefundStatus: "DONE",
                  refundRequestStatus: "confirmed",
                },
              ]}
            />
          </tbody>
        </table>
      );
    });

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
    });

    expect(document.body.textContent).toContain("2026-07-29 10:19:06");
  });

  it("offers a retry when the local installment schedule cannot be read", async () => {
    getAdminInstallmentPayments
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValueOnce([
        {
          anticipated: false,
          clientPaymentDate: null,
          dueDate: "2026-09-01",
          feeAmountInCents: null,
          installmentNumber: 1,
          netValueInCents: null,
          paymentDate: null,
          providerPaymentId: "payment-retry",
          status: "PENDING",
          valueInCents: 5000,
        },
      ]);

    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations={false}
              orders={[paidOrder]}
            />
          </tbody>
        </table>
      );
    });

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain(
      "Não foi possível consultar as parcelas sincronizadas."
    );
    const retryButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Tentar novamente");
    expect(retryButton).not.toBeUndefined();

    await act(async () => {
      retryButton?.click();
      await Promise.resolve();
    });

    expect(getAdminInstallmentPayments).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("Cobranças individuais");
  });

  it("omits the Asaas integration section when no provider evidence exists", () => {
    act(() => {
      root.render(
        <table>
          <tbody>
            <FinancialOrdersTableClient
              canManageFinancialOperations={false}
              orders={[
                {
                  ...paidOrder,
                  checkoutAttemptCount: 0,
                  checkoutLastAttemptAt: null,
                  providerCheckoutId: null,
                  providerInstallmentId: null,
                  providerPaymentId: null,
                  providerPaymentStatus: null,
                },
              ]}
            />
          </tbody>
        </table>
      );
    });

    act(() => {
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label^="Abrir detalhes do pedido"]'
        )
        ?.click();
    });

    expect(document.body.textContent).not.toContain("Integração Asaas");
    expect(document.body.textContent).not.toContain("Detalhes técnicos");
  });
});
