import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/actions", () => ({
  saveCourseAction: vi.fn(),
}));

import { type CourseData, CourseSettingsForm } from "./course-dialogs-client";

const course: CourseData = {
  accessDurationMonths: 12,
  description: "Curso de teste",
  id: "course-1",
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  priceInCents: 1990,
  slug: "curso-teste",
  status: "active",
  subtitle: null,
  thumbnailUrl: null,
  title: "Curso de teste",
  workloadHours: 10,
  workloadHoursOverride: null,
};

describe("course payment settings", () => {
  it("explains when price reduces the effective installment maximum", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain("Checkout sera limitado a");
    expect(markup).toContain("1x");
    expect(markup).toContain("3x continua salva");
  });

  it("does not warn when the configured maximum is effective", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, priceInCents: 9900 }} />
    );

    expect(markup).not.toContain("Checkout sera limitado a");
  });

  it("limits the admin configuration to twelve installments", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain('name="paymentMaxInstallmentCount"');
    expect(markup).toContain('max="12"');
  });

  it("exposes the automatic workload calculation and manual course override", () => {
    const automaticMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={course} />
    );
    const manualMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, workloadHoursOverride: 18 }} />
    );

    expect(automaticMarkup).toContain('name="workloadHoursOverride"');
    expect(automaticMarkup).toContain("Automática: 10 horas");
    expect(manualMarkup).toContain('value="18"');
    expect(automaticMarkup).toContain(
      "Deixe vazio para calcular automaticamente pela soma das aulas."
    );
  });
});
