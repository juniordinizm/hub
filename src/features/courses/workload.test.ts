import { describe, expect, it } from "vitest";
import {
  parseCourseWorkloadOverride,
  resolveCourseWorkloadHours,
} from "./workload";

describe("course workload configuration", () => {
  it("derives the workload when no manual value is configured", () => {
    expect(parseCourseWorkloadOverride(" ")).toBeNull();
    expect(resolveCourseWorkloadHours(12, null)).toBe(12);
  });

  it("uses a non-negative integer manual value when configured", () => {
    expect(parseCourseWorkloadOverride("24")).toBe(24);
    expect(resolveCourseWorkloadHours(12, 24)).toBe(24);
  });

  it.each([
    "-1",
    "1.5",
    "abc",
    "Infinity",
  ])("rejects invalid manual workload input %s", (value) => {
    expect(() => parseCourseWorkloadOverride(value)).toThrow(
      "A carga horária deve ser um número inteiro não negativo."
    );
  });
});
