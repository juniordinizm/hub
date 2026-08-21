import { describe, expect, it, vi } from "vitest";
import {
  AsaasClient,
  AsaasGatewayError,
  DEFAULT_ASAAS_TIMEOUT_MS,
} from "./asaas-client";

const PROVIDER_SECRET_OR_PII_RE = /aluna@example|sandbox-token/;
const TRANSPORT_SECRET_OR_PII_RE = /sandbox-token|aluna@example|Motivo privado/;
const CUSTOMER_PII_RE =
  /aluna@example|Rua privada|12345678900|11999999999|01001000/;

const checkoutResponse = {
  id: "chk_123",
  link: "https://sandbox.asaas.com/checkout/chk_123",
  status: "ACTIVE",
};

const createClient = (
  fetcher: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof AsaasClient>[0]> = {}
): AsaasClient =>
  new AsaasClient({
    accessToken: "sandbox-token",
    baseUrl: "https://api-sandbox.asaas.com/",
    fetcher,
    userAgent: "Hub/1.0 payments@example.com",
    ...overrides,
  });

const validCheckout = {
  callback: {
    cancelUrl: "https://hub.test/checkout/cancelado",
    expiredUrl: "https://hub.test/checkout/expirado",
    successUrl: "https://hub.test/checkout/sucesso",
  },
  expirationMinutes: 30,
  externalReference: "order_123",
  item: {
    description: "Acesso por 12 meses",
    name: "Curso Teste",
    valueInCents: 12_990,
  },
  paymentOptions: {
    allowCreditCard: true,
    allowPix: true,
    maxInstallmentCount: 1,
  },
} as const;

