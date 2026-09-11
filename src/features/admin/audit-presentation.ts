const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  "banner.deleted": "Banner excluído",
  "banner.created": "Banner criado",
  "banner.saved": "Banner atualizado",
  "banner.updated": "Banner atualizado",
  "banners.reordered": "Banners reordenados",
  "asaas.payment_reconciled": "Pagamento reconciliado no Asaas",
  "asaas.statement_imported": "Extrato Asaas importado",
  "asaas_webhook.correlation_alert": "Alerta de correlação de webhook",
  "asaas_webhook.requeued": "Webhook reenfileirado",
  "certificate.artifact_reconciled": "Artefato do Certificado reconciliado",
  "certificate.disabled": "Certificados desativados",
  "certificate.enabled": "Certificados habilitados",
  "certificate.issued": "Certificado emitido",
  "certificate.reissued": "Certificado reemitido",
  "certificate.revoked": "Certificado revogado",
  "certificate.revoked_for_reissue": "Certificado revogado para reemissão",
  "certificate.template_draft_saved": "Rascunho do modelo salvo",
  "certificate.template_published": "Modelo de Certificado publicado",
  "course.created": "Curso criado",
  "course.deleted": "Curso excluído",
  "course.availability_changed": "Disponibilidade do Curso alterada",
  "course.updated": "Curso atualizado",
  "course_content.reorder_lessons": "Aulas reordenadas",
  "course_content.reorder_modules": "Módulos reordenados",
  "course_publication.draft_created": "Rascunho de publicação criado",
  "course_publication.prepared": "Publicação preparada",
  "course_publication.published": "Conteúdo publicado",
  "enrollment.access_blocked": "Acesso bloqueado",
  "enrollment.access_restored": "Acesso restaurado",
  "enrollment.created": "Matrícula criada",
  "enrollment.deleted": "Matrícula cancelada",
  "enrollment.expiration_extended": "Prazo da matrícula estendido",
  "enrollment.expiration_reduced": "Prazo da matrícula reduzido",
  "enrollment.expiration_set": "Prazo da matrícula alterado",
  "enrollment.access_manual_block_removed": "Bloqueio manual removido",
  "enrollment.access_manually_blocked": "Acesso bloqueado manualmente",
  "enrollment.content_full_access_granted": "Acesso integral concedido",
  "enrollment.content_release_scheduled": "Liberação de conteúdo agendada",
  "enrollment.expiration_adjustment_reversed": "Ajuste de validade revertido",
  "enrollment.manual_access_granted": "Acesso manual concedido",
  "enrollment.payment_disputed": "Acesso revogado por disputa",
  "enrollment.payment_paid": "Pagamento aprovado e acesso liberado",
  "enrollment.payment_refunded": "Acesso revogado por reembolso",
  "enrollment.updated": "Matrícula atualizada",
  "faq.created": "FAQ criado",
  "faq.deleted": "FAQ excluído",
  "faq.reordered": "Perguntas frequentes reordenadas",
  "faq.saved": "FAQ atualizado",
  "faq.updated": "FAQ atualizado",
  "lesson.created": "Aula criada",
  "lesson.deleted": "Aula excluída",
  "lesson.updated": "Aula atualizada",
  "lesson.upserted": "Aula atualizada",
  "lesson.video_removed": "Vídeo da Aula removido",
  "lessons.reordered": "Aulas reordenadas",
  "module.created": "Módulo criado",
  "module.deleted": "Módulo excluído",
  "module.updated": "Módulo atualizado",
  "module.upserted": "Módulo atualizado",
  "modules.reordered": "Módulos reordenados",
  "maintenance.executed": "Manutenção executada",
  "outbox.requeued": "Mensagem reenfileirada",
  "payment_review.resolved": "Revisão financeira resolvida",
  "refund.password_confirmed": "Confirmação de reembolso registrada",
  "refund.rejected": "Reembolso rejeitado",
  "refund.requested": "Reembolso solicitado",
  "refund.uncertain": "Reembolso em estado incerto",
  "settings.updated": "Configurações globais atualizadas",
  "student.created": "Aluno cadastrado",
  "student.platform_blocked": "Aluno bloqueado na plataforma",
  "student.platform_restored": "Acesso do Aluno restaurado na plataforma",
  "student.updated": "Dados do Aluno atualizados",
};

export const getAdminAuditActionLabel = (action: string): string => {
  const label = Object.hasOwn(ADMIN_AUDIT_ACTION_LABELS, action)
    ? ADMIN_AUDIT_ACTION_LABELS[action]
    : undefined;
  if (label) {
    return label;
  }
  if (action.startsWith("financial.")) {
    return `Evento financeiro: ${action
      .slice("financial.".length)
      .replaceAll("_", " ")
      .toLocaleLowerCase("pt-BR")}`;
  }
  return "Ação administrativa registrada";
};

export const hasAdminAuditActionLabel = (action: string): boolean =>
  Object.hasOwn(ADMIN_AUDIT_ACTION_LABELS, action) ||
  action.startsWith("financial.");
