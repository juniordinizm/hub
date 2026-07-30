import { describe, expect, it } from "vitest";
import { parseCoursePriceToCents } from "./course-price";

describe("course price", () => {
  it.each([
    ["0", 0],
    ["10,00", 1000],
    ["129,90", 12_990],
    ["1.497", 149_700],
    ["R$ 1.497,90", 149_790],
    ["1000", 100_000],
    ["21.474.836,47", 2_147_483_647],
  ])("parses %s into %i cents", (value, expected) => {
    expect(parseCoursePriceToCents(value)).toBe(expected);
  });

  it.each([
    "0,01",
    "9,99",
    "-10",
    "",
    "abc",
    "1,234",
    "R$",
    "21.474.836,48",
  ])("rejects invalid or subminimum paid price %s", (value) => {
    expect(() => parseCoursePriceToCents(value)).toThrow(
      "Preco do curso invalido."
    );
  });

  it("rejects values that overflow safe integer cents", () => {
    expect(() => parseCoursePriceToCents("90.071.992.547.409,92")).toThrow(
      "Preco do curso invalido."
    );
  });
});
