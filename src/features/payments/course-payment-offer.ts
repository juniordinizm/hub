export const MIN_INSTALLMENT_COUNT = 1;
export const MAX_INSTALLMENT_COUNT = 21;

export interface CoursePaymentOffer {
  allowCreditCard: boolean;
  allowPix: boolean;
  maxInstallmentCount: number;
}

export const DEFAULT_COURSE_PAYMENT_OFFER: CoursePaymentOffer = {
  allowCreditCard: true,
  allowPix: true,
  maxInstallmentCount: 3,
};

export interface AsaasCheckoutPaymentOptions {
  billingTypes: Array<"CREDIT_CARD" | "PIX">;
  chargeTypes: Array<"DETACHED" | "INSTALLMENT">;
  installment?: {
    maxInstallmentCount: number;
  };
}

export const parseCoursePaymentOffer = (
  offer: CoursePaymentOffer
): CoursePaymentOffer => {
  if (!(offer.allowCreditCard || offer.allowPix)) {
    throw new Error("Selecione Pix, cartao ou ambos.");
  }
  if (
    !Number.isInteger(offer.maxInstallmentCount) ||
    offer.maxInstallmentCount < MIN_INSTALLMENT_COUNT ||
    offer.maxInstallmentCount > MAX_INSTALLMENT_COUNT
  ) {
    throw new Error("Quantidade de parcelas deve estar entre 1 e 21.");
  }
  return offer.allowCreditCard
    ? offer
    : { ...offer, maxInstallmentCount: MIN_INSTALLMENT_COUNT };
};

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
