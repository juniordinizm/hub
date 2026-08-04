import { createHash } from "node:crypto";
import type {
  AsaasCreditCardFeeSchedule,
  AsaasGateway,
  AsaasPaymentSimulation,
} from "./asaas";
import {
  type CourseCardPricingPolicy,
  createInstallmentSchedule,
  resolveSurchargeAmount,
} from "./installment-pricing";

const MAX_INSTALLMENT_COUNT = 12;
const MAX_QUOTE_CORRECTIONS = 24;
const BASIS_POINT_DIVISOR = 10_000;
const QUOTE_TTL_MS = 30 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PaymentQuoteOption {
  count: number;
  feeAmountInCents: number | null;
  feePercentageBasisPoints: number | null;
  grossAmountInCents: number;
  installmentAmountInCents: number;
  lastInstallmentAmountInCents: number;
  netAmountInCents: number | null;
  operationFeeInCents: number | null;
  surchargeAmountInCents: number;
  targetNetAmountInCents: number | null;
}

export interface PaymentQuoteOptions {
  cardOptions: PaymentQuoteOption[];
  installmentsTemporarilyUnavailable: boolean;
  pix: { grossAmountInCents: number } | null;
}

export interface PaymentQuoteRecord {
  allowCreditCard: boolean;
  allowPix: boolean;
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  courseId: string;
  expiresAt: Date;
  feeProfile: AsaasCreditCardFeeSchedule | null;
  generatedAt: Date;
  id: string;
  maxInstallmentCount: number;
  options: PaymentQuoteOptions;
  providerEnvironment: "production" | "sandbox";
  signature: string;
}

export interface PaymentQuoteRepository {
  findActive(input: {
    now: Date;
    signature: string;
  }): Promise<PaymentQuoteRecord | null>;
  publishIfAbsent(
    record: Omit<PaymentQuoteRecord, "id">
  ): Promise<PaymentQuoteRecord>;
}

export type PaymentQuoteGateway = Pick<
  AsaasGateway,
  "getAccountFees" | "simulatePayment"
>;

interface CourseQuoteInput {
  allowCreditCard: boolean;
  allowPix: boolean;
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  courseId: string;
  maxInstallmentCount: number;
}

interface CreateCoursePaymentQuoteInput {
  course: CourseQuoteInput;
  gateway: PaymentQuoteGateway;
  now?: () => Date;
  providerEnvironment: "production" | "sandbox";
  repository: PaymentQuoteRepository;
}

interface BuildPaymentQuoteOptionsInput {
  allowCreditCard: boolean;
  allowPix: boolean;
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  feeSchedule: AsaasCreditCardFeeSchedule;
  maxInstallmentCount: number;
  now?: Date;
  simulateCard: (input: {
    grossAmountInCents: number;
    installmentCount: number;
  }) => Promise<AsaasPaymentSimulation>;
}

const createOption = ({
  baseAmountInCents,
  count,
  grossAmountInCents,
  simulation,
  targetNetAmountInCents,
}: {
  baseAmountInCents: number;
  count: number;
  grossAmountInCents: number;
  simulation: AsaasPaymentSimulation | null;
  targetNetAmountInCents: number | null;
}): PaymentQuoteOption => {
  const schedule = createInstallmentSchedule({
    count,
    grossAmountInCents,
  });
  return {
    count,
    feeAmountInCents: simulation
      ? grossAmountInCents - simulation.netAmountInCents
      : null,
    feePercentageBasisPoints: simulation?.feePercentageBasisPoints ?? null,
    grossAmountInCents,
    installmentAmountInCents: schedule.installmentAmountInCents,
    lastInstallmentAmountInCents: schedule.lastInstallmentAmountInCents,
    netAmountInCents: simulation?.netAmountInCents ?? null,
    operationFeeInCents: simulation?.operationFeeInCents ?? null,
    surchargeAmountInCents: resolveSurchargeAmount(
      baseAmountInCents,
      grossAmountInCents
    ),
    targetNetAmountInCents,
  };
};

const ceilDivide = (dividend: bigint, divisor: bigint): bigint =>
  (dividend + divisor - BigInt(1)) / divisor;

