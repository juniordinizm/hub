import { describe, expect, it } from "vitest";
import {
  getErrorMessage,
  getPaymentReviewReasonPresentation,
} from "./financial-operations-shared";

describe("shared financial copy", () => {
  it("translates known review reasons and retains their technical evidence", () => {
    const reason = "buyer_identity_team_account";
    const presentation = getPaymentReviewReasonPresentation(
      reason,
      "buyer_identity"
    );

    expect(presentation.description).toContain("equipe do Hub");
    expect(presentation.instruction).toContain("reembolso integral");
    expect(presentation.technicalReason).toBe(reason);
  });

  it("uses a safe fallback for an unknown reason without hiding its evidence", () => {
    const reason = "future_financial_reason";
    const presentation = getPaymentReviewReasonPresentation(
      reason,
      "event_anomaly"
    );

    expect(presentation.description).toBe(
      "Há uma evidência financeira que requer conferência."
    );
    expect(presentation.technicalReason).toBe(reason);
    expect(presentation.description).not.toContain(reason);
  });

  it("localizes known operation failures and does not ask for an undisplayed code", () => {
    expect(
      getErrorMessage(new Error("O Pedido mudou durante a conciliacao."))
    ).toContain("Atualize a tela");

    const message = getErrorMessage(new Error("internal_database_error"));
    expect(message).toContain("consultar os registros operacionais");
    expect(message).not.toContain("código");
  });
});
