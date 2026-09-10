import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readFunction = (
  source: string,
  name: string,
  nextName: string
): string => {
  const start = source.indexOf(`export const ${name}`);
  const end = source.indexOf(`export const ${nextName}`, start + 1);
  return source.slice(start, end);
};

describe("admin read authorization contract", () => {
  it("keeps dashboard, audit, settings and FAQ projections admin-only", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(
      readFunction(
        source,
        "getAdminInstallmentPayments",
        "getAdminStatementImportHistory"
      )
    ).toContain('requirePermission("viewFinancials")');
    expect(
      readFunction(
        source,
        "getAdminDashboardProjection",
        "getAdminStudentsData"
      )
    ).toContain('requirePermission("manageContent")');
    expect(
      readFunction(
        source,
        "getAdminDashboardProjection",
        "getAdminStudentsData"
      )
    ).toContain('requirePermission("viewFinancials")');
    expect(
      readFunction(source, "getAdminAuditData", "getAdminSettingsData")
    ).toContain('requirePermission("viewGlobalAudit")');
    expect(
      readFunction(source, "getAdminSettingsData", "getAdminCourseCatalogData")
    ).toContain('requirePermission("manageSettings")');
    expect(
      readFunction(source, "getAdminFaqData", "getAdminFinancialOverviewData")
    ).toContain('requirePermission("manageContent")');
    expect(
      source.slice(source.indexOf("export const getAdminBannersData"))
    ).toContain('requirePermission("manageSettings")');
  });
});
