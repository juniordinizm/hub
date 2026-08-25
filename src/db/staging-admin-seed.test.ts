import { describe, expect, it, vi } from "vitest";
import {
  resolveStagingAdminSeedAccounts,
  seedStagingAdminAccounts,
} from "./staging-admin-seed";

const validEnvironment = {
  STAGING_ADMIN_EMAIL: " Primary.Admin+staging@example.com ",
  STAGING_ADMIN_PASSWORD: "primary-password",
  STAGING_RECOVERY_ADMIN_EMAIL: " recovery.admin@example.com ",
  STAGING_RECOVERY_ADMIN_PASSWORD: "recovery-password",
} as const;

describe("Staging Admin seed contract", () => {
  it("requires two distinct normalized Admin accounts", () => {
    expect(resolveStagingAdminSeedAccounts(validEnvironment)).toEqual([
      {
        email: "primary.admin+staging@example.com",
        label: "primary",
        name: "Admin Staging",
        password: "primary-password",
      },
      {
        email: "recovery.admin@example.com",
        label: "recovery",
        name: "Admin Recuperação Staging",
        password: "recovery-password",
      },
    ]);
  });

  it("rejects a missing recovery account", () => {
    expect(() =>
      resolveStagingAdminSeedAccounts({
        ...validEnvironment,
        STAGING_RECOVERY_ADMIN_EMAIL: undefined,
      })
    ).toThrow("STAGING_RECOVERY_ADMIN_EMAIL is required");
  });

  it("rejects duplicate identities after normalization", () => {
    expect(() =>
      resolveStagingAdminSeedAccounts({
        ...validEnvironment,
        STAGING_RECOVERY_ADMIN_EMAIL: "primary.admin+staging@example.com",
      })
    ).toThrow("Staging Admin accounts must use distinct emails");
  });

  it("rejects passwords shorter than eight characters", () => {
    expect(() =>
      resolveStagingAdminSeedAccounts({
        ...validEnvironment,
        STAGING_RECOVERY_ADMIN_PASSWORD: "1234567",
      })
    ).toThrow(
      "STAGING_RECOVERY_ADMIN_PASSWORD must have at least 8 characters"
    );
  });

  it("rejects a password shared by both privileged accounts", () => {
    expect(() =>
      resolveStagingAdminSeedAccounts({
        ...validEnvironment,
        STAGING_RECOVERY_ADMIN_PASSWORD: "primary-password",
      })
    ).toThrow("Staging Admin accounts must use distinct passwords");
  });

  it("seeds both accounts atomically and revokes their existing sessions", async () => {
    const accounts = resolveStagingAdminSeedAccounts(validEnvironment);
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const query = vi.fn((text: string, values?: unknown[]) => {
      calls.push({ text, ...(values ? { values } : {}) });

      if (text.includes("select id from users")) {
        return Promise.resolve(
          values?.[0] === accounts[0].email
            ? { rowCount: 0, rows: [] }
            : { rowCount: 1, rows: [{ id: "recovery-user" }] }
        );
      }
      if (text.includes("select id from accounts")) {
        return Promise.resolve(
          values?.[0] === "primary-user"
            ? { rowCount: 0, rows: [] }
            : { rowCount: 1, rows: [{ id: "recovery-account" }] }
        );
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const createId = vi
      .fn<() => string>()
      .mockReturnValueOnce("primary-user")
      .mockReturnValueOnce("primary-account");
    const hashPassword = vi.fn(async (password: string) => `hash:${password}`);

    await expect(
      seedStagingAdminAccounts({
        accounts,
        client: { query },
        createId,
        hashPassword,
      })
    ).resolves.toEqual({ created: 1, updated: 1 });

    expect(hashPassword).toHaveBeenCalledTimes(2);
    expect(
      calls
        .filter(({ text }) => text.includes("delete from sessions"))
        .map(({ values }) => values)
    ).toEqual([["primary-user"], ["recovery-user"]]);
    expect(calls.at(0)?.text).toBe("begin");
    expect(calls.at(-1)?.text).toBe("commit");
  });

  it("rolls back the complete two-account seed after any database failure", async () => {
    const accounts = resolveStagingAdminSeedAccounts(validEnvironment);
    const calls: string[] = [];
    const query = vi.fn((text: string) => {
      calls.push(text);
      if (text.includes("select id from users")) {
        return Promise.reject(new Error("database unavailable"));
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });

    await expect(
      seedStagingAdminAccounts({
        accounts,
        client: { query },
        createId: () => "unused",
        hashPassword: async () => "unused",
      })
    ).rejects.toThrow("database unavailable");

    expect(calls).toEqual([
      "begin",
      "select pg_advisory_xact_lock(hashtext('seed:staging-admins'))",
      expect.stringContaining("select id from users"),
      "rollback",
    ]);
  });
});
