import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readServerSource = async (): Promise<string> =>
  (await readFile(new URL("./server.ts", import.meta.url), "utf8")).replaceAll(
    "\r\n",
    "\n"
  );

const PROVIDER_NAME_PATTERN = /asaas/i;

describe("enrollment server SQL contracts", () => {
  it("takes the shared Course release lock before every enrollment aggregate lock", async () => {
    const source = await readServerSource();
    const aggregateLockSource = source.slice(
      source.indexOf("const lockEnrollmentAggregate = async"),
      source.indexOf("const hasEnrollmentGrantForOrder")
    );

    expect(source).toContain("@/features/courses/content-release-lock");
    expect(aggregateLockSource).toContain(
      "await lockCourseContentRelease(client, courseId)"
    );
    expect(
      aggregateLockSource.indexOf("lockCourseContentRelease")
    ).toBeLessThan(aggregateLockSource.indexOf("pg_advisory_xact_lock"));
  });

  it("locks the enrollment aggregate before every direct grant mutation", async () => {
    const source = await readServerSource();
    const paidSource = source.slice(
      source.indexOf("export const applyPaidWebhookAccess"),
      source.indexOf("export const createManualAccessGrant")
    );
    const manualSource = source.slice(
      source.indexOf("export const createManualAccessGrant"),
      source.indexOf("export const applyPaymentRevocation")
    );
    const revocationSource = source.slice(
      source.indexOf("export const applyPaymentRevocation"),
      source.indexOf("const getActivePaidGrantForEnrollment")
    );

    expect(source).toContain("const lockEnrollmentAggregate = async");
    expect(source).toContain(
      "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))"
    );
    expect(paidSource.indexOf("lockEnrollmentAggregate")).toBeLessThan(
      paidSource.indexOf("getCurrentRenewalBase")
    );
    expect(manualSource.indexOf("lockEnrollmentAggregate")).toBeLessThan(
      manualSource.indexOf("insert into enrollment_grants")
    );
    expect(revocationSource.indexOf("lockEnrollmentAggregate")).toBeLessThan(
      revocationSource.indexOf("update enrollment_grants")
    );
  });

  it("locks enrollment-id aggregates in advisory-before-row-before-grant order", async () => {
    const source = await readServerSource();
    const lockByIdSource = source.slice(
      source.indexOf("const lockEnrollmentForGrantMutation"),
      source.indexOf("const getPaidAccessGrantsForEnrollment")
    );

    expect(lockByIdSource).toContain("getEnrollmentCourseAccess");
    expect(lockByIdSource.indexOf("getEnrollmentCourseAccess")).toBeLessThan(
      lockByIdSource.indexOf("lockEnrollmentAggregate")
    );
    expect(lockByIdSource.indexOf("lockEnrollmentAggregate")).toBeLessThan(
      lockByIdSource.indexOf("forUpdate: true")
    );

    const mutationNames = [
      "extendEnrollmentExpiration",
      "setEnrollmentExpiration",
      "blockEnrollmentAccess",
      "restoreEnrollmentAccess",
    ];
    for (const [index, mutationName] of mutationNames.entries()) {
      const nextMutationName = mutationNames[index + 1];
      const mutationSource = source.slice(
        source.indexOf(`export const ${mutationName}`),
        nextMutationName
          ? source.indexOf(`export const ${nextMutationName}`)
          : source.length
      );
      const firstGrantAccess = [
        mutationSource.indexOf("getActivePaidGrantForEnrollment"),
        mutationSource.indexOf("getPaidAccessGrantsForEnrollment"),
      ].filter((position) => position >= 0);

      expect(mutationSource).toContain("lockEnrollmentForGrantMutation");
      expect(
        mutationSource.indexOf("lockEnrollmentForGrantMutation")
      ).toBeLessThan(Math.min(...firstGrantAccess));
    }
  });

  it("serializes enrollment projection before reading its current state", async () => {
    const source = await readServerSource();
    const projectionSource = source.slice(
      source.indexOf("export const rebuildEnrollmentProjection"),
      source.indexOf("export const applyPaidWebhookAccess")
    );
    const advisoryLock = "lockEnrollmentAggregate(client, userId, courseId)";
    const existingEnrollmentRead = "from enrollments\n      where user_id = $1";
    const publicationRead = "from course_publications";
    const lockedEnrollmentRead = projectionSource.slice(
      projectionSource.indexOf("const existingEnrollment"),
      projectionSource.indexOf("const previousEnrollment")
    );

    expect(projectionSource).toContain(advisoryLock);
    expect(projectionSource).toContain(existingEnrollmentRead);
    expect(projectionSource).toContain("for update");
    expect(projectionSource.indexOf(advisoryLock)).toBeLessThan(
      projectionSource.indexOf(existingEnrollmentRead)
    );
    expect(projectionSource.indexOf(existingEnrollmentRead)).toBeLessThan(
      projectionSource.indexOf(publicationRead)
    );
    expect(projectionSource).toContain("content_release_mode");
    expect(projectionSource).toContain("content_release_started_at");
    expect(lockedEnrollmentRead).toContain("revoked_reason");
  });

  it("derives and persists scheduled delivery from the published modules", async () => {
    const source = await readServerSource();
    const projectionSource = source.slice(
      source.indexOf("export const rebuildEnrollmentProjection"),
      source.indexOf("export const applyPaidWebhookAccess")
    );

    expect(projectionSource).toContain("has_delayed_modules");
    expect(projectionSource).toContain("m.release_delay_days > 0");
    expect(projectionSource).toContain("m.status = 'active'");
    expect(projectionSource).toContain("getEnrollmentContentReleaseTransition");
    expect(projectionSource).toContain("content_release_scheduled");
    expect(projectionSource).toContain("metadata: {");
    expect(projectionSource).toContain(
      "startedAt: contentReleaseTransition.startedAt.toISOString()"
    );
  });

  it("preserves content release for administrative expiration and restoration operations", async () => {
    const source = await readServerSource();
    const extendSource = source.slice(
      source.indexOf("export const extendEnrollmentExpiration"),
      source.indexOf("export const setEnrollmentExpiration")
    );
    const setSource = source.slice(
      source.indexOf("export const setEnrollmentExpiration"),
      source.indexOf("export const blockEnrollmentAccess")
    );
    const restoreSource = source.slice(
      source.indexOf("export const restoreEnrollmentAccess")
    );
    const paidAndManualGrantSource = source.slice(
      source.indexOf("export const applyPaidWebhookAccess"),
      source.indexOf("export const applyPaymentRevocation")
    );

    expect(extendSource).toContain("preserveContentRelease: true");
    expect(setSource).toContain("preserveContentRelease: true");
    expect(restoreSource).toContain("preserveContentRelease: true");
    expect(paidAndManualGrantSource).not.toContain(
      "preserveContentRelease: true"
    );
  });

  it("leaves the content release state untouched in terminal projections", async () => {
    const source = await readServerSource();
    const projectionSource = source.slice(
      source.indexOf("export const rebuildEnrollmentProjection"),
      source.indexOf("export const applyPaidWebhookAccess")
    );
    const terminalProjectionSource = projectionSource.slice(
      projectionSource.indexOf("const latestGrant")
    );

    expect(terminalProjectionSource).not.toContain(
      "content_release_mode = excluded.content_release_mode"
    );
    expect(terminalProjectionSource).not.toContain(
      "content_release_started_at = excluded.content_release_started_at"
    );
  });

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
