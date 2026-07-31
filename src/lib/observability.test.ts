import { describe, expect, it, vi } from "vitest";
import {
  createCorrelationId,
  logOperationalEvent,
  sanitizeOperationalAttributes,
} from "./observability";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("observability", () => {
  it("reutiliza somente um correlation ID UUID valido", () => {
    const correlationId = "fbe7b6eb-e066-4b41-970a-f4ea65ca1772";

    expect(createCorrelationId(correlationId)).toBe(correlationId);
    expect(createCorrelationId("<script>alert(1)</script>")).toMatch(
      UUID_PATTERN
    );
  });

  it("remove atributos que podem conter segredo ou PII", () => {
    expect(
      sanitizeOperationalAttributes({
        aggregateId: "order-1",
        authorization: "Bearer secret",
        customerEmail: "student@example.test",
        errorCode: "provider_failed",
        payload: { name: "Student" },
        signedUrl: "https://example.test/?token=secret",
      })
    ).toEqual({
      aggregateId: "order-1",
      errorCode: "provider_failed",
    });
  });

  it("emite um evento correlacionavel sem mensagem de excecao", () => {
    const write = vi.fn();

    logOperationalEvent(
      {
        aggregateId: "order-1",
        correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
        durationMs: 42,
        errorCode: "provider_failed",
        operation: "checkout.create",
        outcome: "failure",
        provider: "asaas",
      },
      write
    );

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining(
        '"correlationId":"fbe7b6eb-e066-4b41-970a-f4ea65ca1772"'
      )
    );
    expect(write).toHaveBeenCalledWith(
      expect.not.stringContaining("customer@example.test")
    );
  });
});
