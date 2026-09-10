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
    courseHealth: {
      activeCourses: 0,
      averageReadinessPercent: null,
      coursesNeedingAttention: [],
      coursesNeedingAttentionCount: 0,
      draftCourses: 0,
    },
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

  it("preserves the authoring dashboard for admin", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Central do LMS");
    expect(dependencies.getAdminOverview).toHaveBeenCalledOnce();
    expect(dependencies.getAdminDashboardProjection).toHaveBeenCalledOnce();
    expect(dependencies.getSupportCourseOperations).not.toHaveBeenCalled();
  });

  it("keeps recent purchases and certificates in the admin home", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });
    dependencies.getAdminDashboardProjection.mockResolvedValue({
      courseHealth: {
        activeCourses: 0,
        averageReadinessPercent: null,
        coursesNeedingAttention: [],
        coursesNeedingAttentionCount: 0,
        draftCourses: 0,
      },
      recentCertificates: [
        {
          code: "CERT-1",
          courseTitle: "Curso de exemplo",
          issuedAt: new Date("2026-09-08T12:00:00.000Z"),
          studentName: "Aluna exemplo",
        },
      ],
      recentOrders: [
        {
          amountInCents: 12_900,
          checkoutStatus: "active",
          courseTitle: "Curso de exemplo",
          createdAt: new Date("2026-09-08T11:00:00.000Z"),
          customerEmail: "aluna@example.test",
          customerName: "Aluna exemplo",
          id: "order-1",
          paidAmountInCents: 12_900,
          status: "paid",
        },
      ],
    });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Últimas compras");
    expect(markup).toContain("Últimos certificados emitidos");
    expect(markup).toContain("CERT-1");
    expect(markup).toContain("Aluna exemplo");
    expect(markup).toContain("/admin/financeiro?tab=orders&amp;q=order-1");
  });
});