const getFeePercentageBasisPoints = (
  count: number,
  feeSchedule: AsaasCreditCardFeeSchedule,
  now: Date
): number => {
  const currentDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const promotionIsActive =
    feeSchedule.discountExpiration !== undefined &&
    ISO_DATE_PATTERN.test(feeSchedule.discountExpiration) &&
    currentDate <= feeSchedule.discountExpiration;
  if (count === 1) {
    return promotionIsActive
      ? (feeSchedule.promotionalOneInstallmentPercentageBasisPoints ??
          feeSchedule.oneInstallmentPercentageBasisPoints)
      : feeSchedule.oneInstallmentPercentageBasisPoints;
  }
  if (count <= 6) {
    return promotionIsActive
      ? (feeSchedule.promotionalUpToSixInstallmentsPercentageBasisPoints ??
          feeSchedule.upToSixInstallmentsPercentageBasisPoints)
      : feeSchedule.upToSixInstallmentsPercentageBasisPoints;
  }
  return promotionIsActive
    ? (feeSchedule.promotionalUpToTwelveInstallmentsPercentageBasisPoints ??
        feeSchedule.upToTwelveInstallmentsPercentageBasisPoints)
    : feeSchedule.upToTwelveInstallmentsPercentageBasisPoints;
};

const estimateGrossAmount = ({
  feePercentageBasisPoints,
  operationFeeInCents,
  targetNetAmountInCents,
}: {
  feePercentageBasisPoints: number;
  operationFeeInCents: number;
  targetNetAmountInCents: number;
}): number => {
  const divisor = BASIS_POINT_DIVISOR - feePercentageBasisPoints;
  if (divisor <= 0) {
    throw new Error("Taxa de cartao invalida.");
  }
  const gross = ceilDivide(
    BigInt(targetNetAmountInCents + operationFeeInCents) *
      BigInt(BASIS_POINT_DIVISOR),
    BigInt(divisor)
  );
  if (gross > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Valor bruto fora do limite seguro.");
  }
  return Number(gross);
};

const quoteIncrementalInstallment = async ({
  baseAmountInCents,
  count,
  feeSchedule,
  now,
  simulateCard,
  targetNetAmountInCents,
}: {
  baseAmountInCents: number;
  count: number;
  feeSchedule: AsaasCreditCardFeeSchedule;
  now: Date;
  simulateCard: BuildPaymentQuoteOptionsInput["simulateCard"];
  targetNetAmountInCents: number;
}): Promise<PaymentQuoteOption> => {
  let grossAmountInCents = Math.max(
    baseAmountInCents,
    estimateGrossAmount({
      feePercentageBasisPoints: getFeePercentageBasisPoints(
        count,
        feeSchedule,
        now
      ),
      operationFeeInCents: feeSchedule.operationFeeInCents,
      targetNetAmountInCents,
    })
  );
  let simulation: AsaasPaymentSimulation | null = null;
  let converged = false;

  for (let attempt = 0; attempt < MAX_QUOTE_CORRECTIONS; attempt += 1) {
    simulation = await simulateCard({
      grossAmountInCents,
      installmentCount: count,
    });
    const correctedGrossAmountInCents =
      targetNetAmountInCents +
      (grossAmountInCents - simulation.netAmountInCents);
    if (correctedGrossAmountInCents === grossAmountInCents) {
      converged = true;
      break;
    }
    grossAmountInCents = Math.max(
      baseAmountInCents,
      correctedGrossAmountInCents
    );
  }

  if (!(simulation && converged)) {
    throw new Error("Simulacao de parcelamento indisponivel.");
  }
  if (simulation.netAmountInCents < targetNetAmountInCents) {
    throw new Error("Simulacao nao preservou o liquido alvo.");
  }

  for (let attempt = 0; attempt < MAX_QUOTE_CORRECTIONS; attempt += 1) {
    const previousGrossAmountInCents = grossAmountInCents - 1;
    if (previousGrossAmountInCents < baseAmountInCents) {
      break;
    }
    const previous = await simulateCard({
      grossAmountInCents: previousGrossAmountInCents,
      installmentCount: count,
    });
    if (previous.netAmountInCents < targetNetAmountInCents) {
      break;
    }
    grossAmountInCents = previousGrossAmountInCents;
    simulation = previous;
  }

  return createOption({
    baseAmountInCents,
    count,
    grossAmountInCents,
    simulation,
    targetNetAmountInCents,
  });
};