describe("AsaasClient", () => {
  it("creates a detached checkout with exact headers and inline item", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(checkoutResponse));
    const client = createClient(fetcher);

    await expect(client.createCheckout(validCheckout)).resolves.toEqual(
      checkoutResponse
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/checkouts",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Hub/1.0 payments@example.com",
          access_token: "sandbox-token",
        },
        method: "POST",
      })
    );
    const requestBody = JSON.parse(
      fetcher.mock.calls[0]?.[1]?.body as string
    ) as Record<string, unknown> & {
      items: Array<{ imageBase64?: unknown }>;
    };
    expect(requestBody).toMatchObject({
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      callback: {
        successUrl: "https://hub.test/checkout/sucesso",
        cancelUrl: "https://hub.test/checkout/cancelado",
        expiredUrl: "https://hub.test/checkout/expirado",
      },
      externalReference: "order_123",
      items: [
        {
          name: "Curso Teste",
          description: "Acesso por 12 meses",
          quantity: 1,
          value: 129.9,
        },
      ],
      minutesToExpire: 30,
    });
    const imageBase64 = requestBody.items[0]?.imageBase64;
    expect(typeof imageBase64).toBe("string");
    if (typeof imageBase64 !== "string") {
      throw new Error("Checkout item image is missing.");
    }
    expect([...Buffer.from(imageBase64, "base64").subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(requestBody).not.toHaveProperty("customerData");
  });

  it("serializes the minimum value without inventing payer data", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(checkoutResponse));
    const client = createClient(fetcher);

    await client.createCheckout({
      ...validCheckout,
      item: { ...validCheckout.item, valueInCents: 1000 },
    });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      items: Array<{ value: number }>;
    };
    expect(body.items[0]?.value).toBe(10);
    expect(body).not.toHaveProperty("customerData");
    expect(body).not.toHaveProperty("cpfCnpj");
  });

  it("creates a mixed Pix and card checkout with an installment ceiling", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(checkoutResponse));

    await createClient(fetcher).createCheckout({
      ...validCheckout,
      paymentOptions: {
        allowCreditCard: true,
        allowPix: true,
        maxInstallmentCount: 3,
      },
    });

    expect(
      JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)
    ).toMatchObject({
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED", "INSTALLMENT"],
      installment: { maxInstallmentCount: 3 },
    });
  });

  it.each([
    999,
    1000.5,
    9_007_199_254_740_990,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1,
    0,
    -100,
  ])("rejects invalid checkout cents %s before fetch", async (valueInCents) => {
    const fetcher = vi.fn();
    const client = createClient(fetcher);

    await expect(
      client.createCheckout({
        ...validCheckout,
        item: { ...validCheckout.item, valueInCents },
      })
    ).rejects.toMatchObject({
      kind: "validation",
      outcome: "rejected",
      retryable: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves unknown checkout statuses as provider data", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...checkoutResponse, status: "FUTURE_STATUS" })
      );

    await expect(
      createClient(fetcher).createCheckout(validCheckout)
    ).resolves.toMatchObject({ status: "FUTURE_STATUS" });
  });

  it("cancels a checkout with an encoded path", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(checkoutResponse));

    await expect(
      createClient(fetcher).cancelCheckout("chk/with space")
    ).resolves.toEqual(checkoutResponse);

    expect(fetcher).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/checkouts/chk%2Fwith%20space/cancel",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });

  it("gets only the safe customer identity without sending a body", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        address: "Rua privada",
        cpfCnpj: "12345678900",
        email: "aluna@example.com",
        id: "cus_123",
        mobilePhone: "11999999999",
        name: "Aluna Teste",
        phone: "1133333333",
        postalCode: "01001000",
      })
    );

    await expect(createClient(fetcher).getCustomer("cus_123")).resolves.toEqual(
      {
        email: "aluna@example.com",
        id: "cus_123",
        name: "Aluna Teste",
      }
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/customers/cus_123",
      expect.objectContaining({
        headers: {
          "User-Agent": "Hub/1.0 payments@example.com",
          access_token: "sandbox-token",
        },
        method: "GET",
      })
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
      "Content-Type"
    );
  });

  it("encodes the customer ID in the path", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        email: "aluna@example.com",
        id: "cus/with space",
        name: "Aluna Teste",
      })
    );

    await expect(
      createClient(fetcher).getCustomer("cus/with space")
    ).resolves.toEqual({
      email: "aluna@example.com",
      id: "cus/with space",
      name: "Aluna Teste",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/customers/cus%2Fwith%20space"
    );
  });

  it.each([
    "",
    "   ",
  ])("rejects an empty customer ID before fetch: %j", async (customerId) => {
    const fetcher = vi.fn();

    await expect(
      createClient(fetcher).getCustomer(customerId)
    ).rejects.toMatchObject({
      kind: "validation",
      outcome: "rejected",
      retryable: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing id", { email: "aluna@example.com", name: "Aluna Teste" }],
    [
      "different id",
      { email: "aluna@example.com", id: "cus_other", name: "Aluna Teste" },
    ],
    [
      "non-string id",
      { email: "aluna@example.com", id: 123, name: "Aluna Teste" },
    ],
    ["missing name", { email: "aluna@example.com", id: "cus_123" }],
    [
      "non-string name",
      { email: "aluna@example.com", id: "cus_123", name: null },
    ],
    ["empty name", { email: "aluna@example.com", id: "cus_123", name: "" }],
    [
      "whitespace name",
      { email: "aluna@example.com", id: "cus_123", name: "   " },
    ],
    ["missing email", { id: "cus_123", name: "Aluna Teste" }],
    ["non-string email", { email: null, id: "cus_123", name: "Aluna Teste" }],
    ["empty email", { email: "", id: "cus_123", name: "Aluna Teste" }],
    ["whitespace email", { email: "   ", id: "cus_123", name: "Aluna Teste" }],
  ] as const)("rejects an invalid customer response: %s", async (_label, payload) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
    const promise = createClient(fetcher).getCustomer("cus_123");

    await expect(promise).rejects.toMatchObject({
      kind: "invalid_response",
      outcome: "rejected",
      retryable: true,
    });
    await expect(promise).rejects.not.toThrow(CUSTOMER_PII_RE);
  });

  it.each([
    [401, "auth", false],
    [404, "not_found", false],
    [429, "rate_limited", true],
    [503, "provider_unavailable", true],
  ] as const)("classifies customer HTTP %s without exposing provider PII", async (status, kind, retryable) => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          errors: [
            {
              code: "customer_lookup_error",
              description: "aluna@example.com Rua privada 12345678900",
            },
          ],
        },
        { headers: { "Retry-After": "5" }, status }
      )
    );
    const promise = createClient(fetcher).getCustomer("cus_123");

    await expect(promise).rejects.toMatchObject({
      httpStatus: status,
      kind,
      outcome: "rejected",
      retryable,
    });
    await expect(promise).rejects.not.toThrow(CUSTOMER_PII_RE);
  });

  it("classifies a customer transport failure as a retryable query", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        new Error("aluna@example.com Rua privada 12345678900")
      );
    const promise = createClient(fetcher).getCustomer("cus_123");

    await expect(promise).rejects.toMatchObject({
      kind: "transport",
      outcome: "rejected",
      retryable: true,
    });
    await expect(promise).rejects.not.toThrow(CUSTOMER_PII_RE);
  });

  it("classifies a customer timeout as a retryable query", async () => {
    const fetcher = vi.fn(
      (_url, request) =>
        new Promise<Response>((_resolve, reject) => {
          request?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    await expect(
      createClient(fetcher, { timeoutMs: 1 }).getCustomer("cus_123")
    ).rejects.toMatchObject({
      kind: "timeout",
      outcome: "rejected",
      retryable: true,
    });
  });

  it("gets and normalizes a payment without sending a body", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        billingType: "FUTURE_METHOD",
        checkoutSession: "chk_123",
        customer: "cus_123",
        externalReference: "order_123",
        id: "pay_123",
        netValue: 127.4,
        refunds: [
          {
            dateCreated: "2026-07-28",
            endToEndIdentifier: "E123",
            status: "DONE",
            transactionReceiptUrl: "https://asaas.test/receipt/refund",
            value: 129.9,
          },
        ],
        status: "FUTURE_STATUS",
        transactionReceiptUrl: "https://asaas.test/receipt/payment",
        value: 129.9,
      })
    );

    await expect(
      createClient(fetcher).getPayment("pay/with space")
    ).resolves.toEqual({
      billingType: "FUTURE_METHOD",
      checkoutSession: "chk_123",
      customer: "cus_123",
      externalReference: "order_123",
      id: "pay_123",
      netValueInCents: 12_740,
      refunds: [
        {
          dateCreated: "2026-07-28",
          endToEndIdentifier: "E123",
          status: "DONE",
          transactionReceiptUrl: "https://asaas.test/receipt/refund",
          valueInCents: 12_990,
        },
      ],
      status: "FUTURE_STATUS",
      transactionReceiptUrl: "https://asaas.test/receipt/payment",
      valueInCents: 12_990,
    });
    const [url, request] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api-sandbox.asaas.com/v3/payments/pay%2Fwith%20space"
    );
    expect(request).toMatchObject({
      headers: {
        "User-Agent": "Hub/1.0 payments@example.com",
        access_token: "sandbox-token",
      },
      method: "GET",
    });
    expect(request).not.toHaveProperty("body");
    expect(request?.headers).not.toHaveProperty("Content-Type");
  });

  it("gets and normalizes an installment aggregate", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        billingType: "CREDIT_CARD",
        checkoutSession: "chk_123",
        id: "ins_123",
        installmentCount: 3,
        netValue: 285,
        paymentValue: 100,
        refunds: [],
        value: 300,
      })
    );

    await expect(
      createClient(fetcher).getInstallment("ins/123")
    ).resolves.toEqual({
      billingType: "CREDIT_CARD",
      checkoutSession: "chk_123",
      id: "ins_123",
      installmentCount: 3,
      netValueInCents: 28_500,
      paymentValueInCents: 10_000,
      refunds: [],
      valueInCents: 30_000,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/installments/ins%2F123"
    );
  });

  it("lists payments with explicit repair filters and pagination", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: [],
        hasMore: false,
        limit: 25,
        object: "list",
        offset: 50,
        totalCount: 0,
      })
    );

    await expect(
      createClient(fetcher).listPayments({
        checkoutSession: "chk/123",
        externalReference: "order with space",
        limit: 25,
        offset: 50,
      })
    ).resolves.toEqual({
      data: [],
      hasMore: false,
      limit: 25,
      object: "list",
      offset: 50,
      totalCount: 0,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/payments?checkoutSession=chk%2F123&externalReference=order+with+space&offset=50&limit=25"
    );
  });

  it("rejects list limits above the provider maximum before fetch", async () => {
    const fetcher = vi.fn();

    await expect(
      createClient(fetcher).listPayments({ limit: 101 })
    ).rejects.toMatchObject({ kind: "validation" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requests a full refund without a value and returns real refund evidence", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        billingType: "PIX",
        checkoutSession: "chk_123",
        customer: "cus_123",
        externalReference: "order_123",
        id: "pay_123",
        netValue: 0,
        refunds: [
          {
            dateCreated: "2026-07-28",
            status: "DONE",
            transactionReceiptUrl: "https://asaas.test/receipt/refund",
            value: 10,
          },
        ],
        status: "REFUNDED",
        value: 10,
      })
    );

    const result = await createClient(fetcher).refundPayment({
      description: "Solicitacao aprovada pelo suporte",
      paymentId: "pay/123",
    });

    expect(result.refunds).toEqual([
      {
        dateCreated: "2026-07-28",
        status: "DONE",
        transactionReceiptUrl: "https://asaas.test/receipt/refund",
        valueInCents: 1000,
      },
    ]);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.asaas.com/v3/payments/pay%2F123/refund"
    );
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      description: "Solicitacao aprovada pelo suporte",
    });
    expect(
      JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)
    ).not.toHaveProperty("value");
  });

  it("refunds the complete installment through its aggregate endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        billingType: "CREDIT_CARD",
        checkoutSession: "chk_123",
        id: "ins_123",
        installmentCount: 3,
        netValue: 285,
        paymentValue: 100,
        refunds: [
          {
            dateCreated: "2026-08-01",
            status: "DONE",
            value: 300,
          },
        ],
        value: 300,
      })
    );

    await expect(
      createClient(fetcher).refundInstallment({ installmentId: "ins/123" })
    ).resolves.toMatchObject({
      id: "ins_123",
      refunds: [{ status: "DONE", valueInCents: 30_000 }],
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/installments/ins%2F123/refund",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });

  it.each([
    [400, "validation", false],
    [422, "validation", false],
    [401, "auth", false],
    [403, "forbidden", false],
    [404, "not_found", false],
    [500, "provider_unavailable", false],
  ] as const)("classifies HTTP %s without exposing provider descriptions", async (status, kind, retryable) => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          errors: [
            {
              code: "provider_code",
              description: "aluna@example.com sandbox-token",
            },
          ],
        },
        { status }
      )
    );

    const promise = createClient(fetcher).createCheckout(validCheckout);
    await expect(promise).rejects.toMatchObject({
      httpStatus: status,
      kind,
      outcome: status >= 500 ? "unknown" : "rejected",
      providerCode: "provider_code",
      retryable,
    });
    await expect(promise).rejects.not.toThrow(PROVIDER_SECRET_OR_PII_RE);
  });

  it("classifies 429 and parses Retry-After seconds", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { errors: [{ code: "rate_limit", description: "slow down" }] },
          { headers: { "Retry-After": "5" }, status: 429 }
        )
      );

    await expect(
      createClient(fetcher).createCheckout(validCheckout)
    ).rejects.toMatchObject({
      kind: "rate_limited",
      outcome: "rejected",
      retryAfterMs: 5000,
      retryable: true,
    });
  });

  it.each([
    "sandbox-token",
    "prefix-sandbox-token-suffix",
    "aluna@example.com",
    "free text",
    "code\r\ninjected",
    "a".repeat(65),
  ])("does not expose an unsafe provider code: %s", async (code) => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          errors: [
            {
              code,
              description: "rejected",
            },
          ],
        },
        { status: 400 }
      )
    );

    await expect(
      createClient(fetcher).createCheckout(validCheckout)
    ).rejects.toMatchObject({ providerCode: undefined });
  });

  it("marks a GET provider outage retryable but not as an uncertain mutation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      createClient(fetcher).getPayment("pay_123")
    ).rejects.toMatchObject({
      kind: "provider_unavailable",
      outcome: "rejected",
      retryable: true,
    });
  });

  it("marks a GET transport failure retryable and rejected", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      createClient(fetcher).getPayment("pay_123")
    ).rejects.toMatchObject({
      kind: "transport",
      outcome: "rejected",
      retryable: true,
    });
  });

  it("marks transport failures during mutations unknown without leaking causes", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error("sandbox-token aluna@example.com"));

    const promise = createClient(fetcher).refundPayment({
      description: "Motivo privado",
      paymentId: "pay_123",
    });
    await expect(promise).rejects.toMatchObject({
      kind: "transport",
      outcome: "unknown",
      retryable: false,
    });
    await expect(promise).rejects.not.toThrow(TRANSPORT_SECRET_OR_PII_RE);
  });

  it("aborts at the named timeout and marks the mutation outcome unknown", async () => {
    expect(DEFAULT_ASAAS_TIMEOUT_MS).toBeGreaterThan(0);
    const fetcher = vi.fn(
      (_url, request) =>
        new Promise<Response>((_resolve, reject) => {
          request?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    await expect(
      createClient(fetcher, { timeoutMs: 1 }).createCheckout(validCheckout)
    ).rejects.toMatchObject({
      kind: "timeout",
      outcome: "unknown",
      retryable: false,
    });
  });

  it.each([
    ["invalid JSON", new Response("not-json", { status: 200 })],
    ["invalid schema", Response.json({ id: "chk_without_link" })],
  ])("treats %s success responses as an unknown mutation result", async (_label, response) => {
    const fetcher = vi.fn().mockResolvedValue(response);

    await expect(
      createClient(fetcher).createCheckout(validCheckout)
    ).rejects.toMatchObject({
      kind: "invalid_response",
      outcome: "unknown",
      retryable: false,
    });
  });

  it("rejects invalid monetary values returned by the provider", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        billingType: "PIX",
        checkoutSession: "chk_123",
        customer: "cus_123",
        externalReference: "order_123",
        id: "pay_123",
        netValue: 9.876,
        status: "RECEIVED",
        value: 10,
      })
    );

    await expect(
      createClient(fetcher).getPayment("pay_123")
    ).rejects.toMatchObject({
      kind: "invalid_response",
      outcome: "rejected",
      retryable: true,
    });
  });

  it("lists documented financial statement entries with signed cents", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            date: "2026-07-28",
            id: "ft_1",
            type: "PAYMENT_FEE",
            value: -2.99,
          },
        ],
        hasMore: false,
        limit: 100,
        object: "list",
        offset: 0,
        totalCount: 1,
      })
    );

    await expect(
      createClient(fetcher).listFinancialTransactions({
        finishDate: "2026-07-28",
        startDate: "2026-07-28",
      })
    ).resolves.toMatchObject({
      data: [
        {
          date: "2026-07-28",
          id: "ft_1",
          type: "PAYMENT_FEE",
          valueInCents: -299,
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v3/financialTransactions?finishDate=2026-07-28&limit=100&offset=0&startDate=2026-07-28"
      ),
      expect.objectContaining({ method: "GET" })
    );
  });

  it.each([
    { hasMore: true, limit: 0, offset: 0, totalCount: 1 },
    { hasMore: true, limit: 101, offset: 0, totalCount: 200 },
    { hasMore: false, limit: 100, offset: -1, totalCount: 1 },
    { hasMore: false, limit: 100, offset: 0, totalCount: -1 },
  ])("rejects invalid financial pagination metadata: $limit/$offset/$totalCount", async (metadata) => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            date: "2026-07-28",
            id: "ft_1",
            type: "PAYMENT_FEE",
            value: -2.99,
          },
        ],
        object: "list",
        ...metadata,
      })
    );

    await expect(
      createClient(fetcher).listFinancialTransactions({
        finishDate: "2026-07-28",
        startDate: "2026-07-28",
      })
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("exports a typed safe gateway error", () => {
    const error = new AsaasGatewayError({
      kind: "validation",
      message: "Solicitacao Asaas rejeitada.",
      outcome: "rejected",
      retryable: false,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("validation");

    const uncertainMutation = new AsaasGatewayError({
      kind: "timeout",
      message: "Tempo limite da comunicacao com Asaas excedido.",
      outcome: "unknown",
      retryable: true,
    });
    expect(uncertainMutation.retryable).toBe(false);
  });
});
