import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("AccordionTrigger accessibility", () => {
  it("keeps a visible focus ring after removing the native outline", async () => {
    const source = await readFile(
      new URL("./accordion.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("outline-none");
    expect(source).toContain("focus-visible:ring-2 focus-visible:ring-ring");
    expect(source).toContain("focus-visible:ring-offset-2");
    expect(source).toContain("focus-visible:ring-offset-background");
  });

  it("does not add a redundant horizontal content inset", async () => {
    const source = await readFile(
      new URL("./accordion.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain(
      'className="overflow-hidden px-4 text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"'
    );
  });
});
