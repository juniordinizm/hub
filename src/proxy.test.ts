import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { CORRELATION_ID_HEADER } from "@/lib/observability";
import { proxy } from "./proxy";

describe("proxy", () => {
  it("propaga um correlation ID seguro para a aplicação e para a resposta", () => {
    const correlationId = "fbe7b6eb-e066-4b41-970a-f4ea65ca1772";
    const response = proxy(
      new NextRequest("https://hub.example.test/app", {
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      })
    );

    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe(correlationId);
    expect(response.headers.get("x-middleware-request-x-correlation-id")).toBe(
      correlationId
    );
  });
});
