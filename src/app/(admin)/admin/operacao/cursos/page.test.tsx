import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { getSupportCourseOperations } = vi.hoisted(() => ({
  getSupportCourseOperations: vi.fn(),
}));

vi.mock("@/features/admin/support-server", () => ({
  getSupportCourseOperations,
}));

import SupportCoursesPage from "./page";

describe("SupportCoursesPage", () => {
  it("loads the support projection without an authoring loader", async () => {
    getSupportCourseOperations.mockResolvedValue([
      {
        activeEnrollmentCount: 2,
        id: "course-1",
        paidOrderCount: 1,
        paidRevenueInCents: 10_000,
        refundedOrderCount: 0,
        refundedRevenueInCents: 0,
        status: "active",
        title: "Curso operacional",
        totalEnrollmentCount: 2,
      },
    ]);

    const markup = renderToStaticMarkup(await SupportCoursesPage());

    expect(markup).toContain("Curso operacional");
    expect(markup).toContain("Consultar Alunas");
    expect(getSupportCourseOperations).toHaveBeenCalledOnce();
  });
});
