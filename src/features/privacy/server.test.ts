import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  env: {
    DATA_RETENTION_ENABLED: false,
    LEGAL_APPROVAL_REFERENCE: undefined as string | undefined,
  },
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => dependencies.env }));

import {
  approvePrivacyRequest,
  executePrivacyAnonymization,
  registerPrivacyRequest,
} from "./server";

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
      ["admin-1", "privacy.requested", "request-1", "{}"]
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

  it("uses compare-and-set and prevents a requester from approving the same request", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      approvePrivacyRequest({
        actorUserId: "requester-1",
        requestId: "request-1",
      })
    ).rejects.toThrow("nao esta elegivel para aprovacao");

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("requested_by_user_id is distinct from $2"),
      ["request-1", "requester-1"]
    );
    expect(query).toHaveBeenLastCalledWith("rollback");
  });

  it("requires both the legal feature flag and an approval reference", async () => {
    dependencies.env.DATA_RETENTION_ENABLED = true;
    dependencies.env.LEGAL_APPROVAL_REFERENCE = undefined;

    await expect(
      executePrivacyAnonymization({
        actorUserId: "executor-1",
        requestId: "request-1",
      })
    ).rejects.toThrow("referencia juridica formal");
  });

  it("requires an executor different from both requester and approver", async () => {
    dependencies.env.DATA_RETENTION_ENABLED = true;
    dependencies.env.LEGAL_APPROVAL_REFERENCE = "LEGAL-2026-001";
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      executePrivacyAnonymization({
        actorUserId: "approver-1",
        requestId: "request-1",
      })
    ).rejects.toThrow("nao esta elegivel para execucao");

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("approved_by_user_id is distinct from $2"),
      ["request-1", "approver-1"]
    );
    expect(query).toHaveBeenLastCalledWith("rollback");
  });
});
