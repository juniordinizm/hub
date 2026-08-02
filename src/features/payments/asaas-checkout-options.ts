import {
  type CoursePaymentOffer,
  parseCoursePaymentOffer,
} from "./course-payment-offer";

export interface AsaasCheckoutPaymentOptions {
  billingTypes: Array<"CREDIT_CARD" | "PIX">;
  chargeTypes: Array<"DETACHED" | "INSTALLMENT">;
  installment?: {
    maxInstallmentCount: number;
  };
}

export const buildAsaasCheckoutPaymentOptions = (
  offer: CoursePaymentOffer
): AsaasCheckoutPaymentOptions => {
  const parsed = parseCoursePaymentOffer(offer);
  const billingTypes: AsaasCheckoutPaymentOptions["billingTypes"] = [];
  if (parsed.allowPix) {
    billingTypes.push("PIX");
  }
  if (parsed.allowCreditCard) {
    billingTypes.push("CREDIT_CARD");
  }
  if (parsed.maxInstallmentCount === 1) {
    return { billingTypes, chargeTypes: ["DETACHED"] };
  }
  return {
    billingTypes,
    chargeTypes: ["DETACHED", "INSTALLMENT"],
    installment: { maxInstallmentCount: parsed.maxInstallmentCount },
  };
};
