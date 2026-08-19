import { describe, expect, it } from "vitest";

import { createDrillEvidence } from "../../scripts/observability-recovery-drill";

describe("observability recovery drill", () => {
  it("creates evidence from explicit operator checks", () => {
    expect(
      createDrillEvidence({
        checks: {
          alerts: "passed",
          migration: "passed",
          readiness: "passed",
        },
        environment: "staging",
        migrationJournal: "0062_certificate_reconciliation_indexes",
        now: "2026-08-19T13:00:00.000Z",
        owner: "operations",
      })
    ).toMatchObject({
      environment: "staging",
      migrationJournal: "0062_certificate_reconciliation_indexes",
      owner: "operations",
      startedAt: "2026-08-19T13:00:00.000Z",
    });
  });
});
