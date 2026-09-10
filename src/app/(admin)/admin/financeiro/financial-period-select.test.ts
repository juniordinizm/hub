import { describe, expect, it } from "vitest";
import { getFinancialPeriodNavigationUrl } from "./financial-period-select";

describe("getFinancialPeriodNavigationUrl", () => {
  it("keeps only the analysis period when selecting a short period", () => {
    expect(
      getFinancialPeriodNavigationUrl({
        hash: "#financeiro",
        pathname: "/admin/financeiro",
        period: "30d",
      })
    ).toBe("/admin/financeiro?tab=analysis&period=30d#financeiro");
  });

  it("removes the period parameter when returning to all history", () => {
    expect(
      getFinancialPeriodNavigationUrl({
        hash: "",
        pathname: "/admin/financeiro",
        period: "all",
      })
    ).toBe("/admin/financeiro?tab=analysis");
  });
});
