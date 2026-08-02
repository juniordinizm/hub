import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRELATION_ID_HEADER } from "@/lib/observability";
import { proxy } from "./proxy";

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("rewrites a Production navigation to the maintenance page", () => {
    vi.stubEnv("APPLICATION_MAINTENANCE_MODE", "full");

    const response = proxy(new NextRequest("https://hub.example.test/admin"));

    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://hub.example.test/manutencao"
    );
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
  });

  it.each([
    ["POST", "/admin"],
    ["GET", "/api/checkouts/course"],
  ])("returns JSON 503 for %s %s", async (method, pathname) => {
    vi.stubEnv("APPLICATION_MAINTENANCE_MODE", "full");

    const response = proxy(
      new NextRequest(`https://hub.example.test${pathname}`, { method })
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "service_unavailable",
    });
  });

  it.each([
    "/api/health",
    "/api/health/ready",
    "/api/cron/asaas-webhooks",
    "/manutencao",
  ])("allows %s without a rewrite loop", (pathname) => {
    vi.stubEnv("APPLICATION_MAINTENANCE_MODE", "full");

    const response = proxy(
      new NextRequest(`https://hub.example.test${pathname}`)
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
