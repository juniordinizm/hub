import "server-only";
import type {
  AbacatePayCheckoutRequest,
  AbacatePayProductRequest,
} from "@/features/payments/abacatepay";

interface AbacatePayClientOptions {
  apiKey: string;
  baseUrl: string;
  fetcher?: typeof fetch;
}

interface AbacatePayApiResponse<T> {
  data?: T | null;
  error?: { message?: string } | null;
  success?: boolean;
}

interface ProductResponse {
  id: string;
}

interface CheckoutResponse {
  id: string;
  url: string;
}

interface RefundResponse {
  refundPublicId: string;
}

const TRAILING_SLASH_RE = /\/+$/;

const trimTrailingSlash = (value: string): string =>
  value.replace(TRAILING_SLASH_RE, "");

const getApiErrorMessage = (payload: unknown): string | null => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    const error = (payload as { error: string }).error.trim();
    return error.length > 0 ? error : null;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "object" &&
    (payload as { error?: unknown }).error !== null
  ) {
    const message = (payload as { error: { message?: unknown } }).error.message;
    return typeof message === "string" && message.trim() ? message : null;
  }

  return null;
};

export class AbacatePayClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor({ apiKey, baseUrl, fetcher = fetch }: AbacatePayClientOptions) {
    this.apiKey = apiKey;
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.fetcher = fetcher;
  }

  async createProduct(
    input: AbacatePayProductRequest
  ): Promise<ProductResponse> {
    const response = await this.post<AbacatePayProductRequest, ProductResponse>(
      "/products/create",
      input
    );

    if (!response.id) {
      throw new Error("AbacatePay nao retornou o produto criado.");
    }

    return response;
  }

  async createCheckout(
    input: AbacatePayCheckoutRequest
  ): Promise<CheckoutResponse> {
    const response = await this.post<
      AbacatePayCheckoutRequest,
      CheckoutResponse
    >("/checkouts/create", input);

    if (!(response.id && response.url)) {
      throw new Error("AbacatePay nao retornou a URL de checkout.");
    }

    return response;
  }

  async refundCheckout({
    checkoutId,
    reason,
  }: {
    checkoutId: string;
    reason: string;
  }): Promise<RefundResponse> {
    const response = await this.post<
      { id: string; reason: string },
      RefundResponse
    >("/checkouts/refund", { id: checkoutId, reason });

    if (!response.refundPublicId) {
      throw new Error("AbacatePay nao retornou o identificador do reembolso.");
    }

    return response;
  }

  private async post<TBody, TResponse>(
    path: string,
    body: TBody
  ): Promise<TResponse> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as AbacatePayApiResponse<TResponse> | null;

    if (!(response.ok && payload?.data)) {
      throw new Error(
        getApiErrorMessage(payload) ??
          `Falha na comunicacao com AbacatePay. Status HTTP ${response.status}.`
      );
    }

    return payload.data;
  }
}
