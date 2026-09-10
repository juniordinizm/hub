import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const authPages = [
  "../app/(auth)/cadastro/page.tsx",
  "../app/(auth)/entrar/page.tsx",
  "../app/(auth)/recuperar-senha/page.tsx",
  "../app/(auth)/redefinir-senha/page.tsx",
] as const;

describe("authentication routes", () => {
  it("uses the same branded shell throughout the account-access flow", async () => {
    for (const page of authPages) {
      const source = await readFile(new URL(page, import.meta.url), "utf8");

      expect(source).toContain('from "@/components/auth-shell"');
      expect(source).toContain("<AuthShell>");
    }
  });

  it("renders the official platform logo in the shared shell", async () => {
    const source = await readFile(
      new URL("./auth-shell.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "@/components/brand-logo"');
    expect(source).toContain("<BrandLogo");
  });
});
