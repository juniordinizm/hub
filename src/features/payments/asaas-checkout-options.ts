import { parseCoursePaymentOffer } from "./course-payment-offer";

interface LegacyCheckoutPaymentOffer {
  allowCreditCard: boolean;
  allowPix: boolean;
  maxInstallmentCount: number;
}

export interface AsaasCheckoutPaymentOptions {
  billingTypes: Array<"CREDIT_CARD" | "PIX">;
  chargeTypes: Array<"DETACHED" | "INSTALLMENT">;
  installment?: {
    maxInstallmentCount: number;
  };
}

export const buildAsaasCheckoutPaymentOptions = (
  offer: LegacyCheckoutPaymentOffer
): AsaasCheckoutPaymentOptions => {
  const parsed = parseCoursePaymentOffer({
    ...offer,
    cardPricingPolicy: "seller_absorbs_all",
  });
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
