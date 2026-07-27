import { describe, expect, it } from "vitest";
import { getDatabasePoolOptions } from "./pool-policy";

describe("database pool policy", () => {
  it("allows normal application connections enough time for a remote TLS handshake", () => {
    expect(getDatabasePoolOptions("application")).toEqual({
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
  });

  it("allows readiness TLS handshakes without sharing the application pool", () => {
    expect(getDatabasePoolOptions("readiness")).toEqual({
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10_000,
      max: 1,
    });
  });

  it("bounds each Vercel function instance to a small pooled connection budget", () => {
    expect(getDatabasePoolOptions("application", { VERCEL: "1" })).toEqual({
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 3,
    });
  });
});
