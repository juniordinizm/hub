import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course settings action", () => {
  it("revalidates the affected student course overview after saving", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const { courseId } = await saveCourse({");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: matching literal source text
    expect(source).toContain("revalidatePath(`/app/cursos/${courseId}`)");
  });
});
