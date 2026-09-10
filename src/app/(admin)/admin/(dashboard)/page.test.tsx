import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminDashboardProjection: vi.fn(),
  getAdminOverview: vi.fn(),
  getSupportCourseOperations: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminDashboardProjection: dependencies.getAdminDashboardProjection,
  getAdminOverview: dependencies.getAdminOverview,
}));
vi.mock("@/features/admin/support-server", () => ({
  getSupportCourseOperations: dependencies.getSupportCourseOperations,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import AdminPage from "./page";

const emptyOperations = {
  access: {
    expiringEnrollmentCount: 0,
    expiringStudentCount: 0,
  },
  certificates: {
    pending: [],
    pendingCount: 0,
  },
  financial: {
    disputedOrderCount: 0,
    failedRefundCount: 0,
    pendingPaymentReviewCount: 0,
    pendingRefundCount: 0,
    pendingRevenueInCents: 0,
    refundedOrderCount: 0,
    uncertainCheckoutCount: 0,
    uncertainRefundCount: 0,
    uncorrelatedOrderCount: 0,
  },
  integrations: {
    backlog: {
      alerts: [],
      emailDelivery: {
        accepted: 0,
        bounced: 0,
        complained: 0,
        deadLetters: 0,
        delivered: 0,
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
        uncorrelatedOrders: 0,
        uncertainRefunds: 0,
      },
      videos: {
        oldestPendingAt: null,
        pending: 0,
      },
      webhooks: {
        failed: 0,
        oldestFailedAt: null,
        oldestReadyAt: null,
        oldestRetryAt: null,
        ready: 0,
        retryable: 0,
      },
    },
    failedJmvDeleteCount: 0,
    failedJmvUploadCount: 0,
    pendingJmvDeleteCount: 0,
    processingJmvUploadCount: 0,
  },
  supportRequests: {
    deliveredCount: 0,
    failedCount: 0,
    pendingCount: 0,
    recent: [],
    sentCount: 0,
    totalCount: 0,
  },
};

const emptyCourseHealth = {
  activeCourses: 0,
  averageReadinessPercent: null,
  coursesNeedingAttention: [],
  coursesNeedingAttentionCount: 0,
  draftCourses: 0,
  salesPausedCourses: 0,
};

beforeEach(() => {
  dependencies.getAdminDashboardProjection.mockReset();
  dependencies.getAdminOverview.mockReset();
  dependencies.getSupportCourseOperations.mockReset();
  dependencies.requirePermission.mockReset();
  dependencies.getAdminOverview.mockResolvedValue({
    activeEnrollments: 0,
    courses: 0,
    failedWebhooks: 0,
    paidOrders: 0,
    paidRevenueInCents: 0,
    pendingOrders: 0,
    retryableWebhooks: 0,
    students: 0,
  });
  dependencies.getAdminDashboardProjection.mockResolvedValue({
    courseHealth: emptyCourseHealth,
    operations: emptyOperations,
    recentCertificates: [],
    recentOrders: [],
  });
  dependencies.getSupportCourseOperations.mockResolvedValue({
    courses: [],
    hasNextPage: false,
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totals: {
      paidOrderCount: 0,
      paidRevenueInCents: 0,
      totalEnrollmentCount: 0,
    },
  });
});

describe("AdminPage", () => {
  it("selects the support projection before any broad admin loader", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "support" });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Operação de suporte");
    expect(dependencies.getSupportCourseOperations).toHaveBeenCalledWith({
      page: 1,
    });
    expect(dependencies.getAdminOverview).not.toHaveBeenCalled();
    expect(dependencies.getAdminDashboardProjection).not.toHaveBeenCalled();
  });

  it("renders the admin home as an operational command center", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Operação diária");
    expect(markup).toContain("Resumo do dia");
    expect(markup).toContain("Contexto de acompanhamento");
    expect(markup).not.toContain("Pendências para resolver");
    expect(markup).not.toContain("Conteúdo e certificados");
    expect(markup).not.toContain("Atividade recente");
    expect(markup).not.toContain("Certificados sem emissão");
    expect(markup).not.toContain("Tudo emitido");
    expect(markup).not.toContain("Ver todos os pedidos");
    expect(markup).not.toContain("Ações rápidas");
    expect(dependencies.getAdminOverview).toHaveBeenCalledOnce();
    expect(dependencies.getAdminDashboardProjection).toHaveBeenCalledOnce();
  });

  it("keeps recent purchases and certificates as compact tables", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });
    dependencies.getAdminDashboardProjection.mockResolvedValue({
      courseHealth: emptyCourseHealth,
      operations: emptyOperations,
      recentCertificates: [
        {
          code: "CERT-1",
          courseTitle: "Curso de exemplo",
          issuedAt: new Date("2026-09-08T12:00:00.000Z"),
          status: "valid",
          studentName: "Aluno exemplo",
        },
      ],
      recentOrders: [
        {
          amountInCents: 12_900,
          checkoutStatus: "active",
          courseTitle: "Curso de exemplo",
          createdAt: new Date("2026-09-08T11:00:00.000Z"),
          customerEmail: "aluno@example.test",
          customerName: "Aluno exemplo",
          id: "order-1",
          paidAmountInCents: 12_900,
          status: "paid",
        },
      ],
    });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Últimas compras");
    expect(markup).toContain("Últimos certificados emitidos");
    expect(markup).toContain("Os 5 pedidos mais recentes do checkout.");
    expect(markup).toContain("Os 5 certificados emitidos mais recentemente.");
    expect(markup).toContain("<table");
    expect(markup).toContain("CERT-1");
    expect(markup).toContain("Aluno exemplo");
    expect(markup).toContain("/admin/financeiro?tab=orders&amp;q=order-1");
    expect(markup).toContain("/certificados/CERT-1");
    expect(markup).not.toContain(">Arquivo<");
  });

  it("hides empty operational sessions without hiding the remaining content", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });
    dependencies.getAdminDashboardProjection.mockResolvedValue({
      courseHealth: emptyCourseHealth,
      operations: {
        ...emptyOperations,
        certificates: {
          pending: [
            {
              completedAt: new Date("2026-09-08T13:00:00.000Z"),
              courseId: "course-1",
              courseTitle: "Curso de exemplo",
              studentName: "Aluno exemplo",
            },
          ],
          pendingCount: 1,
        },
      },
      recentCertificates: [],
      recentOrders: [],
    });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Conteúdo e certificados");
    expect(markup).toContain("Certificados sem emissão");
    expect(markup).not.toContain("Prontidão do catálogo");
    expect(markup).toContain("Pendências para resolver");
    expect(markup).not.toContain("xl:grid-cols-2");
    expect(markup).not.toContain("Atividade recente");
  });

  it("shows concurrent queues instead of collapsing everything into one alert", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });
    dependencies.getAdminOverview.mockResolvedValue({
      activeEnrollments: 12,
      courses: 3,
      failedWebhooks: 2,
      paidOrders: 18,
      paidRevenueInCents: 180_000,
      pendingOrders: 4,
      retryableWebhooks: 1,
      students: 25,
    });
    dependencies.getAdminDashboardProjection.mockResolvedValue({
      courseHealth: {
        activeCourses: 2,
        averageReadinessPercent: 72,
        coursesNeedingAttention: [
          {
            actionTab: "content",
            hasDescription: true,
            hasPublishedPublication: false,
            hasThumbnail: true,
            id: "course-1",
            moduleCount: 2,
            publishedLessonCount: 3,
            readinessPercent: 80,
            status: "active",
            title: "Curso de exemplo",
            totalLessonCount: 4,
          },
        ],
        coursesNeedingAttentionCount: 1,
        draftCourses: 1,
        salesPausedCourses: 0,
      },
      operations: {
        ...emptyOperations,
        access: {
          expiringEnrollmentCount: 2,
          expiringStudentCount: 1,
        },
        certificates: {
          pending: [
            {
              completedAt: new Date("2026-09-08T13:00:00.000Z"),
              courseId: "course-1",
              courseTitle: "Curso de exemplo",
              studentName: "Aluno exemplo",
            },
          ],
          pendingCount: 1,
        },
        financial: {
          ...emptyOperations.financial,
          pendingPaymentReviewCount: 2,
          pendingRevenueInCents: 45_000,
        },
        integrations: {
          ...emptyOperations.integrations,
          backlog: {
            ...emptyOperations.integrations.backlog,
            webhooks: {
              ...emptyOperations.integrations.backlog.webhooks,
              failed: 2,
              retryable: 1,
            },
          },
        },
        supportRequests: {
          ...emptyOperations.supportRequests,
          deliveredCount: 1,
          recent: [
            {
              courseTitle: "Curso de exemplo",
              createdAt: new Date("2026-09-08T14:00:00.000Z"),
              deliveryState: "delivered",
              id: "support-1",
              studentName: "Aluno exemplo",
              subject: "Dúvida sobre acesso",
            },
          ],
          totalCount: 1,
        },
      },
      recentCertificates: [],
      recentOrders: [],
    });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Ação necessária");
    expect(markup).toContain("Revisões financeiras");
    expect(markup).toContain("Falhas de integração");
    expect(markup).toContain("Certificados pendentes");
    expect(markup).toContain("Certificados sem emissão");
    expect(markup).toContain("Concluído em");
    expect(markup).toContain("Webhooks em retry");
    expect(markup).toContain("Acessos vencendo em 30 dias");
    expect(markup).toContain("Solicitações de suporte");
    expect(markup).toContain("Entregue");
    expect(markup).toContain('href="/admin/cursos/course-1?tab=content"');
  });
});
