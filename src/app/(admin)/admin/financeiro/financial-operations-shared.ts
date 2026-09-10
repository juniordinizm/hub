const FINANCIAL_ERROR_MESSAGES: Record<string, string> = {
  "A confirmacao expirou ou ja foi utilizada.":
    "A confirmação expirou ou já foi utilizada. Comece novamente.",
  "A confirmacao digitada do pedido nao confere.":
    "A confirmação digitada do pedido não confere.",
  "A consulta Asaas nao corresponde ao Pedido informado.":
    "A consulta do Asaas não corresponde ao Pedido informado.",
  "A data inicial deve anteceder a data final.":
    "A data inicial deve anteceder a data final.",
  "Divergencia sem valor observado; concilie o pagamento antes de liberar o acesso.":
    "O valor observado não está disponível. Concilie o pagamento antes de liberar o acesso.",
  "Decisao financeira invalida.": "A decisão financeira é inválida.",
  "Informe o motivo do estorno.": "Informe o motivo do reembolso.",
  "Informe sua senha atual para continuar.":
    "Informe sua senha atual para continuar.",
  "Ja existe uma solicitacao de estorno para este pedido.":
    "Já existe uma solicitação de reembolso para este Pedido.",
  "Nao foi possivel confirmar a operacao.":
    "Não foi possível confirmar a operação.",
  "O Pedido mudou durante a conciliacao.":
    "O Pedido mudou durante a conciliação. Atualize a tela antes de tentar novamente.",
  "O período das movimentações deve estar encerrado.":
    "O período das movimentações deve estar encerrado.",
  "Pedido Asaas sem pagamento correlacionado.":
    "Este Pedido não tem pagamento Asaas correlacionado.",
  "Pedido invalido.": "O Pedido informado é inválido.",
  "Pedido sem pagamento Asaas para reembolso.":
    "Este Pedido não possui pagamento Asaas disponível para reembolso.",
  "Periodo das movimentacoes invalido.":
    "O período das movimentações é inválido.",
  "Resultado do reembolso pendente de conciliacao.":
    "O resultado do reembolso ainda não foi confirmado. Concilie o Pedido antes de tentar novamente.",
  "Solicitacao de reembolso rejeitada pelo Asaas.":
    "O Asaas recusou a solicitação de reembolso.",
  "Somente pedidos pagos podem ser estornados.":
    "Apenas Pedidos pagos podem receber reembolso.",
  asaas_refund_invalid_result:
    "O Asaas retornou um resultado de reembolso que precisa de conferência.",
};
const TECHNICAL_ERROR_RE =
  /(?:error|exception|failed|fatal|syntax|relation|column|timeout|econn|fetch|asaas_)/i;
const INTERNAL_ERROR_CODE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i;
const GENERIC_FINANCIAL_ERROR =
  "Não foi possível concluir a operação. Tente novamente ou peça a uma administradora para consultar os registros operacionais.";

export const getErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Não foi possível concluir a operação.";
  }
  const message = error.message.trim();
  const knownMessage = FINANCIAL_ERROR_MESSAGES[message];
  if (knownMessage) {
    return knownMessage;
  }
  if (
    !message ||
    TECHNICAL_ERROR_RE.test(message) ||
    INTERNAL_ERROR_CODE_RE.test(message)
  ) {
    return GENERIC_FINANCIAL_ERROR;
  }
  return message;
};

export const formatStatementDate = (value: string): string => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export type PaymentReviewType =
  | "amount_mismatch"
  | "buyer_identity"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict"
  | "uncertain_result";

export const PAYMENT_REVIEW_LABELS: Record<PaymentReviewType, string> = {
  amount_mismatch: "Divergência de valor",
  buyer_identity: "Identidade da compra requer suporte",
  event_anomaly: "Anomalia de evento",
  partial_refund: "Reembolso parcial",
  terminal_conflict: "Conflito terminal",
  uncertain_result: "Resultado incerto",
};

export const getPendingReviewInstruction = (
  type: PaymentReviewType
): string => {
  if (type === "terminal_conflict") {
    return "Reconsulte o pagamento para confirmar se o conflito permanece.";
  }
  switch (type) {
    case "event_anomaly":
      return "Reconsulte o pagamento antes de liberar ou alterar o acesso.";
    case "partial_refund":
      return "Reconsulte o pagamento para confirmar o valor do reembolso.";
    case "uncertain_result":
      return "Confirme o resultado no Asaas antes de repetir qualquer mutação.";
    default:
      return "Aguardando decisão de uma administradora.";
  }
};

export const BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE =
  "Nenhum acesso é liberado enquanto a revisão de identidade estiver pendente.";

export const REFUND_ASAAS_CONFIRMATION_MESSAGE =
  "O acesso só será atualizado quando o Asaas confirmar o reembolso.";

interface PaymentReviewReasonCopy {
  description: string;
  instruction: string;
}

