import { describe, expect, it } from "vitest";
import {
  getCheckoutStatusPresentation,
  getCourseAvailabilityStatusPresentation,
  getCourseContentStatusPresentation,
  getEnrollmentStatusPresentation,
  getOrderStatusPresentation,
  getPaymentReviewStatusPresentation,
  getRefundRequestStatusPresentation,
  getWebhookStatusPresentation,
} from "./status-presentation";

describe("admin status presentation", () => {
  it("keeps enrollment states distinct and localized", () => {
    expect(getEnrollmentStatusPresentation("active")).toEqual({
      label: "Ativa",
      variant: "default",
    });
    expect(getEnrollmentStatusPresentation("expired")).toEqual({
      label: "Expirada",
      variant: "secondary",
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

  it("uses a neutral fallback for a newly introduced status", () => {
    expect(getOrderStatusPresentation("future_status")).toEqual({
      label: "Status não reconhecido",
      variant: "outline",
    });
  });
});
