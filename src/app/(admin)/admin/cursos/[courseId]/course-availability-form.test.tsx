import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/course-availability-actions", () => ({
  archiveCourseAction: vi.fn(),
  restoreCourseAction: vi.fn(),
  saveCourseAvailabilityAction: vi.fn(),
}));

import { CourseAvailabilityForm } from "./course-availability-form";

const course = {
  catalogVisibility: "listed" as const,
  id: "course-1",
  hasCommercialHistory: true,
  interestCount: 3,
  interestNotificationsSent: 5,
  launchDate: null,
  launchLandingUrl: null,
  pendingCheckoutCancellations: 1,
  pendingInterestNotifications: 2,
  salesStatus: "closed" as const,
  status: "active",
};

describe("CourseAvailabilityForm", () => {
  it("shows paused visibility and aggregate interest controls", () => {
    const markup = renderToStaticMarkup(
      <CourseAvailabilityForm course={course} />
    );

    expect(markup).toContain("Vendas pausadas");
    expect(markup).toContain("Exibir na vitrine");
    expect(markup).toContain(
      "Rascunho e Em breve estão indisponíveis porque este Curso já possui histórico comercial."
    );
    expect(markup).toContain("3 interessadas");
    expect(markup).toContain("1 cancelamento pendente");
  });

  it("shows launch fields for coming soon", () => {
    const markup = renderToStaticMarkup(
      <CourseAvailabilityForm
        course={{
          ...course,
          launchDate: "2026-10-01",
          salesStatus: "closed",
          status: "draft",
        }}
      />
    );

    expect(markup).toContain("Data prevista");
    expect(markup).toContain("Landing externa");
    expect(markup).toContain("Definir data prevista");
    expect(markup).not.toContain('type="date"');
  });

  it("shows the external landing field while sales are paused", () => {
    const markup = renderToStaticMarkup(
      <CourseAvailabilityForm
        course={{
          ...course,
          launchLandingUrl: "https://landing.example/curso-pausado",
        }}
      />
    );

    expect(markup).toContain("Landing externa");
    expect(markup).toContain("https://landing.example/curso-pausado");
  });

  it("separates restore from ordinary availability changes", () => {
    const markup = renderToStaticMarkup(
      <CourseAvailabilityForm
        course={{
          ...course,
          catalogVisibility: "hidden",
          status: "archived",
        }}
      />
    );

    expect(markup).toContain("Curso arquivado");
    expect(markup).toContain("Restaurar curso");
  });
});
