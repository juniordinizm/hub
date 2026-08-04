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
  paymentCardPricingPolicy: "buyer_pays_incremental_installment_cost",
  paymentMaxInstallmentCount: 3,
  priceInCents: 1990,
  slug: "curso-teste",
  status: "active",
  subtitle: null,
  thumbnailUrl: null,
  title: "Curso de teste",
  workloadHours: 10,
};

describe("course payment settings", () => {
  it("explains when price reduces the effective installment maximum", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm
        course={{ ...course, paymentCardPricingPolicy: "seller_absorbs_all" }}
      />
    );

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

  it("lets the admin choose who absorbs the incremental installment cost", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain('name="paymentCardPricingPolicy"');
    expect(markup).toContain("Cliente paga somente o acrescimo das parcelas");
    expect(markup).toContain("Parcelamento sem acrescimo");
    expect(markup).toContain("1x permanece sem acrescimo");
  });
});
