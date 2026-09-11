import { describe, expect, it } from "vitest";
import { formatCnpjInput, isValidCnpj, normalizeCnpj } from "./cnpj";

describe("CNPJ helpers", () => {
  it("accepts a valid formatted or unformatted CNPJ", () => {
    expect(isValidCnpj("04.252.011/0001-10")).toBe(true);
    expect(isValidCnpj("04252011000110")).toBe(true);
    expect(normalizeCnpj("04252011000110")).toBe("04.252.011/0001-10");
  });

  it("formats partial input without allowing more than 14 digits", () => {
    expect(formatCnpjInput("04252011000110999")).toBe("04.252.011/0001-10");
  });

  it("rejects invalid check digits, repeated digits and invalid characters", () => {
    expect(isValidCnpj("04.252.011/0001-11")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("04.252.011/0001-1A")).toBe(false);
    expect(normalizeCnpj("04.252.011/0001-11")).toBeNull();
  });
});
