import { describe, expect, it, vi } from "vitest";
import {
  resolveExpiryWarningSupersedeTarget,
  runExpiryWarningV1Supersede,
} from "./supersede-expiry-warning-v1";

describe("resolveExpiryWarningSupersedeTarget", () => {
  const environment = {
    DATABASE_URL_DIRECT:
      "postgresql://operator:secret@production.example.test/neondb?sslmode=verify-full",
    PRODUCTION_DATABASE_HOST: "production.example.test",
    STAGING_DATABASE_HOST: "staging.example.test",
  };

  it("accepts exactly one mode and the declared environment host", () => {
    expect(
      resolveExpiryWarningSupersedeTarget({
        argv: ["--environment=production", "--dry-run"],
        environment,
      })
    ).toMatchObject({ environment: "production", mode: "dry-run" });
  });

  it.each([
    [["--environment=staging", "--dry-run"], {}],
    [["--environment=production", "--execute"], {}],
    [["--environment=production", "--dry-run", "--execute"], {}],
    [
      ["--environment=production", "--dry-run"],
      {
        DATABASE_URL_DIRECT:
          "postgresql://operator:secret@other.example.test/neondb?sslmode=verify-full",
      },
    ],
  ])("rejects unsafe arguments or target", (argv, overrides) => {
    expect(() =>
      resolveExpiryWarningSupersedeTarget({
        argv,
        environment: { ...environment, ...overrides },
      })
    ).toThrow();
  });

  it("requires the literal confirmation for execute", () => {
    expect(() =>
      resolveExpiryWarningSupersedeTarget({
        argv: ["--environment=production", "--execute"],
        environment: {
          ...environment,
          EXPIRY_WARNING_V1_CONFIRMATION: "wrong",
        },
      })
    ).toThrow("EXPIRY_WARNING_V1_CONFIRMATION");
  });
});

describe("runExpiryWarningV1Supersede", () => {
  it("dry-runs in a read-only transaction without changing messages", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("as migration_ready")) {
        return { rows: [{ migration_ready: true }] };
      }
      if (sql.includes("count(*) filter")) {
        return {
          rows: [
            {
              eligible_count: 3,
              processing_count: 0,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      runExpiryWarningV1Supersede({
        client: { query } as never,
        mode: "dry-run",
      })
    ).resolves.toEqual({ eligible: 3, markersCleared: 0, superseded: 0 });
    expect(query).toHaveBeenCalledWith(
      "begin isolation level repeatable read read only"
    );
    expect(query).toHaveBeenCalledWith("rollback");
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("set status = 'superseded'")
      )
    ).toBe(false);
  });

  it("aborts when a v1 warning is processing", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("as migration_ready")) {
        return { rows: [{ migration_ready: true }] };
      }
      if (sql.includes("count(*) filter")) {
        return {
          rows: [{ eligible_count: 2, processing_count: 1 }],
        };
      }
      return { rows: [] };
    });
    await expect(
      runExpiryWarningV1Supersede({
        client: { query } as never,
        mode: "execute",
      })
    ).rejects.toThrow("processing");
    expect(query).toHaveBeenCalledWith("rollback");
  });

  it("supersedes only pending/retrying v1 and clears active generation markers", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("as migration_ready")) {
        return { rows: [{ migration_ready: true }] };
      }
      if (sql.includes("count(*) filter")) {
        return {
          rows: [{ eligible_count: 3, processing_count: 0 }],
        };
      }
      if (sql.includes("with candidates as")) {
        return {
          rows: [{ markers_cleared: 2, superseded_count: 3 }],
        };
      }
      return { rows: [] };
    });

    await expect(
      runExpiryWarningV1Supersede({
        client: { query } as never,
        mode: "execute",
      })
    ).resolves.toEqual({ eligible: 3, markersCleared: 2, superseded: 3 });
    const statement = String(
      query.mock.calls.find(([sql]) => sql.includes("with candidates as"))?.[0]
    );
    expect(statement).toContain("payload_version = 1");
    expect(statement).toContain("status in ('pending', 'retrying')");
    expect(statement).toContain("set status = 'superseded'");
    expect(statement).toContain("last_error_code = 'expiry_payload_v1'");
    expect(statement).toContain("enrollment.status = 'active'");
    expect(query).toHaveBeenCalledWith("commit");
  });
});
