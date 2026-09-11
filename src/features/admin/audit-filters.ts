export const ADMIN_AUDIT_SOURCES = [
  "all",
  "administrative",
  "enrollment",
  "financial",
] as const;

export type AdminAuditSource = (typeof ADMIN_AUDIT_SOURCES)[number];

export const ADMIN_AUDIT_TARGET_TYPES = [
  "all",
  "banner",
  "certificate",
  "certificate_template",
  "course",
  "course_publication",
  "enrollment",
  "faq",
  "financial_event",
  "lesson",
  "module",
  "order",
  "outbox_message",
  "payment_review",
  "refund_request",
  "settings",
  "student",
  "webhook_event",
] as const;

export type AdminAuditTargetType = (typeof ADMIN_AUDIT_TARGET_TYPES)[number];

export const isAdminAuditSource = (value: string): value is AdminAuditSource =>
  ADMIN_AUDIT_SOURCES.some((source) => source === value);

export const isAdminAuditTargetType = (
  value: string
): value is AdminAuditTargetType =>
  ADMIN_AUDIT_TARGET_TYPES.some((targetType) => targetType === value);

export const parseAdminAuditSource = (value: string): AdminAuditSource =>
  isAdminAuditSource(value) ? value : "all";

export const parseAdminAuditTargetType = (
  value: string
): AdminAuditTargetType => (isAdminAuditTargetType(value) ? value : "all");

export const ADMIN_AUDIT_SOURCE_LABELS: Record<
  Exclude<AdminAuditSource, "all">,
  string
> = {
  administrative: "Administrativo",
  enrollment: "Matrícula e acesso",
  financial: "Financeiro",
};

export const ADMIN_AUDIT_TARGET_LABELS: Record<
  Exclude<AdminAuditTargetType, "all">,
  string
> = {
  banner: "Banner",
  certificate: "Certificado",
  certificate_template: "Modelo de Certificado",
  course: "Curso",
  course_publication: "Publicação de Curso",
  enrollment: "Matrícula",
  faq: "FAQ",
  financial_event: "Evento financeiro",
  lesson: "Aula",
  module: "Módulo",
  order: "Pedido",
  outbox_message: "Mensagem da Outbox",
  payment_review: "Revisão financeira",
  refund_request: "Reembolso",
  settings: "Configurações",
  student: "Aluno",
  webhook_event: "Webhook",
};
