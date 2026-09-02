import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

const readProjectFile = (path: string): string =>
  readFileSync(resolve(projectRoot, path), "utf8");

describe("MFA removal contract", () => {
  it("does not register two-factor plugins in Better Auth", () => {
    expect(readProjectFile("src/lib/auth.ts")).not.toContain("twoFactor");
    expect(readProjectFile("src/lib/auth-client.ts")).not.toContain(
      "twoFactor"
    );
    expect(readProjectFile("src/db/index.ts")).not.toContain("twoFactors");
  });

  it("does not enforce MFA at session or redirect boundaries", () => {
    for (const path of [
      "src/lib/session.ts",
      "src/app/(auth)/entrar/page.tsx",
      "src/app/api/auth/redirect/route.ts",
      "src/app/api/auth/[...all]/route.ts",
      "src/lib/env.ts",
      "src/components/panel-layout.tsx",
      "src/db/staging-admin-seed.ts",
    ]) {
      const source = readProjectFile(path);
      expect(source).not.toContain("PRIVILEGED_MFA_ENFORCED");
      expect(source).not.toContain("twoFactorEnabled");
      expect(source).not.toContain("privileged-assurance");
      expect(source).not.toContain("STAGING_RECOVERY_ADMIN");
      expect(source).not.toContain("configurar-segundo-fator");
      expect(source).not.toContain("verificar-segundo-fator");
    }
  });

  it("does not ship second-factor pages", () => {
    expect(
      existsSync(
        resolve(projectRoot, "src/app/(auth)/configurar-segundo-fator")
      )
    ).toBe(false);
    expect(
      existsSync(resolve(projectRoot, "src/app/(auth)/verificar-segundo-fator"))
    ).toBe(false);
  });
});
