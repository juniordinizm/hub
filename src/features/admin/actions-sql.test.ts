import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin actions and schema", () => {
  it("guards every banner mutation with the settings permission", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );
    const bannerSection = source.slice(
      source.indexOf("const assertBannerLink")
    );

    expect(bannerSection).toContain('requirePermission("manageSettings")');
    expect(bannerSection).not.toContain('requireRole(["admin", "support"])');
  });

  it("returns retry delete failures as action state instead of throwing a server error", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("retryJmvstreamDeleteAction");
    expect(source).toContain("ok: false");
    expect(source).toContain("Nao foi possivel apagar o video na JMVStream.");
  });

  it("stores module and lesson publication lifecycle status in the schema", async () => {
    const schema = await readFile(
      new URL("../../db/schema.ts", import.meta.url),
      "utf8"
    );

    expect(schema).toContain('status: courseStatusEnum("status")');
    expect(schema).toContain("modules");
    expect(schema).toContain("lessons");
  });

  it("serializes module and lesson reorder with content publication", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    const modulesReorder = source.slice(
      source.indexOf("export const reorderModulesAction")
    );
    const lessonsReorder = source.slice(
      source.indexOf("export const reorderLessonsAction")
    );

    expect(modulesReorder).toContain(
      "lockCourseContentRelease(client, courseId)"
    );
    expect(lessonsReorder).toContain(
      "lockCourseContentRelease(client, courseId)"
    );
  });

  it("keeps delayed publication behind the phased rollout gate", async () => {
    const source = await readFile(
      new URL("./authoring.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("CONTENT_RELEASE_DELAYED_PUBLISHING_ENABLED");
  });

  it("keeps global settings and issuer changes atomic and auditable", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );
    const settingsSection = source.slice(
      source.indexOf("export const saveSettingsAction"),
      source.indexOf("const readStagedImageReference")
    );

    expect(settingsSection).toContain('client.query("BEGIN")');
    expect(settingsSection).toContain('client.query("COMMIT")');
    expect(settingsSection).toContain("rollbackTransaction(client)");
    expect(settingsSection).toContain(
      "Boolean(legalName) !== Boolean(cnpjInput)"
    );
    expect(settingsSection).toContain("normalizeCnpj(cnpjInput)");
    expect(settingsSection).toContain(
      "insert into certificate_issuer_profiles"
    );
    expect(settingsSection).toContain("getAuditChanges(before, after)");
    expect(settingsSection).toContain("maskCnpjForAudit");
    expect(settingsSection).toContain('action: "settings.updated"');
  });
});
