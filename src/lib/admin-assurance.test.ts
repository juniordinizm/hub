import { describe, expect, it } from "vitest";

import {
  canPerformPrivilegedMutation,
  resolveAdminAssurance,
} from "./admin-assurance";

describe("admin assurance", () => {
  it("does not impose MFA on students or public verification", () => {
    expect(
      resolveAdminAssurance({
        mfaEnforced: true,
        role: "student",
        twoFactorEnabled: false,
        twoFactorVerified: false,
      })
    ).toBe("not_required");
  });

  it("requires setup before privileged mutations when enforcement is active", () => {
    const assurance = resolveAdminAssurance({
      mfaEnforced: true,
      role: "admin",
      twoFactorEnabled: false,
      twoFactorVerified: false,
    });

    expect(assurance).toBe("setup_required");
    expect(canPerformPrivilegedMutation(assurance)).toBe(false);
  });

  it("allows only a verified privileged session", () => {
    expect(canPerformPrivilegedMutation("verified")).toBe(true);
    expect(canPerformPrivilegedMutation("challenge_required")).toBe(false);
    expect(canPerformPrivilegedMutation("recovery_required")).toBe(false);
  });
});
