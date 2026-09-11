import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getAdminOperationsData: vi.fn(),
  getJmvstreamHealthSummary: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminOperationsData: dependencies.getAdminOperationsData,
}));
vi.mock("@/features/jmvstream/server", () => ({
  getJmvstreamHealthSummary: dependencies.getJmvstreamHealthSummary,
}));
vi.mock("@/features/jmvstream/portal", () => ({
  JMVSTREAM_PORTAL_URL: "https://hub.jmvtechnology.com",
}));
vi.mock("@/features/operations/server", () => ({}));
vi.mock("./outbox-dead-letter-dialog", () => ({
  OutboxDeadLetterDialog: () => <button type="button">Detalhes</button>,
}));
vi.mock("./webhook-recovery-dialog", () => ({
  WebhookRecoveryDialog: () => <button type="button">Detalhes</button>,
}));

import AdminOperationsPage from "./page";

const emptyBacklog = {
  alerts: [],
  emailDelivery: {
    accepted: 5,
    bounced: 0,
    complained: 0,
    deadLetters: 0,
    delivered: 4,
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
    uncertainCheckouts: 0,
    uncertainRefunds: 0,
    uncorrelatedOrders: 0,
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
};

describe("AdminOperationsPage", () => {
  it("keeps operational queues and recovery actions together", async () => {
    dependencies.getJmvstreamHealthSummary.mockResolvedValue({
      auth: "ok",
      failedDeletes: 2,
      failedUploads: 1,
      folderCount: 8,
      message: "JMVStream autenticada e galerias acessíveis.",
      orphanFolders: 1,
      pendingDeletes: 3,
      processingUploads: 4,
    });
    dependencies.getAdminOperationsData.mockResolvedValue({
      canRetryOutbox: true,
      canRetryWebhook: true,
      operationalBacklog: {
        ...emptyBacklog,
        alerts: [{ code: "outbox_dead_letter", severity: "critical" }],
        outbox: {
          ...emptyBacklog.outbox,
          deadLetters: 1,
        },
      },
      outboxDeadLetters: {
        hasNextPage: false,
        messages: [
          {
            attempts: 5,
            createdAt: new Date("2026-09-07T12:00:00Z"),
            id: "message-1",
            lastErrorAt: new Date("2026-09-07T12:30:00Z"),
            lastErrorCode: "delivery_failed",
            topic: "email.certificate-issued",
          },
        ],
        page: 1,
        pageSize: 20,
        totalCount: 1,
      },
      webhookEvents: {
        events: [],
        hasNextPage: false,
        page: 1,
        pageSize: 20,
        search: "",
        totalCount: 0,
      },
    });

    const markup = renderToStaticMarkup(
      await AdminOperationsPage({
        searchParams: Promise.resolve({}),
      })
    );

    expect(markup).toContain("Operações e recuperação");
    expect(markup).toContain("Alertas operacionais");
    expect(markup).toContain("Mensagens em dead letter");
    expect(markup).toContain("Detalhes");
    expect(markup).toContain("Nenhum webhook para recuperar");
    expect(markup).toContain("Saúde da JMVStream");
    expect(markup).toContain("Conectada");
    expect(markup).toContain("Uploads com falha");
    expect(markup).toContain("Abrir portal JMVStream");
    expect(markup).toContain("Abrir cursos");
    expect(markup).toContain("Abrir Financeiro");
    expect(markup).not.toContain("Alterações administrativas recentes");
  });
});
