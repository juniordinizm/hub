import {
  type CourseCardPricingPolicy,
  isCourseCardPricingPolicy,
  MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS,
} from "./installment-pricing";

export const MIN_INSTALLMENT_COUNT = 1;
export const MAX_INSTALLMENT_COUNT = 12;
export interface CoursePaymentOffer {
  allowCreditCard: boolean;
  allowPix: boolean;
  cardPricingPolicy: CourseCardPricingPolicy;
  maxInstallmentCount: number;
}

export const DEFAULT_COURSE_PAYMENT_OFFER: CoursePaymentOffer = {
  allowCreditCard: true,
  allowPix: true,
  cardPricingPolicy: "buyer_pays_incremental_installment_cost",
  maxInstallmentCount: 3,
};

export const parseCoursePaymentOffer = (
  offer: Omit<CoursePaymentOffer, "cardPricingPolicy"> & {
    cardPricingPolicy: unknown;
  }
): CoursePaymentOffer => {
  if (!(offer.allowCreditCard || offer.allowPix)) {
    throw new Error("Selecione Pix, cartao ou ambos.");
  }
  if (!isCourseCardPricingPolicy(offer.cardPricingPolicy)) {
    throw new Error("Politica de parcelamento invalida.");
  }
  if (
    !Number.isInteger(offer.maxInstallmentCount) ||
    offer.maxInstallmentCount < MIN_INSTALLMENT_COUNT ||
    offer.maxInstallmentCount > MAX_INSTALLMENT_COUNT
  ) {
    throw new Error("Quantidade de parcelas deve estar entre 1 e 12.");
  }
  return offer.allowCreditCard
    ? {
        allowCreditCard: offer.allowCreditCard,
        allowPix: offer.allowPix,
        cardPricingPolicy: offer.cardPricingPolicy,
        maxInstallmentCount: offer.maxInstallmentCount,
      }
    : {
        ...offer,
        cardPricingPolicy: "seller_absorbs_all",
        maxInstallmentCount: MIN_INSTALLMENT_COUNT,
      };
};

export const getEffectiveMaxInstallmentCount = ({
  configuredMaxInstallmentCount,
  priceInCents,
}: {
  configuredMaxInstallmentCount: number;
  priceInCents: number;
}): number =>
  Math.max(
    MIN_INSTALLMENT_COUNT,
    Math.min(
      MAX_INSTALLMENT_COUNT,
      configuredMaxInstallmentCount,
      Math.floor(priceInCents / MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS)
    )
  );
