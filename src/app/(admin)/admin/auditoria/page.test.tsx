import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminAuditData: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminAuditData: dependencies.getAdminAuditData,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("./outbox-dead-letters", () => ({
  OutboxDeadLetterReprocess: () => null,
}));

import AuditoriaPage from "./page";

describe("AuditoriaPage", () => {
  it("includes uncertain checkouts in the displayed financial backlog", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });
    dependencies.getAdminAuditData.mockResolvedValue({
      auditLogs: [],
      operationalBacklog: {
        outbox: { deadLetters: 0, oldestReadyAt: null, ready: 0 },
        payments: {
          uncertainCheckouts: 9,
          uncertainRefunds: 7,
          uncorrelatedOrders: 6,
        },
        videos: { oldestPendingAt: null, pending: 0 },
        webhooks: { failed: 0, oldestFailedAt: null, ready: 0 },
      },
      outboxDeadLetters: [],
    });

    const markup = renderToStaticMarkup(await AuditoriaPage());

    expect(markup).toContain(">22<");
    expect(markup).toContain("Checkouts incertos: 9");
  });
});
