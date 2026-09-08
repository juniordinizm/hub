export type AdminStatusBadgeVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary";

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
      return { label: "Ativa", variant: "default" };
    case "expired":
      return { label: "Expirada", variant: "secondary" };
    case "revoked":
      return { label: "Revogada", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};

export const getCourseDeliveryStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "active":
      return { label: "Ativo", variant: "default" };
    case "draft":
      return { label: "Rascunho", variant: "outline" };
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
      return { label: "Publicado", variant: "default" };
    case "draft":
      return { label: "Rascunho", variant: "outline" };
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
      return { label: "Disponível", variant: "default" };
    case "coming_soon":
      return { label: "Em breve", variant: "secondary" };
    case "draft":
      return { label: "Rascunho", variant: "outline" };
    case "sales_paused":
      return { label: "Vendas pausadas", variant: "secondary" };
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
      return { label: "Pendente", variant: "secondary" };
    case "paid":
      return { label: "Pago", variant: "default" };
    case "refunded":
      return { label: "Reembolsado", variant: "secondary" };
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
      return { label: "Pendente", variant: "secondary" };
    case "creating":
      return { label: "Criando", variant: "secondary" };
    case "active":
      return { label: "Ativo", variant: "default" };
    case "failed":
      return { label: "Falhou", variant: "destructive" };
    case "uncertain":
      return { label: "Resultado incerto", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelado", variant: "outline" };
    case "expired":
      return { label: "Expirado", variant: "secondary" };
    default:
      return fallbackStatus();
  }
};

export const getWebhookStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "received":
      return { label: "Recebido", variant: "outline" };
    case "processing":
      return { label: "Processando", variant: "secondary" };
    case "processed":
      return { label: "Processado", variant: "default" };
    case "ignored":
      return { label: "Ignorado", variant: "outline" };
    case "retryable":
      return { label: "Aguardando nova tentativa", variant: "secondary" };
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
      return { label: "Pendente", variant: "secondary" };
    case "confirmed":
      return { label: "Confirmado", variant: "default" };
    case "received":
      return { label: "Recebido", variant: "default" };
    case "overdue":
      return { label: "Em atraso", variant: "destructive" };
    case "deleted":
      return { label: "Removido", variant: "outline" };
    default:
      return fallbackStatus();
  }
};

export const getRefundRequestStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "requested":
      return { label: "Solicitado", variant: "secondary" };
    case "processing":
      return { label: "Processando", variant: "secondary" };
    case "uncertain":
      return { label: "Resultado incerto", variant: "destructive" };
    case "failed":
      return { label: "Falhou", variant: "destructive" };
    case "confirmed":
      return { label: "Confirmado", variant: "default" };
    default:
      return fallbackStatus();
  }
};

export const getPaymentReviewStatusPresentation = (
  status: string
): AdminStatusPresentation => {
  switch (status) {
    case "pending":
      return { label: "Pendente", variant: "secondary" };
    case "approved":
      return { label: "Aprovada", variant: "default" };
    case "rejected":
      return { label: "Rejeitada", variant: "destructive" };
    default:
      return fallbackStatus();
  }
};
