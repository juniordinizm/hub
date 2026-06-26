import { describe, expect, it } from "vitest";
import {
  addMonths,
  getEnrollmentAccessState,
  getEnrollmentExpiryWarningKind,
  getExtendedEnrollmentExpiration,
  getRenewedAccessWindow,
  shouldExpireEnrollment,
  validateEnrollmentAdjustmentReason,
} from "./rules";

describe("enrollment access rules", () => {
  it("grants twelve months of access from purchase date", () => {
    expect(addMonths(new Date("2026-06-10T12:00:00.000Z"), 12)).toEqual(
      new Date("2027-06-10T12:00:00.000Z")
    );
  });

  it("blocks lessons after expiration while preserving account history", () => {
    expect(
      getEnrollmentAccessState({
        status: "active",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
        now: new Date("2026-06-10T00:00:00.000Z"),
      })
    ).toEqual({
      canAccessLessons: false,
      reason: "expired",
    });
  });

  it("renews from the current expiration when access is still active", () => {
    expect(
      getRenewedAccessWindow({
        accessDurationMonths: 6,
        currentExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
        paidAt: new Date("2026-06-10T00:00:00.000Z"),
      })
    ).toEqual({
      startsAt: new Date("2026-06-10T00:00:00.000Z"),
      expiresAt: new Date("2027-06-01T00:00:00.000Z"),
    });
  });

  it("detects expired active enrollments for daily maintenance", () => {
    expect(
      shouldExpireEnrollment({
        expiresAt: new Date("2026-06-16T23:59:59.000Z"),
        now: new Date("2026-06-17T00:00:00.000Z"),
        status: "active",
      })
    ).toBe(true);

    expect(
      shouldExpireEnrollment({
        expiresAt: new Date("2026-06-16T23:59:59.000Z"),
        now: new Date("2026-06-17T00:00:00.000Z"),
        status: "revoked",
      })
    ).toBe(false);
  });

  it("selects seven-day and one-day expiry warnings without duplicates", () => {
    const now = new Date("2026-06-17T12:00:00.000Z");

    expect(
      getEnrollmentExpiryWarningKind({
        expiresAt: new Date("2026-06-24T12:00:00.000Z"),
        now,
        warning1dSentAt: null,
        warning7dSentAt: null,
      })
    ).toBe("7d");

    expect(
      getEnrollmentExpiryWarningKind({
        expiresAt: new Date("2026-06-18T12:00:00.000Z"),
        now,
        warning1dSentAt: null,
        warning7dSentAt: null,
      })
    ).toBe("1d");

    expect(
      getEnrollmentExpiryWarningKind({
        expiresAt: new Date("2026-06-18T12:00:00.000Z"),
        now,
        warning1dSentAt: new Date("2026-06-17T12:00:00.000Z"),
        warning7dSentAt: null,
      })
    ).toBeNull();
  });

  it("extends active access from the current effective expiration", () => {
    expect(
      getExtendedEnrollmentExpiration({
        currentEffectiveExpiresAt: new Date("2026-07-10T10:00:00.000Z"),
        days: 1,
        months: 0,
        now: new Date("2026-06-26T10:00:00.000Z"),
      })
    ).toEqual(new Date("2026-07-11T10:00:00.000Z"));

    expect(
      getExtendedEnrollmentExpiration({
        currentEffectiveExpiresAt: new Date("2026-07-10T10:00:00.000Z"),
        days: 0,
        months: 1,
        now: new Date("2026-06-26T10:00:00.000Z"),
      })
    ).toEqual(new Date("2026-08-10T10:00:00.000Z"));
  });

  it("extends expired access from now instead of from the stale expiration", () => {
    expect(
      getExtendedEnrollmentExpiration({
        currentEffectiveExpiresAt: new Date("2026-06-25T10:00:00.000Z"),
        days: 1,
        months: 0,
        now: new Date("2026-06-26T15:30:00.000Z"),
      })
    ).toEqual(new Date("2026-06-27T15:30:00.000Z"));
  });

  it("requires an explicit admin reason for expiration adjustments", () => {
    expect(validateEnrollmentAdjustmentReason("Problema de suporte")).toBe(
      "Problema de suporte"
    );
    expect(() => validateEnrollmentAdjustmentReason(" ")).toThrow(
      "Informe o motivo do ajuste de expiracao."
    );
  });
});
