import { describe, expect, it } from "vitest";
import { getSentryOptions } from "./sentry-options";

describe("Sentry options", () => {
  it("classifies Staging events explicitly", () => {
    expect(
      getSentryOptions("https://public@example.ingest.sentry.io/1", "staging")
    ).toMatchObject({ environment: "staging" });
  });

  it("mantém a captura desativada sem DSN", () => {
    expect(getSentryOptions(undefined).enabled).toBe(false);
  });

  it("remove query, corpo, cookies e identidade de um evento", () => {
    const options = getSentryOptions(
      "https://public@example.ingest.sentry.io/1"
    );
    const unsanitizedEvent = {
      request: {
        cookies: { session: "secret" },
        data: { email: "student@example.test" },
        headers: { authorization: "Bearer secret" },
        url: "https://hub.example.test/app?email=student@example.test",
      },
      user: {
        email: "student@example.test",
        id: "user-1",
        ip_address: "127.0.0.1",
      },
    } as unknown as Parameters<NonNullable<typeof options.beforeSend>>[0];
    const event = options.beforeSend?.(unsanitizedEvent);

    expect(event).toMatchObject({
      request: { url: "https://hub.example.test/app" },
    });
    expect(event?.request).not.toHaveProperty("cookies");
    expect(event?.request).not.toHaveProperty("data");
    expect(event?.request).not.toHaveProperty("headers");
    expect(event?.user).toBeUndefined();
  });

  it("redacts certificate public codes from request paths", () => {
    const options = getSentryOptions(
      "https://public@example.ingest.sentry.io/1"
    );
    const code = "PRT-1234567890ABCDEF1234567890ABCDEF";
    const event = options.beforeSend?.({
      request: {
        url: `https://hub.example.test/certificados/${code}/pdfs?download=1`,
      },
    } as unknown as Parameters<NonNullable<typeof options.beforeSend>>[0]);

    expect(event?.request?.url).toBe(
      "https://hub.example.test/certificados/[certificate-code]/pdfs"
    );
    expect(event?.request?.url).not.toContain(code);
  });

  it("redacts certificate codes from breadcrumbs without removing unrelated data", () => {
    const options = getSentryOptions(
      "https://public@example.ingest.sentry.io/1"
    );
    const code = "PRT-1234567890ABCDEF1234567890ABCDEF";
    const originalBreadcrumb = {
      category: "navigation",
      data: {
        attempts: 2,
        embeddedPath: `Navigating to /certificados/${code}?email=student@example.test after click`,
        embeddedUrl: `Fetched https://hub.example.test/certificados/${code}/pdf?signature=secret successfully`,
        from: `https://hub.example.test/certificados/${code}?email=student@example.test`,
        method: "GET",
        note: `/certificados/${code}?source=breadcrumb`,
        to: `/app/certificados/${code}/pdf?download=1`,
        unrelated: "Why? Keep this=yes#anchor",
        url: `https://hub.example.test/certificados/${code}?view=public`,
      },
      message: `Opening certificate ${code}`,
    };
    const originalBreadcrumbSnapshot = JSON.stringify(originalBreadcrumb);
    const breadcrumb = options.beforeBreadcrumb?.(originalBreadcrumb);

    expect(breadcrumb).toEqual({
      category: "navigation",
      data: {
        attempts: 2,
        embeddedPath:
          "Navigating to /certificados/[certificate-code] after click",
        embeddedUrl:
          "Fetched https://hub.example.test/certificados/[certificate-code]/pdf successfully",
        from: "https://hub.example.test/certificados/[certificate-code]",
        method: "GET",
        note: "/certificados/[certificate-code]",
        to: "/app/certificados/[certificate-code]/pdf",
        unrelated: "Why? Keep this=yes#anchor",
        url: "https://hub.example.test/certificados/[certificate-code]",
      },
      message: "Opening certificate [certificate-code]",
    });
    const serializedBreadcrumb = JSON.stringify(breadcrumb);
    expect(serializedBreadcrumb).not.toContain(code);
    expect(serializedBreadcrumb).not.toContain("student@example.test");
    expect(serializedBreadcrumb).not.toContain("source=breadcrumb");
    expect(serializedBreadcrumb).not.toContain("download=1");
    expect(serializedBreadcrumb).not.toContain("signature=secret");
    expect(serializedBreadcrumb).toContain("Why? Keep this=yes#anchor");
    expect(JSON.stringify(originalBreadcrumb)).toBe(originalBreadcrumbSnapshot);
    expect(breadcrumb).not.toBe(originalBreadcrumb);
    expect(breadcrumb?.data).not.toBe(originalBreadcrumb.data);
  });

  it("redacts certificate codes from transaction names", () => {
    const options = getSentryOptions(
      "https://public@example.ingest.sentry.io/1"
    );
    const code = "PRT-1234567890ABCDEF1234567890ABCDEF";
    const transaction = options.beforeSendTransaction?.({
      environment: "production",
      transaction: `/certificados/${code}?download=1`,
      type: "transaction",
    });

    expect(transaction).toMatchObject({
      environment: "production",
      transaction: "/certificados/[certificate-code]",
      type: "transaction",
    });
    expect(JSON.stringify(transaction)).not.toContain(code);
  });

  it("redacts certificate codes from span descriptions and string data", () => {
    const options = getSentryOptions(
      "https://public@example.ingest.sentry.io/1"
    );
    const code = "PRT-1234567890ABCDEF1234567890ABCDEF";
    const span = options.beforeSendSpan?.({
      data: {
        "http.method": "GET",
        "http.url": `https://hub.example.test/certificados/${code}?download=1`,
        note: `certificate ${code}`,
        rows: 1,
      },
      description: `GET /certificados/${code}?download=1`,
      span_id: "span-id",
      start_timestamp: 1,
      trace_id: "trace-id",
    });

    expect(span).toMatchObject({
      data: {
        "http.method": "GET",
        "http.url": "https://hub.example.test/certificados/[certificate-code]",
        note: "certificate [certificate-code]",
        rows: 1,
      },
      description: "GET /certificados/[certificate-code]",
    });
    expect(JSON.stringify(span)).not.toContain(code);
  });

  it("preserves only explicit safe tags while removing request identifiers", () => {
    const options = getSentryOptions(
      "https://public@example.ingest.sentry.io/1"
    );
    const event = options.beforeSend?.({
      request: {
        headers: { "x-correlation-id": "correlation-123" },
        url: "https://hub.example.test/app?email=student@example.test",
      },
      tags: { correlation_id: "correlation-123" },
    } as unknown as Parameters<NonNullable<typeof options.beforeSend>>[0]);

    expect(event).toMatchObject({
      request: { url: "https://hub.example.test/app" },
      tags: { correlation_id: "correlation-123" },
    });
  });
});
