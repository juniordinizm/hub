import { describe, expect, it } from "vitest";
import {
  assertCheckoutAvailable,
  CheckoutUnavailableError,
} from "./checkout-availability";

describe("checkout availability", () => {
  it.each([
    ["disabled", "authenticated", false],
    ["disabled", "public", false],
    ["authenticated", "authenticated", true],
    ["authenticated", "public", false],
    ["public", "authenticated", true],
    ["public", "public", true],
  ] as const)("%s mode / %s entry => allowed=%s", (mode, entry, allowed) => {
    const invoke = (): void => assertCheckoutAvailable({ entry, mode });

    if (allowed) {
      expect(invoke).not.toThrow();
    } else {
      expect(invoke).toThrow(CheckoutUnavailableError);
    }
  });
});
