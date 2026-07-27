import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./content-security-policy";

describe("content security policy", () => {
  it("keeps production connections restricted to the application and TLS origins", () => {
    expect(
      buildContentSecurityPolicy({
        additionalConnectOrigins: [],
        isProduction: true,
      })
    ).toContain("connect-src 'self' https: wss:");
  });

  it("allows a validated E2E object-storage origin without changing other directives", () => {
    const policy = buildContentSecurityPolicy({
      additionalConnectOrigins: ["http://127.0.0.1:4568"],
      isProduction: true,
    });

    expect(policy).toContain(
      "connect-src 'self' https: wss: http://127.0.0.1:4568"
    );
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
