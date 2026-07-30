import { describe, expect, it } from "vitest";
import {
  buildCleanupSnapshot,
  createCleanupFingerprint,
  getAdminCandidateProblems,
  getJournalProblems,
  getPublicTableProblems,
  normalizeNeonHost,
  PRODUCTION_CLEANUP_TABLES,
  parseCleanupArguments,
  TRUNCATED_OPERATIONAL_TABLES,
} from "./production-cleanup";

const SHA_256_PATTERN = /^[0-9a-f]{64}$/;
const EXPECTED_JOURNAL = Array.from({ length: 44 }, (_, index) => ({
  createdAt: String(1_700_000_000_000 + index),
  hash: `hash-${index}`,
}));

const ROW_COUNTS = Object.fromEntries(
  PRODUCTION_CLEANUP_TABLES.map((table) => [table, table === "users" ? 2 : 0])
);

const VALID_ADMIN = {
  blocked: false,
  credentialCount: 1,
  id: "admin-private-id",
};

const createSnapshot = () =>
  buildCleanupSnapshot({
    adminCandidates: [VALID_ADMIN],
    branchId: "br-production",
    database: "neondb",
    expectedJournal: EXPECTED_JOURNAL,
    host: "ep-production.us-east-2.aws.neon.tech",
    journal: EXPECTED_JOURNAL,
    publicTables: [...PRODUCTION_CLEANUP_TABLES],
    rowCounts: ROW_COUNTS,
  });

describe("production cleanup contract", () => {
  it("pins the exact 0043 table set and four preserved identity tables", () => {
    expect(PRODUCTION_CLEANUP_TABLES).toHaveLength(38);
    expect(TRUNCATED_OPERATIONAL_TABLES).toHaveLength(34);
    expect(TRUNCATED_OPERATIONAL_TABLES).not.toEqual(
      expect.arrayContaining(["accounts", "profiles", "sessions", "users"])
    );
    expect(PRODUCTION_CLEANUP_TABLES).toEqual(
      [...PRODUCTION_CLEANUP_TABLES].sort()
    );
  });

  it("parses a closed read-only plan invocation", () => {
    expect(
      parseCleanupArguments(["--mode=plan", "--environment=production"])
    ).toEqual({
      environment: "production",
      mode: "plan",
    });
  });

  it("parses execute only with the fingerprint and two confirmations", () => {
    expect(
      parseCleanupArguments([
        "--mode=execute",
        "--environment=production",
        `--fingerprint=${"a".repeat(64)}`,
        "--confirm-cleanup=true",
        "--confirmation=DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN",
      ])
    ).toEqual({
      confirmation: "DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN",
      confirmCleanup: true,
      environment: "production",
      fingerprint: "a".repeat(64),
      mode: "execute",
    });
  });

  it.each([
    [
      [
        "--mode=execute",
        "--environment=production",
        `--fingerprint=${"a".repeat(64)}`,
        "--confirm-cleanup=true",
        "--confirmation=wrong-private-value",
      ],
      "Destructive cleanup confirmation is invalid.",
    ],
    [
      ["--mode=plan", "--environment=staging-private-value"],
      "Cleanup environment must equal production.",
    ],
    [
      ["--mode=plan", "--environment=production", "--unknown=private-value"],
      "Unknown cleanup argument.",
    ],
  ])("rejects unsafe arguments without echoing values", (input, message) => {
    expect(() => parseCleanupArguments(input)).toThrow(message);
    try {
      parseCleanupArguments(input);
    } catch (error) {
      expect(String(error)).not.toContain("private-value");
    }
  });

  it("normalizes only Neon pooler aliases", () => {
    expect(
      normalizeNeonHost(" EP-PRODUCTION-POOLER.us-east-2.aws.neon.tech ")
    ).toBe("ep-production.us-east-2.aws.neon.tech");
    expect(normalizeNeonHost("ep-production.us-east-2.aws.neon.tech")).toBe(
      "ep-production.us-east-2.aws.neon.tech"
    );
  });

  it("rejects missing and unexpected public tables", () => {
    expect(getPublicTableProblems([...PRODUCTION_CLEANUP_TABLES])).toEqual([]);
    expect(
      getPublicTableProblems([
        ...PRODUCTION_CLEANUP_TABLES.filter((table) => table !== "orders"),
        "surprise",
      ])
    ).toEqual(["missing table: orders", "unexpected table: surprise"]);
  });

  it.each([
    [[], "exactly one Admin is required"],
    [
      [VALID_ADMIN, { ...VALID_ADMIN, id: "another-admin" }],
      "exactly one Admin is required",
    ],
    [[{ ...VALID_ADMIN, blocked: true }], "Admin must not be blocked"],
    [
      [{ ...VALID_ADMIN, credentialCount: 0 }],
      "Admin password credential is required",
    ],
  ])("rejects an unusable Admin without exposing its ID", (admins, problem) => {
    const problems = getAdminCandidateProblems(admins);

    expect(problems).toContain(problem);
    expect(problems.join(" ")).not.toContain("admin-private-id");
    expect(problems.join(" ")).not.toContain("another-admin");
  });

  it("requires the exact 44-entry journal through 0043", () => {
    expect(getJournalProblems(EXPECTED_JOURNAL, EXPECTED_JOURNAL)).toEqual([]);
    expect(
      getJournalProblems(EXPECTED_JOURNAL.slice(0, 43), EXPECTED_JOURNAL)
    ).toContain("migration journal must contain exactly 44 expected entries");
    expect(
      getJournalProblems(
        EXPECTED_JOURNAL.map((row, index) =>
          index === 43 ? { ...row, hash: "drift" } : row
        ),
        EXPECTED_JOURNAL
      )
    ).toContain("migration journal does not match 0043");
  });

  it("creates a stable PII-free snapshot and fingerprint", () => {
    const snapshot = createSnapshot();
    const reordered = {
      ...snapshot,
      rowCounts: Object.fromEntries(
        Object.entries(snapshot.rowCounts).reverse()
      ),
    };

    expect(snapshot.adminCount).toBe(1);
    expect(snapshot.adminIdHash).toMatch(SHA_256_PATTERN);
    expect(snapshot.journalCount).toBe(44);
    expect(snapshot.journalTop).toBe("0043");
    expect(JSON.stringify(snapshot)).not.toContain("admin-private-id");
    expect(createCleanupFingerprint(snapshot)).toBe(
      createCleanupFingerprint(reordered)
    );
    expect(createCleanupFingerprint(snapshot)).toMatch(SHA_256_PATTERN);
  });

  it("changes the fingerprint when one row count changes", () => {
    const snapshot = createSnapshot();

    expect(
      createCleanupFingerprint({
        ...snapshot,
        rowCounts: { ...snapshot.rowCounts, orders: 1 },
      })
    ).not.toBe(createCleanupFingerprint(snapshot));
  });
});
