import { describe, expect, it } from "vitest";
import { createCourseSlug } from "./slug";

describe("course slugs", () => {
  it("generates a normalized slug from the course title", () => {
    expect(createCourseSlug("Formação PROTEA-R: Aula 01")).toBe(
      "formacao-protea-r-aula-01"
    );
  });

  it("uses a stable fallback when the title has no slug characters", () => {
    expect(createCourseSlug("   ")).toBe("curso");
  });
});
