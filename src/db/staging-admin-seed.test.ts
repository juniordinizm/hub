import { describe, expect, it, vi } from "vitest";
import {
  resolveStagingAdminSeedAccount,
  seedStagingAdminAccount,
} from "./staging-admin-seed";

const validEnvironment = {
  STAGING_ADMIN_EMAIL: " Primary.Admin+staging@example.com ",
  STAGING_ADMIN_PASSWORD: "primary-password",
} as const;

describe("Staging Admin seed contract", () => {
  it("requires one normalized Admin account", () => {
    expect(resolveStagingAdminSeedAccount(validEnvironment)).toEqual({
      email: "primary.admin+staging@example.com",
      name: "Admin Staging",
      password: "primary-password",
    });
  });

  it("rejects a missing Admin account", () => {
    expect(() =>
      resolveStagingAdminSeedAccount({
        STAGING_ADMIN_EMAIL: undefined,
        STAGING_ADMIN_PASSWORD: "primary-password",
      })
    ).toThrow("STAGING_ADMIN_EMAIL is required");
  });

  it("rejects passwords shorter than eight characters", () => {
    expect(() =>
      resolveStagingAdminSeedAccount({
        STAGING_ADMIN_EMAIL: "admin@example.com",
        STAGING_ADMIN_PASSWORD: "1234567",
      })
    ).toThrow("STAGING_ADMIN_PASSWORD must have at least 8 characters");
  });

  it("seeds the account atomically and revokes its existing sessions", async () => {
    const account = resolveStagingAdminSeedAccount(validEnvironment);
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const query = vi.fn((text: string, values?: unknown[]) => {
      calls.push({ text, ...(values ? { values } : {}) });

      if (text.includes("select id from users")) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      if (text.includes("select id from accounts")) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const createId = vi
      .fn<() => string>()
      .mockReturnValueOnce("primary-user")
      .mockReturnValueOnce("primary-account");
    const hashPassword = vi.fn(async (password: string) => `hash:${password}`);

    await expect(
      seedStagingAdminAccount({
        account,
        client: { query },
        createId,
        hashPassword,
      })
    ).resolves.toEqual({ created: 1, updated: 0 });

    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(
      calls
        .filter(({ text }) => text.includes("delete from sessions"))
        .map(({ values }) => values)
    ).toEqual([["primary-user"]]);
    expect(calls.at(0)?.text).toBe("begin");
    expect(calls.at(-1)?.text).toBe("commit");
  });

  it("rolls back the complete seed after any database failure", async () => {
    const account = resolveStagingAdminSeedAccount(validEnvironment);
    const calls: string[] = [];
    const query = vi.fn((text: string) => {
      calls.push(text);
      if (text.includes("select id from users")) {
        return Promise.reject(new Error("database unavailable"));
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });

    await expect(
      seedStagingAdminAccount({
        account,
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
