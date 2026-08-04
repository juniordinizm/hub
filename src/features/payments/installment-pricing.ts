export const COURSE_CARD_PRICING_POLICIES = [
  "seller_absorbs_all",
  "buyer_pays_incremental_installment_cost",
] as const;

export type CourseCardPricingPolicy =
  (typeof COURSE_CARD_PRICING_POLICIES)[number];

export const MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS = 1000;

const MIN_INSTALLMENT_COUNT = 1;
const MAX_INSTALLMENT_COUNT = 12;

const assertCentAmount = (value: number, field: string): void => {
  if (!(Number.isSafeInteger(value) && value >= 0)) {
    throw new Error(`${field} deve ser informado em centavos inteiros.`);
  }
};

const assertInstallmentCount = (count: number): void => {
  if (
    !Number.isInteger(count) ||
    count < MIN_INSTALLMENT_COUNT ||
    count > MAX_INSTALLMENT_COUNT
  ) {
    throw new Error("Quantidade de parcelas deve estar entre 1 e 12.");
  }
};

export const isCourseCardPricingPolicy = (
  value: unknown
): value is CourseCardPricingPolicy =>
  typeof value === "string" &&
  COURSE_CARD_PRICING_POLICIES.some((policy) => policy === value);

export const chooseMinimumGrossAmount = ({
  candidates,
  netByGrossAmount,
  targetNetAmountInCents,
}: {
  candidates: readonly number[];
  netByGrossAmount: ReadonlyMap<number, number>;
  targetNetAmountInCents: number;
}): number | null => {
  assertCentAmount(targetNetAmountInCents, "Liquido alvo");
  const sortedCandidates = [...new Set(candidates)].sort(
    (left, right) => left - right
  );

  for (const grossAmountInCents of sortedCandidates) {
    assertCentAmount(grossAmountInCents, "Valor bruto");
    const netAmountInCents = netByGrossAmount.get(grossAmountInCents);
    if (netAmountInCents === undefined) {
      continue;
    }
    assertCentAmount(netAmountInCents, "Valor liquido");
    if (netAmountInCents >= targetNetAmountInCents) {
      return grossAmountInCents;
    }
  }

  return null;
};

export const resolveContractedAmount = ({
  baseAmountInCents,
  count,
  policy,
  quotedGrossAmountInCents,
}: {
  baseAmountInCents: number;
  count: number;
  policy: CourseCardPricingPolicy;
  quotedGrossAmountInCents: number;
}): number => {
  assertCentAmount(baseAmountInCents, "Preco-base");
  assertCentAmount(quotedGrossAmountInCents, "Valor cotado");
  assertInstallmentCount(count);
  if (!isCourseCardPricingPolicy(policy)) {
    throw new Error("Politica de parcelamento invalida.");
  }
  if (quotedGrossAmountInCents < baseAmountInCents) {
    throw new Error("Valor cotado nao pode ser menor que o preco-base.");
  }

  return count === 1 || policy === "seller_absorbs_all"
    ? baseAmountInCents
    : quotedGrossAmountInCents;
};

export const resolveSurchargeAmount = (
  baseAmountInCents: number,
  grossAmountInCents: number
): number => {
  assertCentAmount(baseAmountInCents, "Preco-base");
  assertCentAmount(grossAmountInCents, "Valor bruto");
  if (grossAmountInCents < baseAmountInCents) {
    throw new Error("Valor bruto nao pode ser menor que o preco-base.");
  }
  return grossAmountInCents - baseAmountInCents;
};

export const createInstallmentSchedule = ({
  count,
  grossAmountInCents,
}: {
  count: number;
  grossAmountInCents: number;
}): {
  count: number;
  installmentAmountInCents: number;
  lastInstallmentAmountInCents: number;
} => {
  assertInstallmentCount(count);
  assertCentAmount(grossAmountInCents, "Valor bruto");

  const installmentAmountInCents = Math.floor(grossAmountInCents / count);
  const lastInstallmentAmountInCents =
    grossAmountInCents - installmentAmountInCents * (count - 1);
  if (
    installmentAmountInCents < MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS ||
    lastInstallmentAmountInCents < MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS
  ) {
    throw new Error("Cada parcela deve ser de pelo menos R$ 10,00.");
  }

  return {
    count,
    installmentAmountInCents,
    lastInstallmentAmountInCents,
  };
};
