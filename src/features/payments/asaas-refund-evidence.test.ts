import { describe, expect, it } from "vitest";
import { findExactAsaasRefundEvidence } from "./asaas-refund-evidence";

const refund = (valueInCents: number, status = "DONE") => ({
  dateCreated: "2026-08-02 01:45:03",
  status,
  valueInCents,
});

describe("Asaas refund evidence", () => {
  it("preserves a single exact refund", () => {
    const evidence = {
      ...refund(9900),
      transactionReceiptUrl: "https://asaas.example/refund",
    };

    expect(findExactAsaasRefundEvidence([evidence], 9900)).toEqual(evidence);
  });

  it("aggregates exact per-charge refunds", () => {
    expect(
      findExactAsaasRefundEvidence(
        [refund(3300), refund(3300), refund(3300)],
        9900
      )
    ).toEqual(refund(9900));
  });

  it("rejects partial or cancelled aggregate evidence", () => {
    expect(
      findExactAsaasRefundEvidence([refund(3300), refund(3300)], 9900)
    ).toBeNull();
    expect(
      findExactAsaasRefundEvidence(
        [refund(3300), refund(3300), refund(3300, "CANCELLED")],
        9900
      )
    ).toBeNull();
    expect(
      findExactAsaasRefundEvidence([refund(9900), refund(100)], 9900)
    ).toBeNull();
  });
});
