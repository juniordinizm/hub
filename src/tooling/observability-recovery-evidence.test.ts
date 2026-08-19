import { describe, expect, it } from "vitest";

import { createRecoveryEvidence } from "./observability-recovery-evidence";

describe("observability recovery evidence", () => {
  it("serializes bounded drill evidence without operational secrets", () => {
    expect(
      createRecoveryEvidence({
        checks: [
          { name: "readiness", status: "passed" },
          { name: "migration-journal", status: "passed" },
        ],
        environment: "staging",
        finishedAt: "2026-08-19T12:05:00.000Z",
        migrationJournal: "0062_certificate_reconciliation_indexes",
        owner: "operations",
        startedAt: "2026-08-19T12:00:00.000Z",
      })
    ).toEqual({
      checks: [
        { name: "readiness", status: "passed" },
        { name: "migration-journal", status: "passed" },
      ],
      environment: "staging",
      finishedAt: "2026-08-19T12:05:00.000Z",
      migrationJournal: "0062_certificate_reconciliation_indexes",
      owner: "operations",
      schemaVersion: 1,
      startedAt: "2026-08-19T12:00:00.000Z",
    });
  });

  it("rejects unsafe identifiers and an inverted time window", () => {
    expect(() =>
      createRecoveryEvidence({
        checks: [],
        environment: "staging",
        finishedAt: "2026-08-19T12:00:00.000Z",
        migrationJournal: "0062",
        owner: "ops@example.com",
        startedAt: "2026-08-19T12:05:00.000Z",
      })
    ).toThrow("owner");
  });
});
