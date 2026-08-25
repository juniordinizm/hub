import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminDashboardData: vi.fn(),
  getAdminOverview: vi.fn(),
  getSupportCourseOperations: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/features/admin/server", () => ({
  getAdminDashboardData: dependencies.getAdminDashboardData,
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
  dependencies.getAdminDashboardData.mockReset();
  dependencies.getAdminOverview.mockReset();
  dependencies.getSupportCourseOperations.mockReset();
  dependencies.requirePermission.mockReset();
  dependencies.getAdminOverview.mockResolvedValue({
    activeEnrollments: 0,
    courses: 0,
    paidOrders: 0,
    recentWebhooks: [],
    students: 0,
  });
  dependencies.getAdminDashboardData.mockResolvedValue({
    courses: [],
    coursesRevenue: [],
    lessons: [],
    modules: [],
    orders: [],
  });
  dependencies.getSupportCourseOperations.mockResolvedValue([]);
});

describe("AdminPage", () => {
  it("selects the support projection before any broad admin loader", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "support" });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Operação de suporte");
    expect(dependencies.getSupportCourseOperations).toHaveBeenCalledOnce();
    expect(dependencies.getAdminOverview).not.toHaveBeenCalled();
    expect(dependencies.getAdminDashboardData).not.toHaveBeenCalled();
  });

  it("preserves the authoring dashboard for admin", async () => {
    dependencies.requirePermission.mockResolvedValue({ role: "admin" });

    const markup = renderToStaticMarkup(await AdminPage());

    expect(markup).toContain("Central do LMS");
    expect(dependencies.getAdminOverview).toHaveBeenCalledOnce();
    expect(dependencies.getAdminDashboardData).toHaveBeenCalledOnce();
    expect(dependencies.getSupportCourseOperations).not.toHaveBeenCalled();
  });
});
