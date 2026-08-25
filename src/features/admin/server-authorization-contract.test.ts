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
  it("keeps broad dashboard, audit, settings and FAQ projections admin-only", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(
      readFunction(source, "getAdminDashboardData", "getAdminStudentsData")
    ).toContain('requirePermission("manageContent")');
    expect(
      readFunction(source, "getAdminAuditData", "getAdminSettingsData")
    ).toContain('requirePermission("viewGlobalAudit")');
    expect(
      readFunction(source, "getAdminSettingsData", "getAdminCourseCatalogData")
    ).toContain('requirePermission("manageSettings")');
    expect(
      readFunction(source, "getAdminFaqData", "getAdminFinancialData")
    ).toContain('requirePermission("manageContent")');
    expect(
      source.slice(source.indexOf("export const getAdminBannersData"))
    ).toContain('requirePermission("manageSettings")');
  });
});
