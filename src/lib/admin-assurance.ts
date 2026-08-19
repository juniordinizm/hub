import type { AppRole } from "./session";

export type AdminAssuranceState =
  | "challenge_required"
  | "not_required"
  | "recovery_required"
  | "setup_required"
  | "verified";

export interface AdminAssuranceInput {
  mfaEnforced: boolean;
  recoveryRequired?: boolean;
  role: AppRole;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
}

export const resolveAdminAssurance = ({
  mfaEnforced,
  recoveryRequired = false,
  role,
  twoFactorEnabled,
  twoFactorVerified,
}: AdminAssuranceInput): AdminAssuranceState => {
  if (role === "student" || !mfaEnforced) {
    return "not_required";
  }

  if (recoveryRequired) {
    return "recovery_required";
  }

  if (!twoFactorEnabled) {
    return "setup_required";
  }

  return twoFactorVerified ? "verified" : "challenge_required";
};

export const canPerformPrivilegedMutation = (
  assurance: AdminAssuranceState
): boolean => assurance === "verified";
