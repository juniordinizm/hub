import { describe, expect, it } from "vitest";
import { ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS } from "./asaas";
import { getCoursePurchaseLink } from "./course-purchase-link";

const eligibleCourse = {
  hasPublishedPublication: true,
  priceInCents: ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS,
  salesStatus: "open",
  slug: "curso",
  status: "active",
};

describe("getCoursePurchaseLink", () => {
  it("returns the stable public purchase URL for an eligible course", () => {
    expect(
      getCoursePurchaseLink({
        appUrl: "https://hub.example",
        checkoutMode: "public",
        course: eligibleCourse,
      })
    ).toEqual({
      available: true,
      url: "https://hub.example/comprar/curso",
    });
  });

  it.each([
    [
      "checkout_disabled",
      { checkoutMode: "authenticated" as const, course: eligibleCourse },
    ],
    [
      "course_inactive",
      {
        checkoutMode: "public" as const,
        course: { ...eligibleCourse, status: "draft" },
      },
    ],
    [
      "course_unpublished",
      {
        checkoutMode: "public" as const,
        course: { ...eligibleCourse, hasPublishedPublication: false },
      },
    ],
    [
      "sales_closed",
      {
        checkoutMode: "public" as const,
        course: { ...eligibleCourse, salesStatus: "closed" },
      },
    ],
    [
      "invalid_price",
      {
        checkoutMode: "public" as const,
        course: {
          ...eligibleCourse,
          priceInCents: ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS - 1,
        },
      },
    ],
  ])("returns the distinct %s unavailable reason", (reason, input) => {
    expect(
      getCoursePurchaseLink({ appUrl: "https://hub.example", ...input })
    ).toEqual({ available: false, reason });
  });

  it("uses the application origin and safely encodes the course slug", () => {
    expect(
      getCoursePurchaseLink({
        appUrl: "https://hub.example/admin/configuracao?from=legacy",
        checkoutMode: "public",
        course: { ...eligibleCourse, slug: "curso avancado/2026?" },
      })
    ).toEqual({
      available: true,
      url: "https://hub.example/comprar/curso%20avancado%2F2026%3F",
    });
  });

  it("does not hide an invalid application URL behind a fallback", () => {
    expect(() =>
      getCoursePurchaseLink({
        appUrl: "not-a-url",
        checkoutMode: "public",
        course: eligibleCourse,
      })
    ).toThrow();
  });
});
