import { describe, expect, it } from "vitest";
import { getE2eObjectStorageCorsHeaders } from "./e2e-object-storage-cors";

describe("E2E object-storage CORS", () => {
  it("allows the loopback application to preflight direct uploads", () => {
    expect(
      getE2eObjectStorageCorsHeaders({
        origin: "http://127.0.0.1:3100",
        requestedHeaders: "content-type",
      })
    ).toEqual({
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, HEAD, PUT, POST, OPTIONS",
      "access-control-allow-origin": "http://127.0.0.1:3100",
      "access-control-expose-headers": "etag",
      vary: "Origin, Access-Control-Request-Headers",
    });
  });

  it("does not trust a non-loopback origin", () => {
    expect(
      getE2eObjectStorageCorsHeaders({
        origin: "https://example.com",
        requestedHeaders: "content-type",
      })
    ).toEqual({});
  });
});
