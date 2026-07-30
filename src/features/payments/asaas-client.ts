import {
  ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS,
  type AsaasCheckout,
  type AsaasFinancialTransaction,
  type AsaasFinancialTransactionPage,
  type AsaasGateway,
  type AsaasPayment,
  type AsaasPaymentPage,
  type AsaasRefundEvidence,
  type CreateAsaasCheckout,
  type ListAsaasFinancialTransactions,
  type ListAsaasPayments,
  type RefundAsaasPayment,
} from "./asaas";
import {
  parseAsaasDecimalToCents,
  parseSignedAsaasDecimalToCents,
} from "./asaas-money";

export const DEFAULT_ASAAS_TIMEOUT_MS = 10_000;

export type AsaasGatewayErrorKind =
  | "auth"
  | "forbidden"
  | "invalid_response"
  | "not_found"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "transport"
  | "validation";

export type AsaasMutationOutcome = "rejected" | "unknown";

interface AsaasGatewayErrorOptions {
  httpStatus?: number | undefined;
  kind: AsaasGatewayErrorKind;
  message: string;
  outcome: AsaasMutationOutcome;
  providerCode?: string | undefined;
  retryAfterMs?: number | undefined;
  retryable: boolean;
}

export class AsaasGatewayError extends Error {
  readonly httpStatus: number | undefined;
  readonly kind: AsaasGatewayErrorKind;
  readonly outcome: AsaasMutationOutcome;
  readonly providerCode: string | undefined;
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined;

