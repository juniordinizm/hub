import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/db";
import { AsaasGatewayError } from "./asaas-client";
import {
  CheckoutIntentError,
  createAsaasCheckoutIntent,
  createCheckoutCallbacks,
} from "./checkout";
import { FakeAsaasGateway } from "./fake-asaas-gateway";

vi.mock("@/db", () => ({
  getPool: vi.fn(),
}));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: (path: string) => `https://hub.example${path}`,
}));
vi.mock("server-only", () => ({}));

const ATTEMPT_ID = "7fb3447e-2702-48f8-abe2-6c47b091bdcb";
const COURSE_ID = "4a45d650-fc63-44c9-b2d1-6c73d52de84c";
const NOW = new Date("2026-07-29T12:00:00.000Z");
const USER_MUTATION_PATTERN = /\b(insert into|update)\s+users\b/;

const callbacks = {
  cancelUrl: "https://hub.example/checkout/cancelado",
  expiredUrl: "https://hub.example/checkout/expirado",
  successUrl: "https://hub.example/checkout/sucesso",
};

const course = {
  access_duration_months: 12,
  description:
    "Descrição extensa do curso que deve ser preservada como snapshot comercial.",
  has_published_publication: true,
  id: COURSE_ID,
  payment_allow_credit_card: true,
  payment_allow_pix: true,
  payment_max_installment_count: 3,
  price_in_cents: 10_000,
  sales_status: "open",
  slug: "formacao-neuro",
  status: "active",
  title: "Formação prática em neuroeducação",
};

const insertedOrder = {
  access_duration_months: 12,
  amount_in_cents: 10_000,
  buyer_identity_status: "resolved",
  checkout_item_description:
    "Descrição extensa do curso que deve ser preservada como snapshot comercial.",
  checkout_item_name: "Formação prática em neuroeduca",
  checkout_course_slug: "formacao-neuro",
  checkout_status: "creating",
  checkout_url: null,
  course_id: COURSE_ID,
  customer_email: "aluna@example.com",
  customer_name: "Aluna Exemplo",
  id: ATTEMPT_ID,
  payment_allow_credit_card: true,
  payment_allow_pix: true,
  payment_max_installment_count: 3,
  provider: "asaas",
  provider_checkout_status: null,
  user_id: "user-1",
};

interface QueryResult {
  rows: Record<string, unknown>[];
}

const createPool = (
  handler: (
    sql: string,
    values: unknown[] | undefined
  ) => QueryResult | Promise<QueryResult>
) => ({
  query: vi.fn(
    async (sql: string, values?: unknown[]) =>
      await handler(sql.replace(/\s+/g, " ").trim(), values)
  ),
});

const createGateway = (
  outcome:
    | {
        id: string;
        link: string;
        status: string;
      }
    | Error = {
    id: "checkout-1",
    link: "https://asaas.example/checkout-1",
    status: "FUTURE_PROVIDER_STATUS",
  }
) =>
  new FakeAsaasGateway({
    createCheckout: outcome,
  });

const authenticatedInput = (gateway: FakeAsaasGateway) => ({
  attemptId: ATTEMPT_ID,
  buyer: {
    email: " Aluna@Example.com ",
    kind: "authenticated" as const,
    name: " Aluna Exemplo ",
    userId: "user-1",
  },
  callbacks,
  courseId: COURSE_ID,
  gateway,
  now: () => NOW,
});

const providerPendingInput = (gateway: FakeAsaasGateway) => ({
  attemptId: ATTEMPT_ID,
  buyer: { kind: "provider_pending" as const },
  callbacks,
  courseId: COURSE_ID,
  gateway,
  now: () => NOW,
});

