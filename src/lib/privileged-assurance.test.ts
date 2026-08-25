import { describe, expect, it } from "vitest";
import {
  canPerformPrivilegedMutation,
  getPrivilegedAssuranceRedirect,
  resolvePrivilegedAssurance,
} from "./privileged-assurance";

describe("privileged session assurance", () => {
  it("does not alter a student session", () => {
    expect(
      resolvePrivilegedAssurance({
        hasActiveSession: true,
        mfaEnforced: true,
        role: "student",
        twoFactorEnabled: false,
      })
    ).toBe("not_required");
  });

  it("allows enrollment while the production rollout gate is disabled", () => {
    expect(
      resolvePrivilegedAssurance({
        hasActiveSession: true,
        mfaEnforced: false,
        role: "admin",
        twoFactorEnabled: false,
      })
    ).toBe("not_required");
  });

  it("restricts a privileged session without TOTP to setup", () => {
    const assurance = resolvePrivilegedAssurance({
      hasActiveSession: true,
      mfaEnforced: true,
      role: "support",
      twoFactorEnabled: false,
    });

    expect(assurance).toBe("setup_required");
    expect(canPerformPrivilegedMutation(assurance)).toBe(false);
    expect(getPrivilegedAssuranceRedirect(assurance)).toBe(
      "/configurar-segundo-fator"
    );
  });

  it("treats an active TOTP-enabled privileged session as verified", () => {
    const assurance = resolvePrivilegedAssurance({
      hasActiveSession: true,
      mfaEnforced: true,
      role: "admin",
      twoFactorEnabled: true,
    });

    expect(assurance).toBe("verified");
    expect(canPerformPrivilegedMutation(assurance)).toBe(true);
  });

  it("requires the Better Auth challenge when no active session exists", () => {
    expect(
      resolvePrivilegedAssurance({
        hasActiveSession: false,
        mfaEnforced: true,
        role: "admin",
        twoFactorEnabled: true,
      })
    ).toBe("challenge_required");
    expect(getPrivilegedAssuranceRedirect("challenge_required")).toBe(
      "/verificar-segundo-fator"
    );
  });
});
