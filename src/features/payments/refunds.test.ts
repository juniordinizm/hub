import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@better-auth/utils/password", () => ({
  verifyPassword: dependencies.verifyPassword,
}));

import { issueRefundConfirmation } from "./refunds";

describe("refund audit transactions", () => {
  it("creates the confirmation token and audit record in one transaction", async () => {
    const release = vi.fn();
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const accountQuery = vi.fn().mockResolvedValue({
      rows: [{ password: "password-hash" }],
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
      query: accountQuery,
    });
    dependencies.verifyPassword.mockResolvedValue(true);

    await expect(
      issueRefundConfirmation({
        actorUserId: "admin-1",
        orderId: "order-1",
        password: "correct-password",
      })
    ).resolves.toEqual({ confirmationToken: expect.any(String) });

    expect(clientQuery).toHaveBeenNthCalledWith(1, "begin");
    expect(clientQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "refund.password_confirmed", "order-1"]
    );
    expect(clientQuery).toHaveBeenLastCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });
});
