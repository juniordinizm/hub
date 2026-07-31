import { ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS } from "./asaas";
import type { PaymentsCheckoutMode } from "./checkout-availability";

export type CoursePurchaseLink =
  | { available: true; url: string }
  | {
      available: false;
      reason:
        | "checkout_disabled"
        | "course_inactive"
        | "course_unpublished"
        | "invalid_price";
    };

interface CoursePurchaseLinkCourse {
  hasPublishedPublication: boolean;
  priceInCents: number;
  slug: string;
  status: string;
}

export const getCoursePurchaseLink = ({
  appUrl,
  checkoutMode,
  course,
}: {
  appUrl: string;
  checkoutMode: PaymentsCheckoutMode;
  course: CoursePurchaseLinkCourse;
}): CoursePurchaseLink => {
  if (checkoutMode !== "public") {
    return { available: false, reason: "checkout_disabled" };
  }

  if (course.status !== "active") {
    return { available: false, reason: "course_inactive" };
  }

  if (!course.hasPublishedPublication) {
    return { available: false, reason: "course_unpublished" };
  }

  if (
    !Number.isInteger(course.priceInCents) ||
    course.priceInCents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS
  ) {
    return { available: false, reason: "invalid_price" };
  }

  return {
    available: true,
    url: new URL(
      `/comprar/${encodeURIComponent(course.slug)}`,
      appUrl
    ).toString(),
  };
};
