import { describe, expect, it } from "vitest";
import {
  getAdminFinancialPeriodLabel,
  getAdminFinancialPeriodStart,
  isAdminFinancialPeriod,
} from "./financial-period";

describe("financial period helpers", () => {
  it("accepts only the supported analysis periods", () => {
    expect(isAdminFinancialPeriod("30d")).toBe(true);
    expect(isAdminFinancialPeriod("2026-09")).toBe(false);
  });

  it("calculates period starts from a stable reference date", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");

    expect(getAdminFinancialPeriodStart("30d", now)).toEqual(
      new Date("2026-08-10T12:00:00.000Z")
    );
    expect(getAdminFinancialPeriodStart("all", now)).toBeNull();
    expect(getAdminFinancialPeriodLabel("90d")).toBe("Últimos 90 dias");
  });
});
