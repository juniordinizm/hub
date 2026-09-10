export type AdminEnrollmentStatusFilter =
  | "active"
  | "all"
  | "expired"
  | "revoked";

export type AdminStudentAccessFilter =
  | "active"
  | "all"
  | "blocked"
  | "expiring"
  | "without_access";

export const ADMIN_ENROLLMENT_STATUS_FILTERS: readonly {
  label: string;
  value: Exclude<AdminEnrollmentStatusFilter, "all">;
}[] = [
  { label: "Ativas", value: "active" },
  { label: "Expiradas", value: "expired" },
  { label: "Revogadas", value: "revoked" },
];

export const ADMIN_STUDENT_ACCESS_FILTERS: readonly {
  label: string;
  value: Exclude<AdminStudentAccessFilter, "all">;
}[] = [
  { label: "Com acesso ativo", value: "active" },
  { label: "Sem acesso ativo", value: "without_access" },
  { label: "Plataforma bloqueada", value: "blocked" },
  { label: "Expira em breve", value: "expiring" },
];

const isEnrollmentStatusFilter = (
  value: string | undefined
): value is AdminEnrollmentStatusFilter =>
  value === "active" || value === "expired" || value === "revoked";

const isStudentAccessFilter = (
  value: string | undefined
): value is AdminStudentAccessFilter =>
  value === "active" ||
  value === "blocked" ||
  value === "expiring" ||
  value === "without_access";

export const parseAdminEnrollmentStatusFilter = (
  value: string | undefined
): AdminEnrollmentStatusFilter =>
  isEnrollmentStatusFilter(value) ? value : "all";

export const parseAdminStudentAccessFilter = (
  value: string | undefined
): AdminStudentAccessFilter => (isStudentAccessFilter(value) ? value : "all");
