import { parseAsaasDecimalToCents } from "./asaas-money";

export interface AsaasWebhookEnvelope {
  dateCreated: string | null;
  event: string;
  key: string;
  subject:
    | {
        id: string;
        kind: "checkout" | "payment";
        status: string;
      }
    | {
        id: null;
        kind: "unknown";
        status: null;
      };
}

export type AsaasFinancialEffect = "grant" | "none" | "revoke";
export type AsaasFinancialReviewReason =
  | "amount_mismatch"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict";

export interface AsaasFinancialOrderSnapshot {
  amountInCents: number | null;
  checkoutStatus:
    | "active"
    | "cancelled"
    | "creating"
    | "expired"
    | "failed"
    | "pending"
    | "uncertain";
  orderStatus: "cancelled" | "disputed" | "paid" | "pending" | "refunded";
  providerPaymentStatus: string | null;
  providerRiskStatus: string | null;
}

export interface AsaasFinancialCorrelation {
  checkoutExternalReference: string | null;
  checkoutId: string | null;
  hasConflictingExternalReferences: boolean;
  localOrderId: string | null;
  paymentCheckoutSession: string | null;
  paymentExternalReference: string | null;
  paymentId: string | null;
  paymentInstallmentId?: string;
}

export interface AsaasFinancialEventDecision {
  action: "apply" | "ignore";
  alertReason: "event_anomaly" | "unknown_event" | null;
  correlation: AsaasFinancialCorrelation;
  effect: AsaasFinancialEffect;
  reviewReason: AsaasFinancialReviewReason | null;
  updates: {
    checkoutStatus?: AsaasFinancialOrderSnapshot["checkoutStatus"];
    feeAmountInCents?: number;
    netAmountInCents?: number;
    orderStatus?: AsaasFinancialOrderSnapshot["orderStatus"];
    paidAmountInCents?: number;
    paymentMethod?: string;
    providerCheckoutStatus?: string;
    providerDisputeStatus?: string;
    providerPaymentStatus?: string;
    providerRefundStatus?: string;
    providerRiskStatus?: string;
    providerSettlementStatus?: string;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const disputeEvents = new Set([
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_CHARGEBACK_REQUESTED",
]);

export const isAsaasAccessRevokingEvent = (event: string): boolean =>
  event === "PAYMENT_REFUNDED" || disputeEvents.has(event);
const refundEvidenceEvents = new Set([
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_REFUND_IN_PROGRESS",
]);
const riskEvents = new Set([
  "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_AWAITING_RISK_ANALYSIS",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
]);
const knownPaymentWebhookEvents = new Set([
  ...disputeEvents,
  ...refundEvidenceEvents,
  ...riskEvents,
  "PAYMENT_CONFIRMED",
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "PAYMENT_DELETED",
  "PAYMENT_OVERDUE",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_RECEIVED",
  "PAYMENT_REFUNDED",
]);
const knownCheckoutWebhookEvents = new Set([
  "CHECKOUT_CANCELED",
  "CHECKOUT_CREATED",
  "CHECKOUT_EXPIRED",
  "CHECKOUT_PAID",
]);

const LOCAL_ORDER_REFERENCE_PATTERN =
  /^order_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const adverseOrderStatuses = new Set<
  AsaasFinancialOrderSnapshot["orderStatus"]
>(["cancelled", "disputed", "refunded"]);
const blockingCardRiskStatuses = new Set([
  "AWAITING_RISK_ANALYSIS",
  "REPROVED_BY_RISK_ANALYSIS",
]);
const terminalCardRiskStatuses = new Set([
  "APPROVED_BY_RISK_ANALYSIS",
  "REPROVED_BY_RISK_ANALYSIS",
]);

const getString = (
  record: Record<string, unknown> | null,
  key: string
): string | null => {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
};

const getFinancialCorrelation = (
  payload: Record<string, unknown>
): AsaasFinancialCorrelation => {
  const payment = isRecord(payload.payment) ? payload.payment : null;
  const checkout = isRecord(payload.checkout) ? payload.checkout : null;
  const paymentExternalReference = getString(payment, "externalReference");
  const checkoutExternalReference = getString(checkout, "externalReference");
  const paymentInstallmentId = getString(payment, "installment");
  const paymentOrderId = LOCAL_ORDER_REFERENCE_PATTERN.exec(
    paymentExternalReference ?? ""
  )?.[1];
  const checkoutOrderId = LOCAL_ORDER_REFERENCE_PATTERN.exec(
    checkoutExternalReference ?? ""
  )?.[1];
  const hasConflictingOrderIds =
    paymentOrderId !== undefined &&
    checkoutOrderId !== undefined &&
    paymentOrderId.toLowerCase() !== checkoutOrderId.toLowerCase();

  return {
    checkoutExternalReference,
    checkoutId: getString(checkout, "id"),
    hasConflictingExternalReferences: hasConflictingOrderIds,
    localOrderId: hasConflictingOrderIds
      ? null
      : (paymentOrderId ?? checkoutOrderId ?? null),
    paymentCheckoutSession: getString(payment, "checkoutSession"),
    paymentExternalReference,
    paymentId: getString(payment, "id"),
    ...(paymentInstallmentId ? { paymentInstallmentId } : {}),
  };
};

type FinancialUpdates = AsaasFinancialEventDecision["updates"];

interface ParsedPaymentEvent {
  billingType: string | null;
  event: string;
  netValueInCents: number | null;
  paymentStatus: string;
  valueInCents: number | null;
}

export interface QueriedAsaasPaymentEvidence {
  billingType: string;
  checkoutSession: string | null;
  externalReference: string | null;
  installmentId: string | null;
  netValueInCents: number;
  paymentId: string;
  status: string;
  valueInCents: number;
}

const getCheckoutStatus = (
  event: string
): AsaasFinancialOrderSnapshot["checkoutStatus"] | null => {
  if (event === "CHECKOUT_CREATED") {
    return "active";
  }
  if (event === "CHECKOUT_CANCELED") {
    return "cancelled";
  }
  if (event === "CHECKOUT_EXPIRED") {
    return "expired";
  }
  return null;
};

const getCheckoutReviewReason = ({
  hasTerminalConflict,
  isContradictoryAfterTerminal,
}: {
  hasTerminalConflict: boolean;
  isContradictoryAfterTerminal: boolean;
}): AsaasFinancialReviewReason | null => {
  if (hasTerminalConflict) {
    return "terminal_conflict";
  }
  if (isContradictoryAfterTerminal) {
    return "event_anomaly";
  }
  return null;
};

const decideCheckoutEvent = ({
  checkoutStatus,
  correlation,
  event,
  snapshot,
}: {
  checkoutStatus: string;
  correlation: AsaasFinancialCorrelation;
  event: string;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const canonicalCheckoutStatus = getCheckoutStatus(event);
  const currentIsTerminal =
    snapshot.checkoutStatus === "cancelled" ||
    snapshot.checkoutStatus === "expired";
  const incomingIsTerminal =
    canonicalCheckoutStatus === "cancelled" ||
    canonicalCheckoutStatus === "expired";
  const isContradictoryAfterTerminal =
    currentIsTerminal &&
    (event === "CHECKOUT_CREATED" || event === "CHECKOUT_PAID");
  const hasTerminalConflict =
    currentIsTerminal &&
    incomingIsTerminal &&
    canonicalCheckoutStatus !== snapshot.checkoutStatus;
  const shouldCancelOrder =
    snapshot.orderStatus === "pending" &&
    (event === "CHECKOUT_CANCELED" || event === "CHECKOUT_EXPIRED");
  const updates: FinancialUpdates = {
    providerCheckoutStatus: checkoutStatus,
  };
  if (
    canonicalCheckoutStatus &&
    !(isContradictoryAfterTerminal || hasTerminalConflict)
  ) {
    updates.checkoutStatus = canonicalCheckoutStatus;
  }
  if (shouldCancelOrder) {
    updates.orderStatus = "cancelled";
  }

  return {
    action: "apply",
    alertReason: null,
    correlation,
    effect: "none",
    reviewReason: getCheckoutReviewReason({
      hasTerminalConflict,
      isContradictoryAfterTerminal,
    }),
    updates,
  };
};

const getAmountReview = ({
  expectedAmountInCents,
  valueInCents,
}: {
  expectedAmountInCents: number | null;
  valueInCents: number | null;
}): AsaasFinancialReviewReason | null => {
  if (valueInCents === null) {
    return "event_anomaly";
  }
  if (expectedAmountInCents !== valueInCents) {
    return "amount_mismatch";
  }
  return null;
};

const getPaymentUpdates = ({
  billingType,
  netValueInCents,
  paymentStatus,
  valueInCents,
}: Pick<
  ParsedPaymentEvent,
  "billingType" | "netValueInCents" | "paymentStatus" | "valueInCents"
>): FinancialUpdates => {
  const updates: FinancialUpdates = {
    providerPaymentStatus: paymentStatus,
  };
  if (billingType) {
    updates.paymentMethod = billingType;
  }
  if (
    netValueInCents !== null &&
    valueInCents !== null &&
    netValueInCents >= 0 &&
    netValueInCents <= valueInCents
  ) {
    updates.netAmountInCents = netValueInCents;
    updates.feeAmountInCents = valueInCents - netValueInCents;
  }
  return updates;
};

export const getAsaasProviderPaymentTransition = ({
  currentStatus,
  incomingStatus,
  isAdverseEvent = false,
  orderStatus,
}: {
  currentStatus: string | null;
  incomingStatus: string;
  isAdverseEvent?: boolean;
  orderStatus: AsaasFinancialOrderSnapshot["orderStatus"];
}): { isRegression: boolean; shouldUpdate: boolean } => {
  if (currentStatus === incomingStatus) {
    return { isRegression: false, shouldUpdate: false };
  }
  if (currentStatus === "CONFIRMED" && incomingStatus === "RECEIVED") {
    return { isRegression: false, shouldUpdate: true };
  }
  if (
    isAdverseEvent &&
    !["CONFIRMED", "DELETED", "OVERDUE", "PENDING"].includes(incomingStatus)
  ) {
    return { isRegression: false, shouldUpdate: true };
  }
  const preservesAuthoritativePayment =
    currentStatus === "CONFIRMED" ||
    currentStatus === "RECEIVED" ||
    orderStatus !== "pending";
  return preservesAuthoritativePayment
    ? { isRegression: true, shouldUpdate: false }
    : { isRegression: false, shouldUpdate: true };
};

const getRegularPaymentEvidence = ({
  isAdverseEvent = false,
  payment,
  snapshot,
}: {
  isAdverseEvent?: boolean;
  payment: ParsedPaymentEvent;
  snapshot: AsaasFinancialOrderSnapshot;
}): { isRegression: boolean; updates: FinancialUpdates } => {
  const transition = getAsaasProviderPaymentTransition({
    currentStatus: snapshot.providerPaymentStatus,
    incomingStatus: payment.paymentStatus,
    isAdverseEvent,
    orderStatus: snapshot.orderStatus,
  });
  const updates: FinancialUpdates = transition.shouldUpdate
    ? getPaymentUpdates(payment)
    : {
        ...(payment.billingType ? { paymentMethod: payment.billingType } : {}),
      };
  if (
    payment.event === "PAYMENT_RECEIVED" &&
    payment.billingType === "CREDIT_CARD"
  ) {
    updates.providerSettlementStatus = payment.paymentStatus;
  }
  const isLegacyRegression =
    snapshot.orderStatus === "paid" &&
    (payment.event === "PAYMENT_DELETED" ||
      payment.event === "PAYMENT_OVERDUE");
  return {
    isRegression: isLegacyRegression || transition.isRegression,
    updates,
  };
};

const getAdverseStatus = (event: string): "disputed" | "refunded" | null => {
  if (event === "PAYMENT_REFUNDED") {
    return "refunded";
  }
  if (disputeEvents.has(event)) {
    return "disputed";
  }
  return null;
};

const decideAdversePayment = ({
  adverseStatus,
  amountReview,
  correlation,
  payment,
  snapshot,
}: {
  adverseStatus: "disputed" | "refunded";
  amountReview: AsaasFinancialReviewReason | null;
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const hasTerminalConflict =
    adverseOrderStatuses.has(snapshot.orderStatus) &&
    snapshot.orderStatus !== adverseStatus;
  const shouldTransition =
    !hasTerminalConflict && snapshot.orderStatus !== adverseStatus;
  const paymentEvidence = getRegularPaymentEvidence({
    isAdverseEvent: true,
    payment,
    snapshot,
  });
  const updates = paymentEvidence.updates;
  if (shouldTransition) {
    updates.orderStatus = adverseStatus;
  }
  if (adverseStatus === "refunded") {
    updates.providerRefundStatus = payment.paymentStatus;
  } else {
    updates.providerDisputeStatus = payment.paymentStatus;
  }

  return {
    action: "apply",
    alertReason: null,
    correlation,
    effect: "revoke",
    reviewReason: hasTerminalConflict
      ? "terminal_conflict"
      : (amountReview ??
        (paymentEvidence.isRegression ? "event_anomaly" : null)),
    updates,
  };
};

const decidePartialRefund = ({
  amountReview,
  correlation,
  payment,
}: {
  amountReview: AsaasFinancialReviewReason | null;
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
}): AsaasFinancialEventDecision => ({
  action: "apply",
  alertReason: amountReview === "event_anomaly" ? "event_anomaly" : null,
  correlation,
  effect: "none",
  reviewReason: "partial_refund",
  updates: {
    ...getPaymentUpdates(payment),
    providerRefundStatus: payment.paymentStatus,
  },
});

const decideCaptureRefused = ({
  correlation,
  payment,
  snapshot,
}: {
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => ({
  action: "apply",
  alertReason: "event_anomaly",
  correlation,
  effect: "none",
  reviewReason: "event_anomaly",
  updates: {
    ...(payment.billingType ? { paymentMethod: payment.billingType } : {}),
    ...(snapshot.orderStatus === "pending" &&
    snapshot.providerPaymentStatus === null
      ? { providerPaymentStatus: payment.paymentStatus }
      : {}),
  },
});

type KnownCardRiskStatus =
  | "APPROVED_BY_RISK_ANALYSIS"
  | "AWAITING_RISK_ANALYSIS"
  | "REPROVED_BY_RISK_ANALYSIS";

const getKnownCardRiskStatus = (event: string): KnownCardRiskStatus => {
  if (event === "PAYMENT_APPROVED_BY_RISK_ANALYSIS") {
    return "APPROVED_BY_RISK_ANALYSIS";
  }
  if (event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
    return "REPROVED_BY_RISK_ANALYSIS";
  }
  return "AWAITING_RISK_ANALYSIS";
};

const getRiskTransition = ({
  currentStatus,
  incomingStatus,
}: {
  currentStatus: string | null;
  incomingStatus: KnownCardRiskStatus;
}): {
  effectiveStatus: string;
  hasTerminalConflict: boolean;
  isTransientRegression: boolean;
  shouldUpdate: boolean;
} => {
  const currentIsTerminal =
    currentStatus !== null && terminalCardRiskStatuses.has(currentStatus);
  const incomingIsTerminal = terminalCardRiskStatuses.has(incomingStatus);
  const hasTerminalConflict =
    currentIsTerminal && incomingIsTerminal && currentStatus !== incomingStatus;
  const isTransientRegression =
    currentIsTerminal && incomingStatus === "AWAITING_RISK_ANALYSIS";
  const shouldPreserveCurrent =
    hasTerminalConflict ||
    isTransientRegression ||
    currentStatus === incomingStatus;

  return {
    effectiveStatus:
      shouldPreserveCurrent && currentStatus ? currentStatus : incomingStatus,
    hasTerminalConflict,
    isTransientRegression,
    shouldUpdate: !shouldPreserveCurrent,
  };
};

const decideRiskEvent = ({
  amountReview,
  correlation,
  payment,
  snapshot,
}: {
  amountReview: AsaasFinancialReviewReason | null;
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const incomingRiskStatus = getKnownCardRiskStatus(payment.event);
  const riskTransition = getRiskTransition({
    currentStatus: snapshot.providerRiskStatus,
    incomingStatus: incomingRiskStatus,
  });
  const isRegressionAfterPayment =
    snapshot.orderStatus === "paid" &&
    blockingCardRiskStatuses.has(incomingRiskStatus);
  const shouldGrant =
    incomingRiskStatus === "APPROVED_BY_RISK_ANALYSIS" &&
    riskTransition.effectiveStatus === "APPROVED_BY_RISK_ANALYSIS" &&
    !riskTransition.hasTerminalConflict &&
    payment.billingType === "CREDIT_CARD" &&
    snapshot.providerPaymentStatus === "CONFIRMED" &&
    snapshot.orderStatus === "pending" &&
    !amountReview &&
    payment.valueInCents !== null;
  const updates: FinancialUpdates = {};
  if (riskTransition.shouldUpdate) {
    updates.providerRiskStatus = incomingRiskStatus;
  }
  if (payment.billingType) {
    updates.paymentMethod = payment.billingType;
  }
  if (shouldGrant && payment.valueInCents !== null) {
    updates.orderStatus = "paid";
    updates.paidAmountInCents = payment.valueInCents;
  }
  let reviewReason = amountReview;
  if (isRegressionAfterPayment || riskTransition.isTransientRegression) {
    reviewReason = "event_anomaly";
  }
  if (riskTransition.hasTerminalConflict) {
    reviewReason = "terminal_conflict";
  }

  return {
    action: "apply",
    alertReason: null,
    correlation,
    effect: shouldGrant ? "grant" : "none",
    reviewReason,
    updates,
  };
};

const decideRefundEvidence = ({
  amountReview,
  correlation,
  payment,
}: {
  amountReview: AsaasFinancialReviewReason | null;
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
}): AsaasFinancialEventDecision => ({
  action: "apply",
  alertReason: amountReview === "event_anomaly" ? "event_anomaly" : null,
  correlation,
  effect: "none",
  reviewReason: amountReview,
  updates: {
    ...(payment.billingType ? { paymentMethod: payment.billingType } : {}),
    providerRefundStatus: payment.paymentStatus,
  },
});

const getPaidReview = ({
  amountReview,
  hasReprovedRiskStatus,
  hasTerminalConflict,
  isRegressiveAfterPayment,
  unsupportedAuthorityMethod,
}: {
  amountReview: AsaasFinancialReviewReason | null;
  hasReprovedRiskStatus: boolean;
  hasTerminalConflict: boolean;
  isRegressiveAfterPayment: boolean;
  unsupportedAuthorityMethod: boolean;
}): AsaasFinancialReviewReason | null => {
  if (hasTerminalConflict) {
    return "terminal_conflict";
  }
  if (
    hasReprovedRiskStatus ||
    unsupportedAuthorityMethod ||
    isRegressiveAfterPayment
  ) {
    return "event_anomaly";
  }
  return amountReview;
};

const decideRegularPayment = ({
  amountReview,
  correlation,
  payment,
  snapshot,
}: {
  amountReview: AsaasFinancialReviewReason | null;
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const { billingType, event, valueInCents } = payment;
  const isPaidAuthority =
    (event === "PAYMENT_RECEIVED" && billingType === "PIX") ||
    (event === "PAYMENT_CONFIRMED" && billingType === "CREDIT_CARD");
  const hasTerminalConflict =
    isPaidAuthority && adverseOrderStatuses.has(snapshot.orderStatus);
  const hasBlockingRiskStatus =
    event === "PAYMENT_CONFIRMED" &&
    billingType === "CREDIT_CARD" &&
    blockingCardRiskStatuses.has(snapshot.providerRiskStatus ?? "");
  const hasReprovedRiskStatus =
    event === "PAYMENT_CONFIRMED" &&
    billingType === "CREDIT_CARD" &&
    snapshot.providerRiskStatus === "REPROVED_BY_RISK_ANALYSIS";
  const isAuthorityEvent =
    event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED";
  const isSupportedMethod =
    billingType === "PIX" || billingType === "CREDIT_CARD";
  const unsupportedAuthorityMethod = isAuthorityEvent && !isSupportedMethod;
  const shouldGrant =
    isPaidAuthority &&
    !hasTerminalConflict &&
    !hasBlockingRiskStatus &&
    !amountReview &&
    snapshot.orderStatus !== "paid";
  const paymentEvidence = getRegularPaymentEvidence({ payment, snapshot });
  const updates = paymentEvidence.updates;
  if (shouldGrant && valueInCents !== null) {
    updates.orderStatus = "paid";
    updates.paidAmountInCents = valueInCents;
  }

  return {
    action: "apply",
    alertReason: unsupportedAuthorityMethod ? "event_anomaly" : null,
    correlation,
    effect: shouldGrant ? "grant" : "none",
    reviewReason: getPaidReview({
      amountReview,
      hasReprovedRiskStatus,
      hasTerminalConflict,
      isRegressiveAfterPayment: paymentEvidence.isRegression,
      unsupportedAuthorityMethod,
    }),
    updates,
  };
};

const decideParsedPaymentEvent = ({
  correlation,
  payment,
  snapshot,
}: {
  correlation: AsaasFinancialCorrelation;
  payment: ParsedPaymentEvent;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const { event } = payment;
  if (event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") {
    return decideCaptureRefused({ correlation, payment, snapshot });
  }
  const amountReview = getAmountReview({
    expectedAmountInCents: snapshot.amountInCents,
    valueInCents: payment.valueInCents,
  });

  if (event === "PAYMENT_PARTIALLY_REFUNDED") {
    return decidePartialRefund({ amountReview, correlation, payment });
  }
  if (refundEvidenceEvents.has(event)) {
    return decideRefundEvidence({ amountReview, correlation, payment });
  }
  const adverseStatus = getAdverseStatus(event);
  if (adverseStatus) {
    return decideAdversePayment({
      adverseStatus,
      amountReview,
      correlation,
      payment,
      snapshot,
    });
  }
  if (riskEvents.has(event)) {
    return decideRiskEvent({ amountReview, correlation, payment, snapshot });
  }
  return decideRegularPayment({
    amountReview,
    correlation,
    payment,
    snapshot,
  });
};

const decidePaymentEvent = ({
  correlation,
  event,
  paymentRecord,
  snapshot,
}: {
  correlation: AsaasFinancialCorrelation;
  event: string;
  paymentRecord: Record<string, unknown> | null;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const paymentId = getString(paymentRecord, "id");
  const paymentStatus = getString(paymentRecord, "status");
  if (!(paymentRecord && paymentId && paymentStatus)) {
    return {
      action: "apply",
      alertReason: "event_anomaly",
      correlation,
      effect: "none",
      reviewReason: "event_anomaly",
      updates: {},
    };
  }

  const payment: ParsedPaymentEvent = {
    billingType: getString(paymentRecord, "billingType"),
    event,
    netValueInCents: parseAsaasDecimalToCents(paymentRecord.netValue),
    paymentStatus,
    valueInCents: parseAsaasDecimalToCents(paymentRecord.value),
  };
  return decideParsedPaymentEvent({ correlation, payment, snapshot });
};

const getQueriedPaymentEvent = (
  evidence: QueriedAsaasPaymentEvidence
): string => {
  if (evidence.status === "REFUNDED") {
    return "PAYMENT_REFUNDED";
  }
  if (
    evidence.billingType === "CREDIT_CARD" &&
    evidence.status === "RECEIVED"
  ) {
    return "PAYMENT_CONFIRMED";
  }
  if (evidence.status === "RECEIVED") {
    return "PAYMENT_RECEIVED";
  }
  if (evidence.status === "CONFIRMED") {
    return "PAYMENT_CONFIRMED";
  }
  if (evidence.status === "OVERDUE") {
    return "PAYMENT_OVERDUE";
  }
  if (evidence.status === "DELETED") {
    return "PAYMENT_DELETED";
  }
  return "PAYMENT_RECONCILED";
};

export const decideQueriedAsaasPayment = ({
  evidence,
  snapshot,
}: {
  evidence: QueriedAsaasPaymentEvidence;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision =>
  decideParsedPaymentEvent({
    correlation: {
      checkoutExternalReference: null,
      checkoutId: null,
      hasConflictingExternalReferences: false,
      localOrderId: null,
      paymentCheckoutSession: evidence.checkoutSession,
      paymentExternalReference: evidence.externalReference,
      paymentId: evidence.paymentId,
      ...(evidence.installmentId
        ? { paymentInstallmentId: evidence.installmentId }
        : {}),
    },
    payment: {
      billingType: evidence.billingType,
      event: getQueriedPaymentEvent(evidence),
      netValueInCents: evidence.netValueInCents,
      paymentStatus: evidence.status,
      valueInCents: evidence.valueInCents,
    },
    snapshot,
  });

export const decideAsaasFinancialEvent = ({
  payload,
  snapshot,
}: {
  payload: unknown;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const record = isRecord(payload) ? payload : {};
  const event = getString(record, "event");
  const correlation = getFinancialCorrelation(record);
  const checkout = isRecord(record.checkout) ? record.checkout : null;
  const checkoutStatus = getString(checkout, "status");

  if (correlation.hasConflictingExternalReferences) {
    return {
      action: "apply",
      alertReason: "event_anomaly",
      correlation,
      effect: "none",
      reviewReason: "event_anomaly",
      updates: {},
    };
  }

  if (event && knownCheckoutWebhookEvents.has(event) && checkoutStatus) {
    return decideCheckoutEvent({
      checkoutStatus,
      correlation,
      event,
      snapshot,
    });
  }
  if (event && knownPaymentWebhookEvents.has(event)) {
    const paymentRecord = isRecord(record.payment) ? record.payment : null;
    return decidePaymentEvent({
      correlation,
      event,
      paymentRecord,
      snapshot,
    });
  }
  return {
    action: "ignore",
    alertReason: "unknown_event",
    correlation,
    effect: "none",
    reviewReason: null,
    updates: {},
  };
};

export const decideAsaasAdverseEventWithoutInstallment = ({
  payload,
  snapshot,
}: {
  payload: unknown;
  snapshot: AsaasFinancialOrderSnapshot;
}): AsaasFinancialEventDecision => {
  const decision = decideAsaasFinancialEvent({ payload, snapshot });
  if (
    decision.effect !== "revoke" ||
    !decision.correlation.paymentInstallmentId
  ) {
    return {
      ...decision,
      effect: "none",
      reviewReason: "event_anomaly",
      updates: {},
    };
  }

  return {
    ...decision,
    alertReason: "event_anomaly",
    reviewReason: null,
    updates: {
      ...(decision.updates.paymentMethod
        ? { paymentMethod: decision.updates.paymentMethod }
        : {}),
      ...(decision.updates.providerDisputeStatus
        ? { providerDisputeStatus: decision.updates.providerDisputeStatus }
        : {}),
      ...(decision.updates.providerRefundStatus
        ? { providerRefundStatus: decision.updates.providerRefundStatus }
        : {}),
    },
  };
};

const parseWebhookSubject = (
  value: unknown,
  kind: "checkout" | "payment"
): AsaasWebhookEnvelope["subject"] | null => {
  if (
    !(
      isRecord(value) &&
      isNonEmptyString(value.id) &&
      isNonEmptyString(value.status)
    )
  ) {
    return null;
  }

  return {
    id: value.id,
    kind,
    status: value.status,
  };
};

const isStructurallyValidKnownPayment = (value: unknown): boolean =>
  isRecord(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.status) &&
  isNonEmptyString(value.billingType) &&
  parseAsaasDecimalToCents(value.value) !== null;

const unknownWebhookSubject = {
  id: null,
  kind: "unknown",
  status: null,
} as const;

const parsePaymentEventSubject = (
  event: string,
  value: unknown
): AsaasWebhookEnvelope["subject"] | null => {
  if (knownPaymentWebhookEvents.has(event)) {
    return isStructurallyValidKnownPayment(value)
      ? parseWebhookSubject(value, "payment")
      : null;
  }
  return parseWebhookSubject(value, "payment") ?? unknownWebhookSubject;
};

const parseCheckoutEventSubject = (
  event: string,
  value: unknown
): AsaasWebhookEnvelope["subject"] | null => {
  const subject = parseWebhookSubject(value, "checkout");
  if (subject) {
    return subject;
  }
  return knownCheckoutWebhookEvents.has(event) ? null : unknownWebhookSubject;
};

export const parseAsaasWebhookEnvelope = (
  value: unknown
): AsaasWebhookEnvelope | null => {
  if (
    !(
      isRecord(value) &&
      isNonEmptyString(value.id) &&
      isNonEmptyString(value.event)
    )
  ) {
    return null;
  }

  let subject: AsaasWebhookEnvelope["subject"] | null = unknownWebhookSubject;

  if (value.event.startsWith("PAYMENT_")) {
    subject = parsePaymentEventSubject(value.event, value.payment);
  } else if (value.event.startsWith("CHECKOUT_")) {
    subject = parseCheckoutEventSubject(value.event, value.checkout);
  }
  if (!subject) {
    return null;
  }

  return {
    dateCreated: isNonEmptyString(value.dateCreated) ? value.dateCreated : null,
    event: value.event,
    key: value.id,
    subject,
  };
};
