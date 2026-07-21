import { describe, expect, it } from "vitest";
import { getSentryOptions } from "./sentry-options";

describe("Sentry options", () => {
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
