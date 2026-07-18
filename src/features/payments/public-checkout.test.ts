import { afterEach, describe, expect, it, vi } from "vitest";

const { createCheckout, query } = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/features/payments/abacatepay-client", () => ({
  AbacatePayClient: class {
    createCheckout = createCheckout;
  },
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    ABACATE_PAY_API_KEY: "test-api-key",
    NEXT_PUBLIC_APP_URL: "https://hub.example.test",
  }),
}));

import { createPublicCourseCheckout } from "./public-checkout";

describe("public course checkout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits checkout attempts per course and IP, then releases access when its window expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    query.mockImplementation(
      (sql: string, [courseId]: [string | null] = [null]) => {
        if (sql.includes("from courses")) {
          return {
            rows: [
              {
                access_duration_months: 12,
                id: courseId ?? "course-123",
                payment_provider_product_id: "product-123",
                price_in_cents: 12_900,
                slug: "course-123",
                status: "active",
              },
            ],
          };
        }

        return { rows: [] };
      }
    );
    createCheckout.mockResolvedValue({
      id: "checkout-123",
      url: "https://pay.example.test/checkout-123",
    });
    const checkoutAttempt = () =>
      createPublicCourseCheckout({
        courseId: "course-123",
        ipAddress: "203.0.113.10",
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(checkoutAttempt()).resolves.toEqual({
        redirectUrl: "https://pay.example.test/checkout-123",
      });
    }

    await expect(checkoutAttempt()).rejects.toMatchObject({
      message: "Muitas tentativas de checkout. Tente novamente em breve.",
      name: "PublicCheckoutRateLimitError",
      retryAfterSeconds: 600,
    });

    await expect(
      createPublicCourseCheckout({
        courseId: "course-456",
        ipAddress: "203.0.113.10",
      })
    ).resolves.toEqual({
      redirectUrl: "https://pay.example.test/checkout-123",
    });

    vi.advanceTimersByTime(10 * 60 * 1000);

    await expect(checkoutAttempt()).resolves.toEqual({
      redirectUrl: "https://pay.example.test/checkout-123",
    });
  });

  it("shares a checkout limit between the course slug and ID", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from courses")) {
        return {
          rows: [
            {
              access_duration_months: 12,
              id: "course-shared-limit",
              payment_provider_product_id: "product-123",
              price_in_cents: 12_900,
              slug: "shared-limit-course",
              status: "active",
            },
          ],
        };
      }

      return { rows: [] };
    });
    createCheckout.mockResolvedValue({
      id: "checkout-123",
      url: "https://pay.example.test/checkout-123",
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        createPublicCourseCheckout({
          courseSlug: "shared-limit-course",
          ipAddress: "203.0.113.11",
        })
      ).resolves.toEqual({
        redirectUrl: "https://pay.example.test/checkout-123",
      });
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        createPublicCourseCheckout({
          courseId: "course-shared-limit",
          ipAddress: "203.0.113.11",
        })
      ).resolves.toEqual({
        redirectUrl: "https://pay.example.test/checkout-123",
      });
    }

    await expect(
      createPublicCourseCheckout({
        courseId: "course-shared-limit",
        ipAddress: "203.0.113.11",
      })
    ).rejects.toMatchObject({
      name: "PublicCheckoutRateLimitError",
    });
  });
});
