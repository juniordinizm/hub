import { describe, expect, it } from "vitest";
import {
  parseAsaasDecimalToCents,
  parseSignedAsaasDecimalToCents,
} from "./asaas-money";

describe("parseAsaasDecimalToCents", () => {
  it.each([
    [0.29, 29],
    [100, 10_000],
    [99.99, 9999],
  ])("converts provider decimal %s to safe cents", (value, expected) => {
    expect(parseAsaasDecimalToCents(value)).toBe(expected);
  });

  it.each([
    100.001,
    100.000_000_000_1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "100",
    Number.MAX_SAFE_INTEGER,
  ])("rejects non-cent provider value %#", (value) => {
    expect(parseAsaasDecimalToCents(value)).toBeNull();
  });
});

describe("parseSignedAsaasDecimalToCents", () => {
  it("preserves debit signs from financial statement entries", () => {
    expect(parseSignedAsaasDecimalToCents(-2.99)).toBe(-299);
    expect(parseSignedAsaasDecimalToCents(150)).toBe(15_000);
  });
});