  constructor({
    httpStatus,
    kind,
    message,
    outcome,
    providerCode,
    retryable,
    retryAfterMs,
  }: AsaasGatewayErrorOptions) {
    super(message);
    this.name = "AsaasGatewayError";
    this.httpStatus = httpStatus;
    this.kind = kind;
    this.outcome = outcome;
    this.providerCode = providerCode;
    this.retryable = outcome === "unknown" ? false : retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

interface AsaasClientOptions {
  accessToken: string;
  baseUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  userAgent: string;
}

type RequestKind = "query" | "mutation";

interface AsaasErrorPayload {
  errors?: Array<{
    code?: unknown;
  }>;
}

const MAX_CHECKOUT_EXPIRATION_MINUTES = 1440;
const MIN_CHECKOUT_EXPIRATION_MINUTES = 10;
const MAX_CHECKOUT_ITEM_DESCRIPTION_LENGTH = 150;
const MAX_CHECKOUT_ITEM_NAME_LENGTH = 30;
const MAX_PAYMENT_PAGE_SIZE = 100;
const INVALID_RESPONSE_MESSAGE = "Resposta de sucesso invalida do Asaas.";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JSON_DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
const SAFE_PROVIDER_CODE_RE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const TRAILING_SLASHES_RE = /\/+$/;

const trimTrailingSlash = (value: string): string =>
  value.replace(TRAILING_SLASHES_RE, "");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getOptionalString = (value: unknown): string | undefined =>
  isNonEmptyString(value) ? value : undefined;

const getNullableString = (value: unknown): string | null =>
  isNonEmptyString(value) ? value : null;

const createValidationError = (message: string): AsaasGatewayError =>
  new AsaasGatewayError({
    kind: "validation",
    message,
    outcome: "rejected",
    retryable: false,
  });

const parseJsonDecimalInCents = (serializedDecimal: string): bigint | null => {
  const match = JSON_DECIMAL_RE.exec(serializedDecimal);
  const integer = match?.[2];
  if (!integer) {
    return null;
  }

  const sign = match[1] ?? "";
  const fraction = match[3] ?? "";
  const digits = `${integer}${fraction}`;
  const scientificExponent = Number.parseInt(match[4] ?? "0", 10);
  const centsExponent = scientificExponent - fraction.length + 2;
  const unsignedValue = BigInt(digits);
  let valueInCents: bigint;

  if (centsExponent >= 0) {
    valueInCents = unsignedValue * BigInt(10) ** BigInt(centsExponent);
  } else {
    const divisor = BigInt(10) ** BigInt(-centsExponent);
    if (unsignedValue % divisor !== BigInt(0)) {
      return null;
    }
    valueInCents = unsignedValue / divisor;
  }

  return sign === "-" ? -valueInCents : valueInCents;
};

const assertNonEmptyId = (value: string, label: string): void => {
  if (!isNonEmptyString(value)) {
    throw createValidationError(`${label} invalido.`);
  }
};

const centsToProviderDecimal = (valueInCents: number): number => {
  if (
    !Number.isSafeInteger(valueInCents) ||
    valueInCents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS
  ) {
    throw createValidationError(
      "Valor de checkout deve ser um inteiro seguro de no minimo 1000 centavos."
    );
  }

  const providerDecimal = valueInCents / 100;
  const serializedDecimal = JSON.stringify(providerDecimal);
  const roundTripInCents = parseJsonDecimalInCents(serializedDecimal);
  const binaryRoundTripInCents = Math.round(providerDecimal * 100);

  if (
    roundTripInCents !== BigInt(valueInCents) ||
    binaryRoundTripInCents !== valueInCents
  ) {
    throw createValidationError(
      "Valor de checkout nao pode ser convertido exatamente para reais."
    );
  }

  return providerDecimal;
};

const providerDecimalToCents = (value: unknown): number => {
  const cents = parseAsaasDecimalToCents(value);
  if (cents === null) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return cents;
};

const parseCheckout = (value: unknown): AsaasCheckout => {
  if (
    !(
      isRecord(value) &&
      isNonEmptyString(value.id) &&
      isNonEmptyString(value.link) &&
      isNonEmptyString(value.status)
    )
  ) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return {
    id: value.id,
    link: value.link,
    status: value.status,
  };
};

const parseRefund = (value: unknown): AsaasRefundEvidence => {
  if (
    !(
      isRecord(value) &&
      isNonEmptyString(value.dateCreated) &&
      isNonEmptyString(value.status)
    )
  ) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const endToEndIdentifier = getOptionalString(value.endToEndIdentifier);
  const transactionReceiptUrl = getOptionalString(value.transactionReceiptUrl);

  return {
    dateCreated: value.dateCreated,
    ...(endToEndIdentifier ? { endToEndIdentifier } : {}),
    status: value.status,
    ...(transactionReceiptUrl ? { transactionReceiptUrl } : {}),
    valueInCents: providerDecimalToCents(value.value),
  };
};

const parsePayment = (value: unknown): AsaasPayment => {
  if (
    !(
      isRecord(value) &&
      isNonEmptyString(value.id) &&
      isNonEmptyString(value.customer) &&
      isNonEmptyString(value.billingType) &&
      isNonEmptyString(value.status)
    )
  ) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const rawRefunds = value.refunds ?? [];
  if (!Array.isArray(rawRefunds)) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  const transactionReceiptUrl = getOptionalString(value.transactionReceiptUrl);

  return {
    billingType: value.billingType,
    checkoutSession: getNullableString(value.checkoutSession),
    customer: value.customer,
    externalReference: getNullableString(value.externalReference),
    id: value.id,
    netValueInCents: providerDecimalToCents(value.netValue),
    refunds: rawRefunds.map(parseRefund),
    status: value.status,
    ...(transactionReceiptUrl ? { transactionReceiptUrl } : {}),
    valueInCents: providerDecimalToCents(value.value),
  };
};

const parsePaymentPage = (value: unknown): AsaasPaymentPage => {
  if (
    !(isRecord(value) && Array.isArray(value.data)) ||
    typeof value.hasMore !== "boolean" ||
    !Number.isSafeInteger(value.limit) ||
    !isNonEmptyString(value.object) ||
    !Number.isSafeInteger(value.offset) ||
    !Number.isSafeInteger(value.totalCount) ||
    (value.limit as number) <= 0 ||
    (value.limit as number) > MAX_PAYMENT_PAGE_SIZE ||
    (value.offset as number) < 0 ||
    (value.totalCount as number) < 0 ||
    value.data.length > (value.limit as number) ||
    (value.hasMore && value.data.length === 0)
  ) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return {
    data: value.data.map(parsePayment),
    hasMore: value.hasMore,
    limit: value.limit as number,
    object: value.object,
    offset: value.offset as number,
    totalCount: value.totalCount as number,
  };
};

const parseFinancialTransaction = (
  value: unknown
): AsaasFinancialTransaction => {
  if (
    !(
      isRecord(value) &&
      isNonEmptyString(value.id) &&
      isNonEmptyString(value.type) &&
      isNonEmptyString(value.date)
    )
  ) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  const valueInCents = parseSignedAsaasDecimalToCents(value.value);
  if (valueInCents === null) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  return {
    date: value.date,
    id: value.id,
    type: value.type,
    valueInCents,
  };
};

const parseFinancialTransactionPage = (
  value: unknown
): AsaasFinancialTransactionPage => {
  if (
    !(isRecord(value) && Array.isArray(value.data)) ||
    typeof value.hasMore !== "boolean" ||
    !Number.isSafeInteger(value.limit) ||
    !isNonEmptyString(value.object) ||
    !Number.isSafeInteger(value.offset) ||
    !Number.isSafeInteger(value.totalCount) ||
    (value.limit as number) <= 0 ||
    (value.limit as number) > MAX_PAYMENT_PAGE_SIZE ||
    (value.offset as number) < 0 ||
    (value.totalCount as number) < 0 ||
    value.data.length > (value.limit as number) ||
    (value.hasMore && value.data.length === 0)
  ) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  return {
    data: value.data.map(parseFinancialTransaction),
    hasMore: value.hasMore,
    limit: value.limit as number,
    object: value.object,
    offset: value.offset as number,
    totalCount: value.totalCount as number,
  };
};

const getProviderCode = (
  payload: unknown,
  accessToken: string
): string | undefined => {
  if (!isRecord(payload)) {
    return;
  }

  const firstError = (payload as AsaasErrorPayload).errors?.[0];
  const code = getOptionalString(firstError?.code);

  if (
    !(code && SAFE_PROVIDER_CODE_RE.test(code)) ||
    (accessToken.length > 0 && code.includes(accessToken))
  ) {
    return;
  }

  return code;
};

const parseRetryAfter = (header: string | null): number | undefined => {
  if (!header) {
    return;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return;
  }

  return Math.max(0, date - Date.now());
};

const getHttpError = ({
  accessToken,
  payload,
  requestKind,
  response,
}: {
  accessToken: string;
  payload: unknown;
  requestKind: RequestKind;
  response: Response;
}): AsaasGatewayError => {
  const common = {
    httpStatus: response.status,
    outcome: "rejected" as const,
    providerCode: getProviderCode(payload, accessToken),
  };

  if (response.status === 400 || response.status === 422) {
    return new AsaasGatewayError({
      ...common,
      kind: "validation",
      message: "Solicitacao rejeitada pelo Asaas.",
      retryable: false,
    });
  }

  if (response.status === 401) {
    return new AsaasGatewayError({
      ...common,
      kind: "auth",
      message: "Autenticacao com Asaas rejeitada.",
      retryable: false,
    });
  }

  if (response.status === 403) {
    return new AsaasGatewayError({
      ...common,
      kind: "forbidden",
      message: "Operacao nao autorizada pelo Asaas.",
      retryable: false,
    });
  }

  if (response.status === 404) {
    return new AsaasGatewayError({
      ...common,
      kind: "not_found",
      message: "Recurso Asaas nao encontrado.",
      retryable: false,
    });
  }

  if (response.status === 429) {
    return new AsaasGatewayError({
      ...common,
      kind: "rate_limited",
      message: "Limite de requisicoes do Asaas atingido.",
      retryable: true,
      retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
    });
  }

  return new AsaasGatewayError({
    ...common,
    kind: "provider_unavailable",
    message: "Asaas temporariamente indisponivel.",
    outcome: requestKind === "mutation" ? "unknown" : "rejected",
    retryable: response.status >= 500,
  });
};

const validateCheckout = (input: CreateAsaasCheckout): void => {
  assertNonEmptyId(input.externalReference, "Referencia externa");

  if (
    !Number.isInteger(input.expirationMinutes) ||
    input.expirationMinutes < MIN_CHECKOUT_EXPIRATION_MINUTES ||
    input.expirationMinutes > MAX_CHECKOUT_EXPIRATION_MINUTES
  ) {
    throw createValidationError(
      "Expiracao do checkout deve estar entre 10 e 1440 minutos."
    );
  }

  if (
    !isNonEmptyString(input.item.name) ||
    input.item.name.length > MAX_CHECKOUT_ITEM_NAME_LENGTH
  ) {
    throw createValidationError(
      "Nome do item deve ter entre 1 e 30 caracteres."
    );
  }

  if (
    !isNonEmptyString(input.item.description) ||
    input.item.description.length > MAX_CHECKOUT_ITEM_DESCRIPTION_LENGTH
  ) {
    throw createValidationError(
      "Descricao do item deve ter entre 1 e 150 caracteres."
    );
  }

  centsToProviderDecimal(input.item.valueInCents);
};

export class AsaasClient implements AsaasGateway {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor({
    accessToken,
    baseUrl,
    fetcher = fetch,
    timeoutMs = DEFAULT_ASAAS_TIMEOUT_MS,
    userAgent,
  }: AsaasClientOptions) {
    this.accessToken = accessToken;
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
  }

  async createCheckout(input: CreateAsaasCheckout): Promise<AsaasCheckout> {
    validateCheckout(input);

    const body = {
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      callback: input.callback,
      externalReference: input.externalReference,
      items: [
        {
          description: input.item.description,
          name: input.item.name,
          quantity: 1,
          value: centsToProviderDecimal(input.item.valueInCents),
        },
      ],
      minutesToExpire: input.expirationMinutes,
    };

    return await this.request(
      "/v3/checkouts",
      { body, method: "POST" },
      "mutation",
      parseCheckout
    );
  }

  async cancelCheckout(checkoutId: string): Promise<AsaasCheckout> {
    assertNonEmptyId(checkoutId, "ID do checkout");

    return await this.request(
      `/v3/checkouts/${encodeURIComponent(checkoutId)}/cancel`,
      { method: "POST" },
      "mutation",
      parseCheckout
    );
  }

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    assertNonEmptyId(paymentId, "ID do pagamento");

    return await this.request(
      `/v3/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" },
      "query",
      parsePayment
    );
  }

  async listPayments(filters: ListAsaasPayments): Promise<AsaasPaymentPage> {
    const { checkoutSession, externalReference, limit, offset } = filters;

    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAYMENT_PAGE_SIZE)
    ) {
      throw createValidationError(
        "Limite da consulta deve estar entre 1 e 100."
      );
    }

    if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0)) {
      throw createValidationError("Offset da consulta invalido.");
    }

    const query = new URLSearchParams();
    if (checkoutSession !== undefined) {
      assertNonEmptyId(checkoutSession, "Sessao de checkout");
      query.set("checkoutSession", checkoutSession);
    }
    if (externalReference !== undefined) {
      assertNonEmptyId(externalReference, "Referencia externa");
      query.set("externalReference", externalReference);
    }
    if (offset !== undefined) {
      query.set("offset", String(offset));
    }
    if (limit !== undefined) {
      query.set("limit", String(limit));
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return await this.request(
      `/v3/payments${suffix}`,
      { method: "GET" },
      "query",
      parsePaymentPage
    );
  }

  async listFinancialTransactions(
    filters: ListAsaasFinancialTransactions
  ): Promise<AsaasFinancialTransactionPage> {
    const { finishDate, limit = 100, offset = 0, order, startDate } = filters;
    if (!(ISO_DATE_RE.test(startDate) && ISO_DATE_RE.test(finishDate))) {
      throw createValidationError("Periodo do extrato invalido.");
    }
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_PAYMENT_PAGE_SIZE
    ) {
      throw createValidationError(
        "Limite da consulta deve estar entre 1 e 100."
      );
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw createValidationError("Offset da consulta invalido.");
    }
    const query = new URLSearchParams({
      finishDate,
      limit: String(limit),
      offset: String(offset),
      startDate,
    });
    if (order) {
      query.set("order", order);
    }
    return await this.request(
      `/v3/financialTransactions?${query.toString()}`,
      { method: "GET" },
      "query",
      parseFinancialTransactionPage
    );
  }

  async refundPayment(input: RefundAsaasPayment): Promise<AsaasPayment> {
    assertNonEmptyId(input.paymentId, "ID do pagamento");
    if (!isNonEmptyString(input.description)) {
      throw createValidationError("Descricao do reembolso invalida.");
    }

    return await this.request(
      `/v3/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        body: { description: input.description },
        method: "POST",
      },
      "mutation",
      parsePayment
    );
  }

