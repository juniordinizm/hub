import { describe, expect, it } from "vitest";
import {
  getCourseAvailabilityOptions,
  parseCourseLaunchLandingUrl,
  resolveCourseAvailability,
} from "./availability";

describe("resolveCourseAvailability", () => {
  it.each([
    ["draft", "hidden", "closed", "draft", false, false, false],
    ["draft", "listed", "closed", "coming_soon", false, false, true],
    ["active", "listed", "open", "available", true, true, false],
    ["active", "listed", "closed", "sales_paused", true, false, true],
    ["active", "hidden", "closed", "sales_paused", true, false, true],
    ["archived", "hidden", "closed", "archived", false, false, false],
  ] as const)("derives %s/%s/%s as %s", (deliveryStatus, catalogVisibility, salesStatus, preset, canAccess, canSell, acceptsInterest) => {
    expect(
      resolveCourseAvailability({
        catalogVisibility,
        deliveryStatus,
        salesStatus,
      })
    ).toEqual({
      acceptsInterest,
      canAccess,
      canSell,
      isListed: catalogVisibility === "listed",
      preset,
    });
  });

  it.each([
    ["draft", "hidden", "open"],
    ["draft", "listed", "open"],
    ["active", "hidden", "open"],
    ["archived", "listed", "closed"],
    ["archived", "hidden", "open"],
  ] as const)("rejects the invalid %s/%s/%s combination", (deliveryStatus, catalogVisibility, salesStatus) => {
    expect(() =>
      resolveCourseAvailability({
        catalogVisibility,
        deliveryStatus,
        salesStatus,
      })
    ).toThrow("Combinação de disponibilidade do Curso inválida.");
  });
});

describe("getCourseAvailabilityOptions", () => {
  it("disables pre-launch states after commercial history exists", () => {
    expect(
      getCourseAvailabilityOptions({ hasCommercialHistory: true })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ disabled: true, value: "coming_soon" }),
        expect.objectContaining({ disabled: true, value: "draft" }),
        expect.objectContaining({ disabled: false, value: "sales_paused" }),
      ])
    );
  });

  it("allows pre-launch states before the first commercial history", () => {
    expect(
      getCourseAvailabilityOptions({ hasCommercialHistory: false }).filter(
        (option) => option.disabled
      )
    ).toEqual([]);
  });
});

describe("parseCourseLaunchLandingUrl", () => {
  const input = {
    applicationUrl: "https://hub.example",
    courseSlug: "curso-publico",
  };

  it.each([
    "https://landing.example/curso",
    "http://landing.example/curso",
  ])("accepts the absolute HTTP(S) URL %s", (landingUrl) => {
    expect(parseCourseLaunchLandingUrl({ ...input, landingUrl })).toBe(
      landingUrl
    );
  });

  it("normalizes an empty URL to null", () => {
    expect(parseCourseLaunchLandingUrl({ ...input, landingUrl: "  " })).toBe(
      null
    );
  });

  it.each([
    "/curso",
    "javascript:alert(1)",
    "ftp://landing.example/curso",
    "https://hub.example/comprar/curso-publico",
    "https://hub.example/comprar/curso-publico/",
  ])("rejects the unsafe URL %s", (landingUrl) => {
    expect(() => parseCourseLaunchLandingUrl({ ...input, landingUrl })).toThrow(
      "Landing externa inválida."
    );
  });
});
