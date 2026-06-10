import { describe, expect, it } from "vitest";
import {
  addMonths,
  getEnrollmentAccessState,
  getRenewedAccessWindow,
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
        currentExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
        paidAt: new Date("2026-06-10T00:00:00.000Z"),
      })
    ).toEqual({
      startsAt: new Date("2026-06-10T00:00:00.000Z"),
      expiresAt: new Date("2027-12-01T00:00:00.000Z"),
    });
  });
});