export const buildPaymentQuoteOptions = async ({
  allowCreditCard,
  allowPix,
  baseAmountInCents,
  cardPricingPolicy,
  feeSchedule,
  maxInstallmentCount,
  now = new Date(),
  simulateCard,
}: BuildPaymentQuoteOptionsInput): Promise<PaymentQuoteOptions> => {
  const result: PaymentQuoteOptions = {
    cardOptions: [],
    installmentsTemporarilyUnavailable: false,
    pix: allowPix ? { grossAmountInCents: baseAmountInCents } : null,
  };
  if (!allowCreditCard) {
    return result;
  }

  const maximum = Math.min(MAX_INSTALLMENT_COUNT, maxInstallmentCount);
  if (cardPricingPolicy === "seller_absorbs_all") {
    for (let count = 1; count <= maximum; count += 1) {
      try {
        result.cardOptions.push(
          createOption({
            baseAmountInCents,
            count,
            grossAmountInCents: baseAmountInCents,
            simulation: null,
            targetNetAmountInCents: null,
          })
        );
      } catch {
        break;
      }
    }
    return result;
  }

  let oneInstallmentSimulation: AsaasPaymentSimulation;
  try {
    oneInstallmentSimulation = await simulateCard({
      grossAmountInCents: baseAmountInCents,
      installmentCount: 1,
    });
  } catch {
    result.cardOptions.push(
      createOption({
        baseAmountInCents,
        count: 1,
        grossAmountInCents: baseAmountInCents,
        simulation: null,
        targetNetAmountInCents: null,
      })
    );
    result.installmentsTemporarilyUnavailable = maximum > 1;
    return result;
  }

  result.cardOptions.push(
    createOption({
      baseAmountInCents,
      count: 1,
      grossAmountInCents: baseAmountInCents,
      simulation: oneInstallmentSimulation,
      targetNetAmountInCents: oneInstallmentSimulation.netAmountInCents,
    })
  );
  for (let count = 2; count <= maximum; count += 1) {
    try {
      result.cardOptions.push(
        await quoteIncrementalInstallment({
          baseAmountInCents,
          count,
          feeSchedule,
          now,
          simulateCard,
          targetNetAmountInCents: oneInstallmentSimulation.netAmountInCents,
        })
      );
    } catch {
      result.installmentsTemporarilyUnavailable = true;
      break;
    }
  }
  return result;
};

const createQuoteSignature = ({
  course,
  providerEnvironment,
}: Pick<
  CreateCoursePaymentQuoteInput,
  "course" | "providerEnvironment"
>): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        allowCreditCard: course.allowCreditCard,
        allowPix: course.allowPix,
        baseAmountInCents: course.baseAmountInCents,
        cardPricingPolicy: course.cardPricingPolicy,
        courseId: course.courseId,
        maxInstallmentCount: Math.min(
          MAX_INSTALLMENT_COUNT,
          course.maxInstallmentCount
        ),
        provider: "asaas",
        providerEnvironment,
        version: 1,
      })
    )
    .digest("hex");

const promotionExpiration = (
  feeSchedule: AsaasCreditCardFeeSchedule,
  generatedAt: Date
): Date | null => {
  const value = feeSchedule.discountExpiration;
  if (!(value && ISO_DATE_PATTERN.test(value))) {
    return null;
  }
  const expiration = new Date(`${value}T23:59:59.999-03:00`);
  return expiration > generatedAt ? expiration : null;
};

const resolveQuoteExpiration = (
  generatedAt: Date,
  feeSchedule: AsaasCreditCardFeeSchedule | null
): Date => {
  const ttlExpiration = new Date(generatedAt.getTime() + QUOTE_TTL_MS);
  if (!feeSchedule) {
    return ttlExpiration;
  }
  const discountExpiration = promotionExpiration(feeSchedule, generatedAt);
  return discountExpiration && discountExpiration < ttlExpiration
    ? discountExpiration
    : ttlExpiration;
};

