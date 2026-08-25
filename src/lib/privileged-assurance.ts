import type { AppRole } from "./session";

export type PrivilegedAssuranceState =
  | "challenge_required"
  | "not_required"
  | "setup_required"
  | "verified";

interface PrivilegedAssuranceInput {
  hasActiveSession: boolean;
  mfaEnforced: boolean;
  role: AppRole;
  twoFactorEnabled: boolean;
}

export const resolvePrivilegedAssurance = ({
  hasActiveSession,
  mfaEnforced,
  role,
  twoFactorEnabled,
}: PrivilegedAssuranceInput): PrivilegedAssuranceState => {
  if (role === "student" || !mfaEnforced) {
    return "not_required";
  }

  if (!twoFactorEnabled) {
    return "setup_required";
  }

  return hasActiveSession ? "verified" : "challenge_required";
};

export const canPerformPrivilegedMutation = (
  assurance: PrivilegedAssuranceState
): boolean => assurance === "verified" || assurance === "not_required";

export const getPrivilegedAssuranceRedirect = (
  assurance: PrivilegedAssuranceState
): "/configurar-segundo-fator" | "/verificar-segundo-fator" | null => {
  if (assurance === "setup_required") {
    return "/configurar-segundo-fator";
  }

  if (assurance === "challenge_required") {
    return "/verificar-segundo-fator";
  }

  return null;
};