  private async request<T>(
    path: string,
    request: { body?: unknown; method: "GET" | "POST" },
    requestKind: RequestKind,
    parseSuccess: (payload: unknown) => T
  ): Promise<T> {
    const controller = new AbortController();
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const hasBody = request.body !== undefined;
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
        headers: {
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          "User-Agent": this.userAgent,
          access_token: this.accessToken,
        },
        method: request.method,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const error = getHttpError({
          accessToken: this.accessToken,
          payload,
          requestKind,
          response,
        });
        throw error;
      }

      if (payload === null) {
        throw new AsaasGatewayError({
          kind: "invalid_response",
          message: INVALID_RESPONSE_MESSAGE,
          outcome: requestKind === "mutation" ? "unknown" : "rejected",
          retryable: true,
        });
      }

      try {
        return parseSuccess(payload);
      } catch {
        throw new AsaasGatewayError({
          kind: "invalid_response",
          message: INVALID_RESPONSE_MESSAGE,
          outcome: requestKind === "mutation" ? "unknown" : "rejected",
          retryable: true,
        });
      }
    } catch (error) {
      if (error instanceof AsaasGatewayError) {
        throw error;
      }

      throw new AsaasGatewayError({
        kind: didTimeout ? "timeout" : "transport",
        message: didTimeout
          ? "Tempo limite da comunicacao com Asaas excedido."
          : "Falha de transporte na comunicacao com Asaas.",
        outcome: requestKind === "mutation" ? "unknown" : "rejected",
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
