import { describe, expect, it } from "vitest";
import { parseTrustedOrigins } from "./trusted-origins";

describe("parseTrustedOrigins", () => {
  it("combines default origins with extra origins from env", () => {
    expect(
      parseTrustedOrigins({
        defaults: ["http://localhost:3000"],
        extraOrigins:
          "https://example.ngrok-free.app, https://preview.example.com/",
      })
    ).toEqual([
      "http://localhost:3000",
      "https://example.ngrok-free.app",
      "https://preview.example.com",
    ]);
  });

  it("deduplicates origins and ignores invalid values", () => {
    expect(
      parseTrustedOrigins({
        defaults: ["http://localhost:3000"],
        extraOrigins: "invalid-url, http://localhost:3000/",
      })
    ).toEqual(["http://localhost:3000"]);
  });
});
