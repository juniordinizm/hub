import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { approvePrivacyRequest, registerPrivacyRequest } from "./server";

describe("privacy request audit transactions", () => {
  it("commits request creation and its audit record together", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "request-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      registerPrivacyRequest({
        actorUserId: "admin-1",
        reason: "Solicitação da titular",
        userId: "user-1",
      })
    ).resolves.toEqual({ id: "request-1" });

    expect(query).toHaveBeenNthCalledWith(1, "begin");
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "privacy.requested", "request-1"]
    );
    expect(query).toHaveBeenNthCalledWith(4, "commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back the approval when its audit record cannot be written", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "request-1" }] })
      .mockRejectedValueOnce(new Error("audit unavailable"))
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      approvePrivacyRequest({ actorUserId: "admin-1", requestId: "request-1" })
    ).rejects.toThrow("audit unavailable");

    expect(query).toHaveBeenLastCalledWith("rollback");
    expect(release).toHaveBeenCalledOnce();
  });
});
