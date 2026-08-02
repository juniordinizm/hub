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