const unavailableFeeSchedule: AsaasCreditCardFeeSchedule = {
  oneInstallmentPercentageBasisPoints: 0,
  operationFeeInCents: 0,
  upToSixInstallmentsPercentageBasisPoints: 0,
  upToTwelveInstallmentsPercentageBasisPoints: 0,
};

export const createCoursePaymentQuote = async ({
  course,
  gateway,
  now = () => new Date(),
  providerEnvironment,
  repository,
}: CreateCoursePaymentQuoteInput): Promise<PaymentQuoteRecord> => {
  const generatedAt = now();
  const signature = createQuoteSignature({ course, providerEnvironment });
  const cached = await repository.findActive({ now: generatedAt, signature });
  if (cached) {
    return cached;
  }

  let feeProfile: AsaasCreditCardFeeSchedule | null = null;
  if (
    course.allowCreditCard &&
    course.cardPricingPolicy === "buyer_pays_incremental_installment_cost"
  ) {
    try {
      feeProfile = await gateway.getAccountFees();
    } catch {
      feeProfile = null;
    }
  }
  const simulationAvailable =
    feeProfile !== null || course.cardPricingPolicy === "seller_absorbs_all";
  const options = await buildPaymentQuoteOptions({
    allowCreditCard: course.allowCreditCard,
    allowPix: course.allowPix,
    baseAmountInCents: course.baseAmountInCents,
    cardPricingPolicy: course.cardPricingPolicy,
    feeSchedule: feeProfile ?? unavailableFeeSchedule,
    maxInstallmentCount: course.maxInstallmentCount,
    now: generatedAt,
    simulateCard: simulationAvailable
      ? async ({ grossAmountInCents, installmentCount }) =>
          await gateway.simulatePayment({
            billingType: "CREDIT_CARD",
            installmentCount,
            valueInCents: grossAmountInCents,
          })
      : () =>
          Promise.reject(new Error("Simulacao de parcelamento indisponivel.")),
  });

  return await repository.publishIfAbsent({
    allowCreditCard: course.allowCreditCard,
    allowPix: course.allowPix,
    baseAmountInCents: course.baseAmountInCents,
    cardPricingPolicy: course.cardPricingPolicy,
    courseId: course.courseId,
    expiresAt: resolveQuoteExpiration(generatedAt, feeProfile),
    feeProfile,
    generatedAt,
    maxInstallmentCount: Math.min(
      MAX_INSTALLMENT_COUNT,
      course.maxInstallmentCount
    ),
    options,
    providerEnvironment,
    signature,
  });
};

export type QuoteRevalidationResult =
  | { selected: PaymentQuoteOption; status: "valid" }
  | {
      current: PaymentQuoteOption;
      selected: PaymentQuoteOption;
      status: "stale";
    }
  | { status: "unavailable" };

export const revalidateSelectedQuote = async ({
  baseAmountInCents,
  cardPricingPolicy,
  feeSchedule,
  now,
  selected,
  simulatePayment,
}: {
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  feeSchedule: AsaasCreditCardFeeSchedule;
  now: Date;
  selected: PaymentQuoteOption;
  simulatePayment: PaymentQuoteGateway["simulatePayment"];
}): Promise<QuoteRevalidationResult> => {
  if (selected.count === 1 || cardPricingPolicy === "seller_absorbs_all") {
    return { selected, status: "valid" };
  }
  if (selected.targetNetAmountInCents === null) {
    return { status: "unavailable" };
  }
  try {
    const current = await quoteIncrementalInstallment({
      baseAmountInCents,
      count: selected.count,
      feeSchedule,
      now,
      simulateCard: async ({ grossAmountInCents, installmentCount }) =>
        await simulatePayment({
          billingType: "CREDIT_CARD",
          installmentCount,
          valueInCents: grossAmountInCents,
        }),
      targetNetAmountInCents: selected.targetNetAmountInCents,
    });
    return current.grossAmountInCents === selected.grossAmountInCents
      ? { selected, status: "valid" }
      : { current, selected, status: "stale" };
  } catch {
    return { status: "unavailable" };
  }
};