describe("createAsaasCheckoutIntent", () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
  });

  it("rejects an invalid attempt while creating checkout callbacks", () => {
    expect(() => createCheckoutCallbacks("not-a-uuid")).toThrow(
      "Tentativa de checkout inválida."
    );
  });

  it("creates attempt-aware public callbacks", () => {
    expect(createCheckoutCallbacks(ATTEMPT_ID)).toEqual({
      cancelUrl: `https://hub.example/checkout/cancelado?attemptId=${ATTEMPT_ID}`,
      expiredUrl: `https://hub.example/checkout/expirado?attemptId=${ATTEMPT_ID}`,
      successUrl: "https://hub.example/checkout/sucesso",
    });
  });

  it.each([
    ["missing domain", "buyer"],
    ["missing tld", "buyer@example"],
    ["whitespace", "buyer @example.com"],
    ["control", "buyer\n@example.com"],
    ["multiple at", "buyer@@example.com"],
    ["too long", `${"a".repeat(243)}@example.com`],
  ])("rejects malformed buyer email before DB/provider: %s", async (_case, email) => {
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        buyer: {
          ...authenticatedInput(gateway).buyer,
          email,
        },
      })
    ).rejects.toMatchObject({
      kind: "validation",
      name: "CheckoutIntentError",
    });
    expect(getPool).not.toHaveBeenCalled();
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it("rejects an excessive local buyer name before DB/provider", async () => {
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        buyer: {
          ...authenticatedInput(gateway).buyer,
          name: "A".repeat(121),
        },
      })
    ).rejects.toBeInstanceOf(CheckoutIntentError);
    expect(getPool).not.toHaveBeenCalled();
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it("authorizes only a new intent after resolving the canonical course", async () => {
    const authorizeNewIntent = vi.fn().mockResolvedValue(undefined);
    const pool = createPool((sql) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [insertedOrder] };
      }
      if (sql.startsWith("update orders")) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      return { rows: [] };
    });
    vi.mocked(getPool).mockReturnValue(
      pool as unknown as ReturnType<typeof getPool>
    );

    await createAsaasCheckoutIntent({
      ...authenticatedInput(createGateway()),
      authorizeNewIntent,
    });

    expect(authorizeNewIntent).toHaveBeenCalledOnce();
    expect(authorizeNewIntent).toHaveBeenCalledWith({ courseId: COURSE_ID });
  });

  it("deletes only the pre-provider reservation and preserves the authorization error", async () => {
    const authorizationError = new CheckoutIntentError("validation");
    const gateway = createGateway();
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        expect(sql).toContain("'pending', 'pending'");
        return { rows: [{ ...insertedOrder, checkout_status: "pending" }] };
      }
      if (sql.startsWith("delete from orders")) {
        expect(sql).toContain("provider = 'asaas'");
        expect(sql).toContain("status = 'pending'");
        expect(sql).toContain("checkout_status = 'pending'");
        expect(sql).toContain("provider_checkout_id is null");
        expect(sql).toContain("provider_payment_id is null");
        expect(sql).toContain("provider_customer_id is null");
        expect(sql).toContain("checkout_url is null");
        expect(sql).toContain("checkout_attempt_count = 0");
        expect(sql).toContain("checkout_last_attempt_at is null");
        expect(sql).toContain("checkout_next_attempt_at is null");
        expect(sql).toContain("checkout_error_message is null");
        expect(sql).toContain("provider_checkout_status is null");
        expect(sql).toContain("provider_payment_status is null");
        expect(sql).toContain("provider_risk_status is null");
        expect(sql).toContain("provider_settlement_status is null");
        expect(sql).toContain("provider_refund_status is null");
        expect(sql).toContain("provider_dispute_status is null");
        expect(sql).toContain("paid_amount_in_cents is null");
        expect(sql).toContain("payment_method is null");
        expect(sql).toContain("receipt_url is null");
        expect(sql).toContain("paid_at is null");
        expect(sql).toContain("refunded_at is null");
        expect(sql).toContain("returning id");
        expect(values).toEqual([ATTEMPT_ID]);
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);

    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        authorizeNewIntent: vi.fn().mockRejectedValue(authorizationError),
      })
    ).rejects.toBe(authorizationError);
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it("does not retain orders or buyer PII from distinct attempts rejected after the rate limit", async () => {
    const persistedOrders = new Map<
      string,
      typeof insertedOrder & { checkout_status: "pending" }
    >();
    const authorizationError = new Error("public checkout rate limited");
    const gateway = createGateway();
    const pool = createPool((sql, values) => {
      const attemptId = String(values?.[0] ?? "");
      if (sql.startsWith("select id, course_id")) {
        const existing = persistedOrders.get(attemptId);
        return { rows: existing ? [existing] : [] };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        const order = {
          ...insertedOrder,
          checkout_status: "pending" as const,
          customer_email: String(values?.[7]),
          customer_name: String(values?.[8]),
          id: attemptId,
        };
        persistedOrders.set(attemptId, order);
        return { rows: [order] };
      }
      if (sql.startsWith("delete from orders")) {
        expect(sql).toContain("checkout_attempt_count = 0");
        expect(sql).toContain("provider_checkout_id is null");
        persistedOrders.delete(attemptId);
        return { rows: [{ id: attemptId }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);

    for (let index = 1; index <= 12; index += 1) {
      const attemptId = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      await expect(
        createAsaasCheckoutIntent({
          ...authenticatedInput(gateway),
          attemptId,
          authorizeNewIntent: vi.fn().mockRejectedValue(authorizationError),
          buyer: {
            ...authenticatedInput(gateway).buyer,
            email: `limited-${index}@example.com`,
            name: `Limited Buyer ${index}`,
          },
        })
      ).rejects.toBe(authorizationError);
    }

    expect(persistedOrders.size).toBe(0);
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it("reserves one concurrent attempt before authorizing or calling the provider", async () => {
    let persistedOrder:
      | (Omit<typeof insertedOrder, "checkout_status" | "checkout_url"> & {
          checkout_status: string;
          checkout_url: string | null;
        })
      | undefined;
    let releaseAuthorization: (() => void) | undefined;
    const authorizationReleased = new Promise<void>((resolve) => {
      releaseAuthorization = resolve;
    });
    const authorizeStarted = vi.fn();
    const authorizeNewIntent = vi.fn(async () => {
      authorizeStarted();
      await authorizationReleased;
    });
    const pool = createPool((sql) => {
      if (sql.startsWith("select id, course_id")) {
        return { rows: persistedOrder ? [persistedOrder] : [] };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        if (persistedOrder) {
          return { rows: [] };
        }
        persistedOrder = {
          ...insertedOrder,
          checkout_status: "pending",
        };
        return { rows: [persistedOrder] };
      }
      if (
        sql.startsWith("update orders") &&
        sql.includes("checkout_attempt_count = checkout_attempt_count + 1")
      ) {
        if (persistedOrder?.checkout_status !== "pending") {
          return { rows: [] };
        }
        persistedOrder = { ...persistedOrder, checkout_status: "creating" };
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      if (sql.startsWith("update orders")) {
        persistedOrder = {
          ...(persistedOrder ?? insertedOrder),
          checkout_status: "active",
          checkout_url: "https://asaas.example/checkout-1",
        };
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();
    const input = {
      ...authenticatedInput(gateway),
      authorizeNewIntent,
    };

    const first = createAsaasCheckoutIntent(input);
    await vi.waitFor(() => expect(authorizeStarted).toHaveBeenCalled());
    const second = createAsaasCheckoutIntent(input);
    await Promise.resolve();
    await Promise.resolve();
    releaseAuthorization?.();

    const results = await Promise.all([first, second]);

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orderId: ATTEMPT_ID, status: "ready" }),
        { orderId: ATTEMPT_ID, status: "processing" },
      ])
    );
    expect(authorizeNewIntent).toHaveBeenCalledOnce();
    expect(gateway.calls.createCheckout).toHaveLength(1);
    expect(persistedOrder).toBeDefined();
  });

  it("persists the complete order snapshot before creating the external checkout", async () => {
    const events: string[] = [];
    const persistedSnapshot = {
      ...insertedOrder,
      amount_in_cents: 12_345,
      checkout_item_description: "Descrição devolvida pelo Pedido persistido",
      checkout_item_name: "Nome devolvido pelo Pedido",
    };
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        events.push("persisted");
        expect(sql).toContain("on conflict (id) do nothing");
        expect(sql).toContain("returning");
        expect(values).toEqual([
          ATTEMPT_ID,
          COURSE_ID,
          "user-1",
          "resolved",
          `order_${ATTEMPT_ID}`,
          10_000,
          12,
          "aluna@example.com",
          "Aluna Exemplo",
          "formacao-neuro",
          "Formação prática em neuroeduca",
          course.description,
          true,
          true,
          3,
        ]);
        return { rows: [persistedSnapshot] };
      }
      if (sql.startsWith("update orders")) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();
    const originalCreate = gateway.createCheckout.bind(gateway);
    gateway.createCheckout = vi.fn(async (input) => {
      events.push("gateway");
      return await originalCreate(input);
    });

    const result = await createAsaasCheckoutIntent(authenticatedInput(gateway));

    expect(events).toEqual(["persisted", "gateway"]);
    expect(gateway.calls.createCheckout[0]).toEqual({
      callback: callbacks,
      expirationMinutes: 60,
      externalReference: `order_${ATTEMPT_ID}`,
      item: {
        description: "Descrição devolvida pelo Pedido persistido",
        name: "Nome devolvido pelo Pedido",
        valueInCents: 12_345,
      },
      paymentOptions: {
        allowCreditCard: true,
        allowPix: true,
        maxInstallmentCount: 3,
      },
    });
    expect(result).toEqual({
      orderId: ATTEMPT_ID,
      redirectUrl: "https://asaas.example/checkout-1",
      status: "ready",
    });
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining("provider_checkout_status = $4"),
      [
        ATTEMPT_ID,
        "checkout-1",
        "https://asaas.example/checkout-1",
        "FUTURE_PROVIDER_STATUS",
      ]
    );
    expect(pool.query.mock.calls.at(-1)?.[0]).toContain("updated_at = now()");
  });

  it("snapshots the effective installment limit derived from the course price", async () => {
    const lowPriceCourse = { ...course, price_in_cents: 1990 };
    const effectiveOrder = {
      ...insertedOrder,
      amount_in_cents: 1990,
      payment_max_installment_count: 1,
    };
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [lowPriceCourse] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        expect(values?.at(-1)).toBe(1);
        return { rows: [effectiveOrder] };
      }
      if (sql.startsWith("update orders")) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await createAsaasCheckoutIntent(authenticatedInput(gateway));

    expect(gateway.calls.createCheckout[0]?.paymentOptions).toEqual({
      allowCreditCard: true,
      allowPix: true,
      maxInstallmentCount: 1,
    });
  });

  it.each([
    0, 999,
  ])("rejects price %i before persistence or gateway access", async (priceInCents) => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [{ ...course, price_in_cents: priceInCents }] };
      }
      throw new Error("Não deveria persistir.");
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).rejects.toThrow("Curso indisponível para checkout pago.");
    expect(gateway.calls.createCheckout).toHaveLength(0);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("rejects an active enrollment before persistence or provider access", async () => {
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.includes("from enrollments")) {
        expect(values).toEqual(["user-1", COURSE_ID]);
        expect(sql).toContain("status in ('active', 'revoked')");
        return { rows: [{ status: "active" }] };
      }
      throw new Error("Não deveria persistir.");
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).rejects.toThrow("Acesso ao curso já está ativo.");
    expect(gateway.calls.createCheckout).toHaveLength(0);
    expect(pool.query).not.toHaveBeenCalledWith(
      expect.stringContaining("insert into orders"),
      expect.anything()
    );
  });

  it("rejects a revoked enrollment before persistence or provider access", async () => {
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.includes("from enrollments")) {
        expect(values).toEqual(["user-1", COURSE_ID]);
        expect(sql).toContain("status in ('active', 'revoked')");
        return { rows: [{ status: "revoked" }] };
      }
      throw new Error("Não deveria persistir.");
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).rejects.toThrow("Acesso ao curso está revogado.");
    expect(gateway.calls.createCheckout).toHaveLength(0);
    expect(pool.query).not.toHaveBeenCalledWith(
      expect.stringContaining("insert into orders"),
      expect.anything()
    );
  });

  it("rejects a course without a published publication before persistence or provider access", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.startsWith("select c.id")) {
        return {
          rows: [{ ...course, has_published_publication: false }],
        };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      throw new Error("Não deveria persistir.");
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).rejects.toThrow("Curso indisponível para checkout pago.");
    expect(gateway.calls.createCheckout).toHaveLength(0);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("rejects a course whose sales are closed before persistence or provider access", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [{ ...course, sales_status: "closed" }] };
      }
      throw new Error("Não deveria persistir.");
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).rejects.toThrow("Curso indisponível para checkout pago.");
    expect(gateway.calls.createCheckout).toHaveLength(0);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it("persists a provider-pending buyer without PII or account mutation", async () => {
    const pool = createPool((sql, values) => {
      expect(sql).not.toMatch(USER_MUTATION_PATTERN);
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        expect(values?.[2]).toBeNull();
        expect(sql).toContain("buyer_identity_status");
        expect(values).toContain("pending");
        expect(values).not.toContain("public@example.com");
        expect(values).not.toContain("Compradora Pública");
        return {
          rows: [
            {
              ...insertedOrder,
              buyer_identity_status: "pending",
              customer_email: null,
              customer_name: null,
              user_id: null,
            },
          ],
        };
      }
      if (sql.startsWith("update orders")) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await createAsaasCheckoutIntent({
      ...providerPendingInput(gateway),
    });

    expect(gateway.calls.createCheckout[0]).not.toHaveProperty("customer");
    expect(gateway.calls.createCheckout[0]).not.toHaveProperty("customerData");
  });

  it("returns an existing ready checkout without a second provider call", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [] };
      }
      if (sql.startsWith("select id, course_id")) {
        return {
          rows: [
            {
              ...insertedOrder,
              checkout_status: "active",
              checkout_url: "https://asaas.example/existing",
            },
          ],
        };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();
    const now = vi.fn(() => NOW);
    const authorizeNewIntent = vi.fn().mockResolvedValue(undefined);

    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        authorizeNewIntent,
        now,
      })
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      redirectUrl: "https://asaas.example/existing",
      status: "ready",
    });
    expect(gateway.calls.createCheckout).toHaveLength(0);
    expect(authorizeNewIntent).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it("resolves a ready duplicate before checking newly-active access", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return {
          rows: [
            {
              ...insertedOrder,
              checkout_status: "active",
              checkout_url: "https://asaas.example/existing",
            },
          ],
        };
      }
      if (sql.startsWith("select id from enrollments")) {
        return { rows: [{ id: "paid-enrollment" }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      redirectUrl: "https://asaas.example/existing",
      status: "ready",
    });
    expect(pool.query).not.toHaveBeenCalledWith(
      expect.stringContaining("from enrollments"),
      expect.anything()
    );
  });

  it("preserves a concurrent active checkout when the provider call reports failure", async () => {
    let attemptReads = 0;
    const gateway = createGateway(
      new AsaasGatewayError({
        kind: "validation",
        message: "unsafe provider detail",
        outcome: "rejected",
        retryable: false,
      })
    );
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select id, course_id")) {
        attemptReads += 1;
        return {
          rows:
            attemptReads === 1
              ? []
              : [
                  {
                    ...insertedOrder,
                    checkout_status: "active",
                    checkout_url: "https://asaas.example/concurrent",
                  },
                ],
        };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [insertedOrder] };
      }
      if (
        sql.startsWith("update orders") &&
        sql.includes("checkout_attempt_count = checkout_attempt_count + 1")
      ) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      if (sql.startsWith("update orders")) {
        expect(sql).toContain("where id = $1 and checkout_status = 'creating'");
        expect(sql).toContain("returning id");
        expect(sql).toContain("updated_at = now()");
        expect(values).not.toContain(NOW);
        return { rows: [] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      redirectUrl: "https://asaas.example/concurrent",
      status: "ready",
    });
    expect(attemptReads).toBe(2);
  });

  it.each([
    "cancelled",
    "expired",
  ] as const)("preserves concurrent %s after provider success persistence failure", async (checkoutStatus) => {
    let updates = 0;
    let attemptReads = 0;
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select id, course_id")) {
        attemptReads += 1;
        return {
          rows:
            attemptReads === 1
              ? []
              : [{ ...insertedOrder, checkout_status: checkoutStatus }],
        };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [insertedOrder] };
      }
      if (
        sql.startsWith("update orders") &&
        sql.includes("checkout_attempt_count = checkout_attempt_count + 1")
      ) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      if (sql.startsWith("update orders")) {
        updates += 1;
        expect(sql).toContain("where id = $1 and checkout_status = 'creating'");
        expect(sql).toContain("returning id");
        expect(sql).toContain("updated_at = now()");
        expect(values).not.toContain(NOW);
        if (updates === 1) {
          throw new Error("database unavailable");
        }
        return { rows: [] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      status: "failed",
    });
    expect(updates).toBe(2);
    expect(attemptReads).toBe(2);
  });

  it.each([
    [
      "inactive course",
      { ...course, status: "draft" },
      { courseId: COURSE_ID },
    ],
    [
      "course below the current minimum",
      { ...course, price_in_cents: 999 },
      { courseId: COURSE_ID },
    ],
    ["renamed course slug", null, { courseSlug: "formacao-neuro" }],
  ] as const)("returns a historical ready attempt without consulting the current %s", async (_scenario, currentCourse, identifier) => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select id, course_id")) {
        return {
          rows: [
            {
              ...insertedOrder,
              checkout_status: "active",
              checkout_url: "https://asaas.example/historical",
            },
          ],
        };
      }
      if (sql.startsWith("select c.id")) {
        return { rows: currentCourse ? [currentCourse] : [] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();
    const baseInput = authenticatedInput(gateway);
    const { courseId: _courseId, ...inputWithoutCourseId } = baseInput;
    const request =
      "courseSlug" in identifier
        ? { ...inputWithoutCourseId, courseSlug: identifier.courseSlug }
        : { ...baseInput, courseId: identifier.courseId };

    await expect(createAsaasCheckoutIntent(request)).resolves.toEqual({
      orderId: ATTEMPT_ID,
      redirectUrl: "https://asaas.example/historical",
      status: "ready",
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it.each([
    [{ courseId: "5535ae17-20ce-4977-bad4-91bb3eb115b1" }, "different id"],
    [{ courseSlug: "outro-curso" }, "different slug"],
  ] as const)("rejects an existing attempt collision for a %s", async (identifier, _description) => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select id, course_id")) {
        return { rows: [insertedOrder] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();
    const baseInput = authenticatedInput(gateway);
    const { courseId: _courseId, ...inputWithoutCourseId } = baseInput;
    const request =
      "courseSlug" in identifier
        ? { ...inputWithoutCourseId, courseSlug: identifier.courseSlug }
        : { ...baseInput, courseId: identifier.courseId };

    await expect(createAsaasCheckoutIntent(request)).rejects.toThrow(
      "Tentativa de checkout inválida."
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it.each([
    "pending",
    "creating",
    "uncertain",
  ] as const)("treats duplicate %s as reconciliation without a second mutation", async (checkoutStatus) => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return {
          rows: [{ ...insertedOrder, checkout_status: checkoutStatus }],
        };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      status: "processing",
    });
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it("resolves a concurrent insert conflict without a second provider mutation", async () => {
    let attemptReads = 0;
    const pool = createPool((sql) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        attemptReads += 1;
        return {
          rows:
            attemptReads === 1
              ? []
              : [{ ...insertedOrder, checkout_status: "creating" }],
        };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      status: "processing",
    });
    expect(attemptReads).toBe(2);
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it("rejects an attempt collision without revealing the existing order", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [{ ...insertedOrder, user_id: "another-user" }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).rejects.toThrow("Tentativa de checkout inválida.");
    expect(gateway.calls.createCheckout).toHaveLength(0);
  });

  it.each([
    ["rejected", "failed"],
    ["unknown", "uncertain"],
  ] as const)("persists a safe %s provider failure as %s", async (outcome, expectedStatus) => {
    const unsafeMessage = "token=secret aluna@example.com provider body";
    let persistedFailureValues: unknown[] | undefined;
    const gateway = createGateway(
      new AsaasGatewayError({
        kind: "transport",
        message: unsafeMessage,
        outcome,
        providerCode: "provider_error",
        retryable: true,
      })
    );
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [insertedOrder] };
      }
      if (
        sql.startsWith("update orders") &&
        sql.includes("checkout_attempt_count = checkout_attempt_count + 1")
      ) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      if (sql.startsWith("update orders")) {
        persistedFailureValues = values;
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      status: outcome === "unknown" ? "processing" : "failed",
    });
    expect(persistedFailureValues?.[1]).toBe(expectedStatus);
    expect(persistedFailureValues?.join(" ")).not.toContain("secret");
    expect(persistedFailureValues?.join(" ")).not.toContain(
      "aluna@example.com"
    );
    expect(persistedFailureValues?.join(" ")).toContain("provider_error");
    expect(gateway.calls.createCheckout).toHaveLength(1);
  });

  it("marks reconciliation when persistence fails after provider success", async () => {
    let updates = 0;
    const pool = createPool((sql, values) => {
      if (sql.startsWith("select c.id")) {
        return { rows: [course] };
      }
      if (sql.startsWith("select id, course_id")) {
        return { rows: [] };
      }
      if (sql.includes("from enrollments")) {
        return { rows: [] };
      }
      if (sql.startsWith("insert into orders")) {
        return { rows: [insertedOrder] };
      }
      if (
        sql.startsWith("update orders") &&
        sql.includes("checkout_attempt_count = checkout_attempt_count + 1")
      ) {
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      if (sql.startsWith("update orders")) {
        updates += 1;
        if (updates === 1) {
          throw new Error("database unavailable");
        }
        expect(values?.[1]).toBe("uncertain");
        return { rows: [{ id: ATTEMPT_ID }] };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent(authenticatedInput(gateway))
    ).resolves.toEqual({
      orderId: ATTEMPT_ID,
      status: "processing",
    });
    expect(updates).toBe(2);
    expect(gateway.calls.createCheckout).toHaveLength(1);
  });

  it("validates attempt, identifier, buyer, and callback inputs before database access", async () => {
    const pool = createPool(() => {
      throw new Error("Não deveria consultar.");
    });
    vi.mocked(getPool).mockReturnValue(pool as never);
    const gateway = createGateway();

    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        attemptId: "not-a-uuid",
      })
    ).rejects.toThrow("Tentativa de checkout inválida.");
    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        courseSlug: "curso",
      })
    ).rejects.toThrow("Informe exatamente um curso.");
    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        courseId: "not-a-uuid",
      })
    ).rejects.toThrow("Identificador de curso inválido.");
    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        buyer: {
          email: " ",
          kind: "authenticated",
          name: "Nome",
          userId: "user-1",
        },
      })
    ).rejects.toThrow("Identidade local inválida.");
    await expect(
      createAsaasCheckoutIntent({
        ...authenticatedInput(gateway),
        callbacks: { ...callbacks, successUrl: "javascript:alert(1)" },
      })
    ).rejects.toThrow("Callbacks de checkout inválidos.");
    expect(pool.query).not.toHaveBeenCalled();
  });
});
