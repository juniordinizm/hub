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
        alerts: [
          { code: "outbox_dead_letter", severity: "critical" as const },
          { code: "outbox_pending_stale", severity: "warning" as const },
          { code: "webhook_ready_stale", severity: "high" as const },
          { code: "webhook_retry_stale", severity: "high" as const },
          { code: "webhook_failed_stale", severity: "high" as const },
          {
            code: "webhook_payload_retention_risk",
            severity: "critical" as const,
          },
        ],
        emailDelivery: {
          accepted: 7,
          bounced: 1,
          complained: 2,
          deadLetters: 0,
          delivered: 6,
          oldestRetryAt: null,
          retrying: 0,
        },
        outbox: {
          deadLetters: 0,
          oldestReadyAt: null,
          ready: 0,
          superseded: 0,
        },
        payments: {
          uncertainCheckouts: 9,
          uncertainRefunds: 7,
          uncorrelatedOrders: 6,
        },
        videos: { oldestPendingAt: null, pending: 0 },
        webhooks: {
          failed: 0,
          oldestFailedAt: null,
          oldestReadyAt: null,
          oldestRetryAt: null,
          ready: 0,
          retryable: 0,
        },
      },
      outboxDeadLetters: [],
    });

    const markup = renderToStaticMarkup(await AuditoriaPage());

    expect(markup).toContain(">22<");
    expect(markup).toContain("Checkouts incertos: 9");
    expect(markup).toContain("E-mails aceitos");
    expect(markup).toContain(">7<");
    expect(markup).toContain("Entregues: 6");
    expect(markup).toContain("Mensagens em dead letter");
    expect(markup).toContain(
      "Há mensagens que esgotaram as tentativas e exigem revisão manual."
    );
    expect(markup).toContain("Outbox com atraso");
    expect(markup).toContain(
      "A mensagem pendente mais antiga ultrapassou o limite operacional."
    );
    expect(markup).toContain("Webhooks aguardando processamento");
    expect(markup).toContain("Novas tentativas de webhook atrasadas");
    expect(markup).toContain("Falhas persistentes de webhook");
    expect(markup).toContain("Risco de retenção de webhook");
    expect(markup).toContain("Crítico");
    expect(markup).toContain("Alta prioridade");
    expect(markup).toContain("Atenção");
    expect(markup).toContain('data-slot="alert"');
    expect(markup).toContain('data-slot="badge"');
    expect(markup).toContain('data-variant="destructive"');
    expect(markup).toContain('data-variant="outline"');
    expect(markup).not.toContain("webhook_ready_stale");
    expect(markup).not.toContain("outbox_dead_letter");
    expect(markup).not.toContain("outbox_pending_stale");
  });
});
