const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  "banner.deleted": "Banner excluído",
  "banner.saved": "Banner atualizado",
  "banners.reordered": "Banners reordenados",
  "course.created": "Curso criado",
  "course.deleted": "Curso excluído",
  "course.updated": "Curso atualizado",
  "course_publication.prepared": "Publicação preparada",
  "course_publication.published": "Conteúdo publicado",
  "enrollment.access_blocked": "Acesso bloqueado",
  "enrollment.access_restored": "Acesso restaurado",
  "enrollment.created": "Matrícula criada",
  "enrollment.deleted": "Matrícula cancelada",
  "enrollment.expiration_extended": "Prazo da matrícula estendido",
  "enrollment.expiration_reduced": "Prazo da matrícula reduzido",
  "enrollment.expiration_set": "Prazo da matrícula alterado",
  "enrollment.payment_disputed": "Acesso revogado por disputa",
  "enrollment.payment_paid": "Pagamento aprovado e acesso liberado",
  "enrollment.payment_refunded": "Acesso revogado por reembolso",
  "enrollment.updated": "Matrícula atualizada",
  "faq.created": "FAQ criado",
  "faq.deleted": "FAQ excluído",
  "faq.reordered": "Perguntas frequentes reordenadas",
  "faq.updated": "FAQ atualizado",
  "lesson.created": "Aula criada",
  "lesson.deleted": "Aula excluída",
  "lesson.updated": "Aula atualizada",
  "lesson.upserted": "Aula atualizada",
  "module.created": "Módulo criado",
  "module.deleted": "Módulo excluído",
  "module.updated": "Módulo atualizado",
  "module.upserted": "Módulo atualizado",
  "settings.updated": "Configurações globais atualizadas",
  "student.created": "Aluna cadastrada",
  "student.platform_blocked": "Aluna bloqueada na plataforma",
  "student.platform_restored": "Acesso da Aluna restaurado na plataforma",
  "student.updated": "Dados da Aluna atualizados",
};

export const getAdminAuditActionLabel = (action: string): string => {
  const label = Object.hasOwn(ADMIN_AUDIT_ACTION_LABELS, action)
    ? ADMIN_AUDIT_ACTION_LABELS[action]
    : undefined;
  return label ?? "Ação administrativa registrada";
};

export const hasAdminAuditActionLabel = (action: string): boolean =>
  Object.hasOwn(ADMIN_AUDIT_ACTION_LABELS, action);
