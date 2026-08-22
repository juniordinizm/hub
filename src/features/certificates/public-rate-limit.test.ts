import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_SECRET: "test-secret" }),
}));

import { consumePublicCertificateLookup } from "./public-rate-limit";

describe("public certificate lookup", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("allows twenty lookups from an address before limiting the next lookup", async () => {
    let requestCount = 0;
    query.mockImplementation(async () => ({
      rows: [{ request_count: ++requestCount }],
    }));
    const requestHeaders = new Headers({
      "x-forwarded-for": "203.0.113.10, 198.51.100.20",
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(
        consumePublicCertificateLookup(requestHeaders)
      ).resolves.toBe("allowed");
    }

    await expect(consumePublicCertificateLookup(requestHeaders)).resolves.toBe(
      "limited"
    );

    const expectedAddressHash = createHmac("sha256", "test-secret")
      .update("198.51.100.20")
      .digest("hex");
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expectedAddressHash, expect.any(Date)])
    );
  });
});
