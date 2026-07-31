import { describe, expect, it } from "vitest";
import { isAllowedCheckoutUrl } from "./checkout-navigation";

describe("checkout navigation", () => {
  it("allows only the exact loopback checkout origin used by E2E", () => {
    process.env.NEXT_PUBLIC_E2E_TEST_MODE = "true";
    expect(
      isAllowedCheckoutUrl(
        "http://127.0.0.1:4570/checkout/chk_00000000-0000-4000-8000-000000000001"
      )
    ).toBe(true);
    expect(
      isAllowedCheckoutUrl("http://127.0.0.1:4571/checkout/chk_test")
    ).toBe(false);
    expect(
      isAllowedCheckoutUrl("http://localhost:4570/checkout/chk_test")
    ).toBe(false);
    delete process.env.NEXT_PUBLIC_E2E_TEST_MODE;
    expect(
      isAllowedCheckoutUrl("http://127.0.0.1:4570/checkout/chk_test")
    ).toBe(false);
  });
});
