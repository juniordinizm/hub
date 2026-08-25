import { describe, expect, it } from "vitest";

import {
  canPerformPrivilegedMutation,
  resolveAdminAssurance,
} from "./admin-assurance";

describe("admin assurance", () => {
  it("does not impose MFA on students or public verification", () => {
    expect(
      resolveAdminAssurance({
        hasActiveSession: true,
        mfaEnforced: true,
        role: "student",
        twoFactorEnabled: false,
      })
    ).toBe("not_required");
  });

  it("requires setup before privileged mutations when enforcement is active", () => {
    const assurance = resolveAdminAssurance({
      hasActiveSession: true,
      mfaEnforced: true,
      role: "admin",
      twoFactorEnabled: false,
    });

    expect(assurance).toBe("setup_required");
    expect(canPerformPrivilegedMutation(assurance)).toBe(false);
  });

  it("allows only a verified privileged session", () => {
    expect(canPerformPrivilegedMutation("verified")).toBe(true);
    expect(canPerformPrivilegedMutation("challenge_required")).toBe(false);
    expect(canPerformPrivilegedMutation("setup_required")).toBe(false);
  });
});
