import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readServerSource = async (): Promise<string> =>
  (await readFile(new URL("./server.ts", import.meta.url), "utf8")).replaceAll(
    "\r\n",
    "\n"
  );

const PROVIDER_NAME_PATTERN = /asaas/i;

describe("enrollment server SQL contracts", () => {
  it("stores paid access in grants and keeps enrollments as a projection", async () => {
    const source = await readServerSource();

    expect(source).toContain("applyPaidWebhookAccess");
    expect(source).toContain("insert into enrollment_grants");
    expect(source).toContain("rebuildEnrollmentProjection");
    expect(source).toContain("source_type = 'paid_order'");
  });

  it("does not overwrite the original paid expiration when a paid event is replayed", async () => {
    const source = await readServerSource();

    const paidAccessSource = source.slice(
      source.indexOf("export const applyPaidWebhookAccess"),
      source.indexOf("export const createManualAccessGrant")
    );

    expect(paidAccessSource).toContain("base_expires_at");
    expect(paidAccessSource).not.toContain(
      "base_expires_at = excluded.base_expires_at"
    );
  });

  it("creates manual grants through the same enrollment projection", async () => {
    const source = await readServerSource();

    expect(source).toContain("createManualAccessGrant");
    expect(source).toContain(
      "source_type,\n        order_id,\n        manual_reference"
    );
    expect(source).toContain("'manual'");
    expect(source).toContain("manual_access_granted");
    expect(source).toContain("rebuildEnrollmentProjection");
  });

  it("supports manual access blocking without deleting enrollments", async () => {
    const source = await readServerSource();

    expect(source).toContain("blockEnrollmentAccess");
    expect(source).toContain("restoreEnrollmentAccess");
    expect(source).toContain("manual_access_block");
    expect(source).toContain("access_manually_blocked");
    expect(source).toContain("access_manual_block_removed");
    expect(source).not.toContain("delete from enrollments");
  });

  it("does not pin a matricula to a publicacao curricular", async () => {
    const source = await readServerSource();

    const projectionSource = source.slice(
      source.indexOf("export const rebuildEnrollmentProjection"),
      source.indexOf("export const applyPaidWebhookAccess")
    );

    expect(projectionSource).toContain("course_publications");
    expect(projectionSource).not.toContain("course_version_id");
    expect(source).not.toContain("migrateEnrollmentCourseVersion");
  });

  it("uses provider-neutral payment revocation reasons", async () => {
    const source = await readServerSource();

    expect(source).toContain('"payment_dispute"');
    expect(source).toContain('"payment_refund"');
    expect(source).not.toMatch(PROVIDER_NAME_PATTERN);
  });
});
