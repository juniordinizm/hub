import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PanelLayout", () => {
  it("does not present fabricated notifications in the shared app header", async () => {
    const source = await readFile(
      new URL("./panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain('from "@/components/notifications-button"');
    expect(source).not.toContain("<NotificationsButton />");
  });

  it("keeps the official platform logo in desktop and mobile headers", async () => {
    const source = await readFile(
      new URL("./panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "@/components/brand-logo"');
    expect(source).toContain("<BrandLogo");
  });
});
