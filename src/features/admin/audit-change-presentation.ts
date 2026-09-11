import { formatCurrencyInCents } from "@/lib/formatters";
import type { AuditMetadata } from "./audit-types";

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  accessDurationMonths: "Duração de acesso",
  catalogVisibility: "Visibilidade no catálogo",
  content: "Conteúdo",
  cover: "Capa",
  courseId: "Curso",
  description: "Descrição",
  durationSeconds: "Duração total",
  isPublished: "Publicado",
  isRequired: "Obrigatória",
  launchDate: "Data de lançamento",
  launchLandingUrl: "Página de lançamento",
  moduleId: "Módulo",
  order: "Ordem",
  paymentAllowCreditCard: "Cartão de crédito",
  paymentAllowPix: "Pix",
  paymentMaxInstallmentCount: "Máximo de parcelas",
  priceInCents: "Preço",
  publicationNumber: "Número da versão",
  releaseDelayDays: "Atraso de liberação",
  salesStatus: "Status de vendas",
  sortOrder: "Ordem",
  status: "Status",
  subtitle: "Subtítulo",
  title: "Título",
  titleSnapshot: "Título da versão",
  textDurationSeconds: "Tempo de leitura",
  textWordCount: "Palavras do texto",
  videoDurationSeconds: "Duração do vídeo",
  videoEmbedUrl: "Player do vídeo",
  videoExternalId: "ID do vídeo",
  videoProvider: "Provedor do vídeo",
  workloadHoursSnapshot: "Carga horária da versão",
  workloadHoursOverride: "Carga horária",
};

const AUDIT_VALUE_LABELS: Record<string, Record<string, string>> = {
  catalogVisibility: { hidden: "Oculto", listed: "Visível" },
  salesStatus: { closed: "Fechadas", open: "Abertas" },
  status: {
    active: "Ativo",
    archived: "Arquivado",
    draft: "Rascunho",
    published: "Publicado",
    retired: "Retirado",
  },
  toPreset: {
    archived: "Arquivado",
    available: "Disponível",
    coming_soon: "Em breve",
    draft: "Rascunho",
    sales_paused: "Vendas pausadas",
  },
};

export const formatAuditValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }
  if (typeof value === "string") {
    return AUDIT_VALUE_LABELS[field]?.[value] ?? value;
  }
  if (field === "priceInCents" && typeof value === "number") {
    return formatCurrencyInCents(value);
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  if (
    (field === "durationSeconds" ||
      field === "textDurationSeconds" ||
      field === "videoDurationSeconds") &&
    typeof value === "number"
  ) {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
  }
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR");
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatAuditValue(field, item)).join(" → ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const formatAuditSummaryValue = (field: string, value: unknown): string => {
  const formatted = formatAuditValue(field, value);
  return formatted.length > 72 ? `${formatted.slice(0, 72)}…` : formatted;
};

export const getAuditChangeCount = (metadata: AuditMetadata): number =>
  Object.keys(metadata.changes ?? {}).length;

export const getAuditChangeSummary = (
  metadata: AuditMetadata,
  limit = 3
): string[] =>
  Object.entries(metadata.changes ?? {})
    .slice(0, limit)
    .map(
      ([field, change]) =>
        `${AUDIT_FIELD_LABELS[field] ?? field}: ${formatAuditSummaryValue(field, change.before)} → ${formatAuditSummaryValue(field, change.after)}`
    );
