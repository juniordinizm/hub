---
status: canonical
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Certificados e dados técnicos

## Certificados

Certificado preserva código público, Conta, Curso, publicação interna de origem, data, carga horária e snapshots de nome e título. Seus estados são `valid` e `revoked`.

### REG-DAT-001 Emissão exige conclusão e unicidade válida

`issueManualCertificate` cria `CourseCompletion` se ela ainda não existir. `completeLesson` cria a primeira conclusão e pode emitir automaticamente quando todas as Aulas obrigatórias da publicação vigente estão concluídas.

**Invariantes:** `CourseCompletion` é única por Conta e Curso; o código público é único; não há segundo Certificado válido para a mesma Conta e Curso sem lifecycle explícito; Certificado revogado bloqueia emissão automática; snapshots e a publicação de origem preservam o texto emitido. Publicação posterior não reabre a conclusão nem gera novo certificado automaticamente.

**Concorrência:** `tryIssueAutomaticCompletionCertificate` usa `INSERT ... ON CONFLICT DO NOTHING RETURNING code`. Somente a transação vencedora solicita e-mail, gravando `email.certificate-issued` na outbox sem PII. Veja [Outbox](../operations/outbox-and-transactional-effects.md).

### REG-DAT-002 Revogação preserva histórico

`revokeCertificate` altera estado, categoria, detalhe interno, autoria e data; não apaga o registro. Admin e Suporte podem emitir, revogar e reemitir com confirmação e motivo. A consulta pública mostra estado, data e categoria legível, nunca detalhe, autoria ou evidências.

### REG-DAT-003 Reemissão cria nova evidência

`reissueCertificate` revoga o anterior e cria novo código e snapshots, mantendo vínculo auditável. As categorias canônicas são `identity_correction`, `course_snapshot_correction`, `duplicate_or_technical_issue`, `eligibility_correction`, `integrity_review`, `legal_or_compliance` e `other`; `other` exige detalhe interno. Veja [DEC-DISC-006](../decisions.md#dec-disc-006) e [ADR-0006](../adr/0006-certificate-lifecycle.md).

### REG-DAT-004 Consulta pública é limitada

`consumePublicCertificateLookup`, em `src/features/certificates/public-rate-limit.ts`, aplica limite antes de `getCertificateByCode`. Código inexistente não revela outros Certificados da pessoa.

## Dados técnicos e manutenção

### REG-DAT-005 Não existe workflow de solicitações de dados

O Hub não expõe página, API, cron, permissão ou tabela para registrar, aprovar ou executar solicitações de dados. Não há política jurídica formal, caso operacional recorrente nem garantia de uma anonimização correta para justificar manter esse mecanismo inativo.

Uma solicitação real é um incidente excepcional: registrar o caso no canal operacional apropriado, preservar evidências e buscar orientação jurídica antes de alterar dados. Não há anonimização parcialmente implementada disponível para ser acionada.

### REG-DAT-006 Manutenção técnica tem retenção limitada

`runMaintenance`, em `src/features/maintenance/server.ts`, executa diariamente por `GET /api/cron/maintenance`, protegido por `CRON_SECRET`. A rotina não é um mecanismo de direitos de dados nem afirma conformidade LGPD. Ela apenas:

- remove sessões expiradas;
- remove limites expirados da consulta pública de certificados;
- consolida eventos de analytics anteriores ao dia atual em métricas diárias;
- remove eventos brutos de analytics após 90 dias e métricas diárias após 13 meses.

As preferências de analytics da Aluna estão em [Aprendizagem e progresso](learning-content-and-progress.md). Base legal, canal de direitos, retenção de registros financeiros e qualquer anonimização exigem decisão jurídica futura.

## Concorrência e falhas

- emissão e intenção de e-mail compartilham transação; falha ao gravar a outbox desfaz emissão;
- reemissões concorrentes exigem revisão do estado final;
- a manutenção é idempotente: agregados diários usam upsert e exclusões por prazo podem ser repetidas;
- a falha do cron é observável como `maintenance_cron_failed`; dados antigos permanecem até uma execução posterior.

## Evidências

- schema: `certificates`, `publicCertificateRateLimits`, `learningAnalyticsEvents`, `learningAnalyticsDailyMetrics` em `src/db/schema.ts`;
- certificados: `src/features/certificates/server.ts`, `src/features/certificates/rules.ts`;
- manutenção: `src/features/maintenance/server.ts`, `src/app/api/cron/maintenance/route.ts`;
- testes: `src/features/certificates/*.test.ts`, `src/features/maintenance/server.test.ts`.

## Pendências

- definir política jurídica de retenção, direitos de dados e anonimização antes de criar novo workflow;
- recovery/ativação por senha permanece fora da outbox porque contém token secreto;
- infraestrutura de cron e base legal de produção não foram verificadas externamente.
