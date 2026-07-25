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

  it("keeps readiness connections short and isolated from application traffic", () => {
    expect(getDatabasePoolOptions("readiness")).toEqual({
      connectionTimeoutMillis: 1000,
      idleTimeoutMillis: 10_000,
      max: 1,
    });
  });
});
