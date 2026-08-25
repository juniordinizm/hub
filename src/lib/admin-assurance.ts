import {
  canPerformPrivilegedMutation as canPerformPrivilegedMutationPolicy,
  type PrivilegedAssuranceState,
  resolvePrivilegedAssurance,
} from "./privileged-assurance";

export type AdminAssuranceState = PrivilegedAssuranceState;
export const resolveAdminAssurance = resolvePrivilegedAssurance;
export const canPerformPrivilegedMutation = (
  assurance: AdminAssuranceState
): boolean => canPerformPrivilegedMutationPolicy(assurance);
