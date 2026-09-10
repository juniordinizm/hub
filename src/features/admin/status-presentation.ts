export type AdminStatusBadgeVariant =
  | "default"
  | "destructive"
  | "info"
  | "outline"
  | "secondary"
  | "success"
  | "warning";

export interface AdminStatusPresentation {
  label: string;
  variant: AdminStatusBadgeVariant;
}

const fallbackStatus = (): AdminStatusPresentation => ({
  label: "Status não reconhecido",
  variant: "outline",
});

export const getEnrollmentStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "active":
      return { label: "Ativa", variant: "success" };
    case "expired":
      return { label: "Expirada", variant: "warning" };
    case "revoked":
      return { label: "Revogada", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};

export const getStudentAccessStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "active":
      return { label: "Acesso ativo", variant: "success" };
    case "expired":
      return { label: "Acesso expirado", variant: "warning" };
    case "revoked":
      return { label: "Acesso revogado", variant: "destructive" };
    case "blocked":
      return { label: "Plataforma bloqueada", variant: "destructive" };
    case "inactive":
      return { label: "Sem acesso ativo", variant: "warning" };
    case "not_enrolled":
      return { label: "Sem matrícula", variant: "secondary" };
    default:
      return fallbackStatus();
  }
};

export const getCertificateStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "valid":
      return { label: "Válido", variant: "success" };
    case "revoked":
      return { label: "Revogado", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};

export const getCourseDeliveryStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "active":
      return { label: "Ativo", variant: "success" };
    case "draft":
      return { label: "Rascunho", variant: "warning" };
    case "archived":
      return { label: "Arquivado", variant: "secondary" };
    default:
      return fallbackStatus();
  }
};

export const getCourseContentStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "active":
      return { label: "Publicado", variant: "success" };
    case "draft":
      return { label: "Rascunho", variant: "warning" };
    case "archived":
      return { label: "Arquivado", variant: "secondary" };
    default:
      return fallbackStatus();
  }
};

export const getCourseAvailabilityStatusPresentation = (
  preset: string
): AdminStatusPresentation => {
  switch (preset) {
    case "available":
      return { label: "Disponível", variant: "success" };
    case "coming_soon":
      return { label: "Em breve", variant: "info" };
    case "draft":
      return { label: "Rascunho", variant: "warning" };
    case "sales_paused":
      return { label: "Vendas pausadas", variant: "warning" };
    case "archived":
      return { label: "Arquivado", variant: "secondary" };
    default:
      return fallbackStatus();
  }
};

export const getOrderStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "pending":
      return { label: "Pendente", variant: "warning" };
    case "paid":
      return { label: "Pago", variant: "success" };
    case "refunded":
      return { label: "Reembolsado", variant: "info" };
    case "disputed":
      return { label: "Em disputa", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelado", variant: "outline" };
    default:
      return fallbackStatus();
  }
};

export const getCheckoutStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "pending":
      return { label: "Pendente", variant: "warning" };
    case "creating":
      return { label: "Criando", variant: "warning" };
    case "active":
      return { label: "Ativo", variant: "success" };
    case "failed":
      return { label: "Falhou", variant: "destructive" };
    case "uncertain":
      return { label: "Resultado incerto", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelado", variant: "outline" };
    case "expired":
      return { label: "Expirado", variant: "warning" };
    default:
      return fallbackStatus();
  }
};

export const getWebhookStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "received":
      return { label: "Recebido", variant: "info" };
    case "processing":
      return { label: "Processando", variant: "warning" };
    case "processed":
      return { label: "Processado", variant: "success" };
    case "ignored":
      return { label: "Ignorado", variant: "outline" };
    case "retryable":
      return { label: "Aguardando nova tentativa", variant: "warning" };
    case "failed":
      return { label: "Falhou", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};

export const getProviderPaymentStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return { label: "Pendente", variant: "warning" };
    case "confirmed":
      return { label: "Confirmado", variant: "success" };
    case "received":
      return { label: "Recebido", variant: "success" };
    case "received_in_cash":
      return { label: "Recebido em dinheiro", variant: "success" };
    case "overdue":
      return { label: "Em atraso", variant: "destructive" };
    case "deleted":
      return { label: "Removido", variant: "outline" };
    case "refunded":
      return { label: "Reembolsado", variant: "info" };
    case "partially_refunded":
      return { label: "Reembolso parcial", variant: "warning" };
    case "refund_in_progress":
      return { label: "Reembolso em processamento", variant: "warning" };
    case "refund_denied":
      return { label: "Reembolso recusado", variant: "destructive" };
    case "chargeback_requested":
      return { label: "Contestação solicitada", variant: "destructive" };
    case "chargeback_dispute":
      return { label: "Contestação em análise", variant: "destructive" };
    case "awaiting_chargeback_reversal":
      return {
        label: "Aguardando reversão da contestação",
        variant: "warning",
      };
    default:
      return fallbackStatus();
  }
};

export const getProviderRiskStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status.trim().toLowerCase()) {
    case "awaiting_risk_analysis":
      return { label: "Aguardando análise de risco", variant: "warning" };
    case "approved_by_risk_analysis":
      return { label: "Risco aprovado", variant: "success" };
    case "reproved_by_risk_analysis":
      return { label: "Risco reprovado", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};

export const getProviderRefundStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return { label: "Pendente", variant: "warning" };
    case "done":
      return { label: "Concluído", variant: "success" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelado", variant: "outline" };
    case "refunded":
      return { label: "Reembolsado", variant: "success" };
    case "partially_refunded":
      return { label: "Reembolso parcial", variant: "warning" };
    case "refund_in_progress":
      return { label: "Em processamento", variant: "warning" };
    case "refund_denied":
      return { label: "Recusado", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};

export const getRefundRequestStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "requested":
      return { label: "Solicitado", variant: "warning" };
    case "processing":
      return { label: "Processando", variant: "warning" };
    case "uncertain":
      return { label: "Resultado incerto", variant: "destructive" };
    case "failed":
      return { label: "Falhou", variant: "destructive" };
    case "confirmed":
      return { label: "Confirmado", variant: "success" };
    default:
      return fallbackStatus();
  }
};

export const getPaymentReviewStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "pending":
      return { label: "Pendente", variant: "warning" };
    case "approved":
      return { label: "Aprovada", variant: "success" };
    case "rejected":
      return { label: "Rejeitada", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};