const PAYMENT_REVIEW_REASON_COPY: Record<string, PaymentReviewReasonCopy> = {
  ambiguous_identifiers: {
    description:
      "Os identificadores do Asaas apontam para mais de um Pedido possível.",
    instruction:
      "Não altere o acesso; confira os identificadores antes de uma nova conciliação.",
  },
  amount_mismatch: {
    description:
      "O valor observado no Asaas não corresponde ao valor registrado no Pedido.",
    instruction:
      "Confirme os valores acima antes de decidir. Aprovar libera o acesso e aceita a divergência registrada.",
  },
  buyer_identity: {
    description:
      "A identidade da Compradora precisa ser conferida antes de qualquer liberação.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  buyer_identity_conflict: {
    description: "A identidade retornada pelo Asaas não corresponde ao Pedido.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  buyer_identity_course_revoked: {
    description: "O Curso da compra não está disponível para liberação.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  buyer_identity_invalid: {
    description:
      "Os dados da Compradora retornados pelo Asaas não puderam ser validados.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  buyer_identity_missing: {
    description:
      "O Asaas não forneceu dados suficientes para validar a Compradora.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  buyer_identity_platform_blocked: {
    description: "A Conta da Compradora está bloqueada na plataforma.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  buyer_identity_team_account: {
    description:
      "A conta de destino pertence à equipe do Hub e não pode receber o acesso da compra.",
    instruction: "Não libere acesso; solicite o reembolso integral.",
  },
  event_anomaly: {
    description: "O evento financeiro não pôde ser aplicado com segurança.",
    instruction: "Reconsulte o pagamento antes de liberar ou alterar o acesso.",
  },
  identifier_conflict: {
    description:
      "Os identificadores informados pelo Asaas entraram em conflito.",
    instruction:
      "Não altere o acesso; confira os identificadores antes de uma nova conciliação.",
  },
  installment_enrichment_pending: {
    description:
      "Os dados do parcelamento ainda não foram confirmados pelo Asaas.",
    instruction:
      "Reprocesse o enriquecimento do parcelamento antes de liberar ou alterar o acesso.",
  },
  no_correlation: {
    description: "O evento do Asaas não foi correlacionado a um Pedido.",
    instruction:
      "Não altere o acesso; confira os identificadores antes de uma nova conciliação.",
  },
  partial_refund: {
    description:
      "O Asaas informou um reembolso parcial; o valor integral ainda não foi comprovado.",
    instruction: "Reconsulte o pagamento para confirmar o valor do reembolso.",
  },
  terminal_conflict: {
    description:
      "O Pedido já está em estado terminal e a nova evidência diverge.",
    instruction:
      "Reconsulte o pagamento para confirmar se o conflito permanece.",
  },
  uncertain_result: {
    description: "O resultado da operação no Asaas ainda não foi confirmado.",
    instruction:
      "Confirme o resultado no Asaas antes de repetir qualquer mutação.",
  },
  unknown_event: {
    description: "O Asaas enviou um evento que o Hub não reconheceu.",
    instruction:
      "Não altere o acesso; confira o evento nos registros operacionais.",
  },
};

const getReviewReasonKey = (reason: string): string | null => {
  const normalizedReason = reason.trim().toLowerCase();
  if (PAYMENT_REVIEW_REASON_COPY[normalizedReason]) {
    return normalizedReason;
  }

  if (
    normalizedReason.includes("paid amount differs") ||
    normalizedReason.startsWith("valor conciliado")
  ) {
    return "amount_mismatch";
  }
  if (normalizedReason.startsWith("o pedido ja esta terminal")) {
    return "terminal_conflict";
  }
  if (normalizedReason.startsWith("a conciliacao retornou estado regressivo")) {
    return "event_anomaly";
  }
  if (normalizedReason.startsWith("a conciliacao exige revisao")) {
    return "event_anomaly";
  }
  if (normalizedReason.includes("reembolso sem evidencia")) {
    return "partial_refund";
  }
  if (normalizedReason.includes("valor liquido conciliado e invalido")) {
    return "event_anomaly";
  }
  if (normalizedReason.includes("nao possui conta correlacionada")) {
    return "event_anomaly";
  }

  return null;
};

export interface PaymentReviewReasonPresentation {
  description: string;
  instruction: string;
  technicalReason: string;
}

export const getPaymentReviewReasonPresentation = (
  reason: string,
  type: PaymentReviewType
): PaymentReviewReasonPresentation => {
  const reasonKey = getReviewReasonKey(reason);
  const copy = reasonKey ? PAYMENT_REVIEW_REASON_COPY[reasonKey] : undefined;

  return {
    description:
      copy?.description ??
      "Há uma evidência financeira que requer conferência.",
    instruction: copy?.instruction ?? getPendingReviewInstruction(type),
    technicalReason: reason.trim() || "não registrado",
  };
};

export const getReviewSubject = (review: {
  customerEmail: string | null;
  customerName: string | null;
}): string =>
  review.customerName ?? review.customerEmail ?? "Compradora não identificada";

export const getReviewOrderHref = (orderId: string): string =>
  `/admin/financeiro?tab=orders&q=${encodeURIComponent(orderId)}`;
