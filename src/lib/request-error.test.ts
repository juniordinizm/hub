import { describe, expect, it, vi } from "vitest";
import { logRequestFailure } from "./request-error";

describe("request error logging", () => {
  it("registra falha do App Router com o correlation ID da requisição", () => {
    const write = vi.fn();

    const correlationId = logRequestFailure(
      {
        context: { routePath: "/api/webhooks/abacatepay", routeType: "route" },
        request: {
          headers: {
            "x-correlation-id": "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
          },
        },
      },
      write
    );

    expect(correlationId).toBe("fbe7b6eb-e066-4b41-970a-f4ea65ca1772");
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"operation":"route./api/webhooks/abacatepay"')
    );
  });
});
