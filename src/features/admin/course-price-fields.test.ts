import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin course price fields", () => {
  it("gives simultaneous course creation forms distinct price field ids", async () => {
    const source = await readFile(
      new URL("../../app/(admin)/admin/cursos/page.tsx", import.meta.url),
      "utf8"
    );
    const priceFieldIds = [
      "header-course-price",
      "empty-course-price",
    ] as const;

    for (const priceFieldId of priceFieldIds) {
      expect(source).toContain(`priceFieldId="${priceFieldId}"`);
    }
    expect(new Set(priceFieldIds).size).toBe(priceFieldIds.length);
    expect(source).toContain("htmlFor={priceFieldId}");
    expect(source).toContain("id={priceFieldId}");
  });

  it("associates the settings price label and input", async () => {
    const source = await readFile(
      new URL(
        "../../app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const fieldId = "course-settings-price";

    expect(source).toContain(`<FieldLabel htmlFor="${fieldId}">`);
    expect(source).toContain(`id="${fieldId}"`);
  });
});
