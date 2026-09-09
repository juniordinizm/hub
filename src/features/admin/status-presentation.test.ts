import { describe, expect, it } from "vitest";
import {
  getCheckoutStatusPresentation,
  getCourseAvailabilityStatusPresentation,
  getCourseContentStatusPresentation,
  getEnrollmentStatusPresentation,
  getOrderStatusPresentation,
  getPaymentReviewStatusPresentation,
  getProviderPaymentStatusPresentation,
  getProviderRefundStatusPresentation,
  getProviderRiskStatusPresentation,
  getRefundRequestStatusPresentation,
  getWebhookStatusPresentation,
} from "./status-presentation";

describe("admin status presentation", () => {
  it("keeps enrollment states distinct and localized", () => {
    expect(getEnrollmentStatusPresentation("active")).toEqual({
      label: "Ativa",
      variant: "success",
    });
    expect(getEnrollmentStatusPresentation("expired")).toEqual({
      label: "Expirada",
      variant: "warning",
    });
    expect(getEnrollmentStatusPresentation("revoked")).toEqual({
      label: "Revogada",
      variant: "destructive",
    });
  });

  it("covers operational statuses without exposing internal values", () => {
    expect(getCourseAvailabilityStatusPresentation("coming_soon").label).toBe(
      "Em breve"
    );
    expect(getCourseContentStatusPresentation("active").label).toBe(
      "Publicado"
    );
    expect(getOrderStatusPresentation("disputed").label).toBe("Em disputa");
    expect(getCheckoutStatusPresentation("uncertain").label).toBe(
      "Resultado incerto"
    );
    expect(getWebhookStatusPresentation("retryable").label).toBe(
      "Aguardando nova tentativa"
    );
    expect(getRefundRequestStatusPresentation("confirmed").label).toBe(
      "Confirmado"
    );
    expect(getPaymentReviewStatusPresentation("rejected")).toEqual({
      label: "Rejeitada",
      variant: "destructive",
    });
  });

  it("uses distinct semantic colors for financial states", () => {
    expect(getOrderStatusPresentation("pending").variant).toBe("warning");
    expect(getOrderStatusPresentation("paid").variant).toBe("success");
    expect(getOrderStatusPresentation("refunded").variant).toBe("info");
    expect(getOrderStatusPresentation("disputed").variant).toBe("destructive");
    expect(getOrderStatusPresentation("cancelled").variant).toBe("outline");
    expect(getCheckoutStatusPresentation("active").variant).toBe("success");
    expect(getCheckoutStatusPresentation("pending").variant).toBe("warning");
    expect(getProviderPaymentStatusPresentation("RECEIVED").variant).toBe(
      "success"
    );
    expect(getRefundRequestStatusPresentation("processing").variant).toBe(
      "warning"
    );
  });

  it("uses a neutral fallback for a newly introduced status", () => {
    expect(getOrderStatusPresentation("future_status")).toEqual({
      label: "Status não reconhecido",
      variant: "outline",
    });
  });

  it("maps known Asaas payment, risk, and refund statuses", () => {
    expect(getProviderPaymentStatusPresentation("REFUNDED")).toEqual({
      label: "Reembolsado",
      variant: "info",
    });
    expect(getProviderPaymentStatusPresentation("PARTIALLY_REFUNDED")).toEqual({
      label: "Reembolso parcial",
      variant: "warning",
    });
    expect(
      getProviderRiskStatusPresentation("REPROVED_BY_RISK_ANALYSIS")
    ).toEqual({
      label: "Risco reprovado",
      variant: "destructive",
    });
    expect(getProviderRefundStatusPresentation("DONE")).toEqual({
      label: "Concluído",
      variant: "success",
    });
    expect(getProviderRefundStatusPresentation("CANCELLED")).toEqual({
      label: "Cancelado",
      variant: "outline",
    });
    expect(getProviderRefundStatusPresentation("NEW_PROVIDER_STATUS")).toEqual({
      label: "Status não reconhecido",
      variant: "outline",
    });
  });
});
