import { afterEach, describe, expect, it, vi } from "vitest";
import { AbacatePayClient } from "./abacatepay-client";

vi.mock("server-only", () => ({}));

describe("AbacatePayClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates products using the v2 API with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "prod_123" },
          error: null,
        }),
        { status: 200 }
      )
    );
    const client = new AbacatePayClient({
      apiKey: "abc_prod_token",
      baseUrl: "https://api.abacatepay.com/v2",
      fetcher: fetchMock,
    });

    await expect(
      client.createProduct({
        currency: "BRL",
        externalId: "course_123",
        name: "Curso",
        price: 49_700,
      })
    ).resolves.toEqual({ id: "prod_123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.abacatepay.com/v2/products/create",
      {
        body: JSON.stringify({
          currency: "BRL",
          externalId: "course_123",
          name: "Curso",
          price: 49_700,
        }),
        headers: {
          Authorization: "Bearer abc_prod_token",
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    );
  });

  it("creates checkouts and returns the checkout URL and id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "bill_123",
            url: "https://app.abacatepay.com/pay/bill_123",
          },
          error: null,
        }),
        { status: 200 }
      )
    );
    const client = new AbacatePayClient({
      apiKey: "abc_prod_token",
      baseUrl: "https://api.abacatepay.com/v2",
      fetcher: fetchMock,
    });

    await expect(
      client.createCheckout({
        completionUrl: "https://example.com/app/checkout/sucesso",
        externalId: "order_123",
        frequency: "ONE_TIME",
        items: [{ id: "prod_123", quantity: 1 }],
        metadata: {
          accessDurationMonths: 6,
          courseId: "course_123",
          userId: "user_123",
        },
        methods: ["PIX", "CARD"],
        returnUrl: "https://example.com/app",
      })
    ).resolves.toEqual({
      id: "bill_123",
      url: "https://app.abacatepay.com/pay/bill_123",
    });
  });

  it("requests an integral checkout refund with an auditable reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { refundPublicId: "ref_123" },
          error: null,
        }),
        { status: 200 }
      )
    );
    const client = new AbacatePayClient({
      apiKey: "abc_prod_token",
      baseUrl: "https://api.abacatepay.com/v2",
      fetcher: fetchMock,
    });

    await expect(
      client.refundCheckout({
        checkoutId: "bill_123",
        reason: "Solicitacao da aluna",
      })
    ).resolves.toEqual({ refundPublicId: "ref_123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.abacatepay.com/v2/checkouts/refund",
      expect.objectContaining({
        body: JSON.stringify({
          id: "bill_123",
          reason: "Solicitacao da aluna",
        }),
        method: "POST",
      })
    );
  });

  it("throws a readable error when the API rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { message: "externalId already exists" },
        }),
        { status: 400 }
      )
    );
    const client = new AbacatePayClient({
      apiKey: "abc_prod_token",
      baseUrl: "https://api.abacatepay.com/v2",
      fetcher: fetchMock,
    });

    await expect(
      client.createProduct({
        currency: "BRL",
        externalId: "course_123",
        name: "Curso",
        price: 49_700,
      })
    ).rejects.toThrow("externalId already exists");
  });

  it("throws string errors returned by the v2 API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: "Property 'price' should be one of: 'integer', 'integer'",
        }),
        { status: 422 }
      )
    );
    const client = new AbacatePayClient({
      apiKey: "abc_prod_token",
      baseUrl: "https://api.abacatepay.com/v2",
      fetcher: fetchMock,
    });

    await expect(
      client.createProduct({
        currency: "BRL",
        externalId: "course_123",
        name: "Curso",
        price: 0,
      })
    ).rejects.toThrow(
      "Property 'price' should be one of: 'integer', 'integer'"
    );
  });
});
