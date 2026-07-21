---
status: canonical
owner: engineering
last_verified_commit: 2df4996ac4875bf48f425a7e3456f3c8ac1fc3aa
---

# Certificados e direitos de dados

## Certificados

Certificado preserva código público, Conta, Curso, data, carga horária e snapshots de nome/título. Estados: `valid` e `revoked`.

### REG-DAT-001 Emissão exige conclusão e unicidade válida

`canIssueCertificate` e `issueManualCertificate` validam elegibilidade. `completeLesson` pode emitir automaticamente ao concluir todas as Aulas ativas.

**Invariantes:**

- Curso precisa ter Aulas e todas devem estar concluídas;
- código público é único;
- não se cria outro Certificado válido para a mesma Conta + Curso sem lifecycle explícito;
- Certificado revogado bloqueia emissão automática; somente reemissão manual pode criar o próximo Certificado válido;
- snapshots preservam o texto emitido.

**Concorrência:** `completeLesson` chama `tryIssueAutomaticCompletionCertificate`, que usa
`INSERT ... ON CONFLICT DO NOTHING RETURNING code`.
Somente a transação que recebeu a linha retornada define `certificateIssued=true` e pode solicitar
o e-mail. Essa mesma transação grava `email.certificate-issued` em `outbox_messages`; a entrega ocorre
somente após o commit. O payload guarda o ID do Certificado, nunca e-mail ou nome. Veja o
[runbook de outbox](../operations/outbox-and-transactional-effects.md).

### REG-DAT-002 Revogação preserva histórico

`revokeCertificate` muda status, categoria e detalhe do motivo, autoria e data; não apaga o registro. Admin e Suporte podem emitir, revogar e reemitir, sempre com confirmação e motivo. A validação pública deixa de tratar o código revogado como válido e informa estado, data e categoria do motivo; detalhe, autoria e evidências ficam internos.

### REG-DAT-003 Reemissão cria nova evidência

`reissueCertificate` revoga o anterior e emite novo código/snapshots. O vínculo permite auditoria do ciclo; não se reutiliza silenciosamente o código antigo.

As categorias canônicas de motivo são `identity_correction`, `course_snapshot_correction`, `duplicate_or_technical_issue`, `eligibility_correction`, `integrity_review`, `legal_or_compliance` e `other`. `other` exige detalhe interno. Veja [DEC-DISC-006](../decisions.md#dec-disc-006) e [ADR-0006](../adr/0006-certificate-lifecycle.md).

### REG-DAT-004 Consulta pública é limitada

`consumePublicCertificateLookup`, em `src/features/certificates/public-rate-limit.ts`, registra janela/contagem em `public_certificate_rate_limits` antes de `getCertificateByCode`.

**Falhas:** excesso retorna limitação; código ausente não revela se uma pessoa possui outros Certificados.

## Solicitações de dados

Estados: `requested`, `approved`, `completed`, `rejected`.

### REG-DAT-005 Solicitação e execução são etapas separadas

`registerPrivacyRequest` registra intenção; `approvePrivacyRequest` registra decisão; `executePrivacyAnonymization` executa somente solicitação aprovada.
Cada criação ou aprovação usa o mesmo `PoolClient` para a mudança de estado e seu `audit_logs`; falha na auditoria desfaz a mudança.

**Autorização vigente:**

- `managePrivacyRequests`: Admin e Suporte podem registrar solicitação;
- `approvePrivacyRequest`: somente Admin aprova uma solicitação que não criou;
- `executePrivacyAnonymization`: outro Admin executa somente solicitação aprovada, desde que não a tenha criado nem aprovado.

**Invariantes:**

- execução exige flag de retenção, referência jurídica formal e os três papéis separados;
- histórico financeiro e operacional não deve ser apagado por atalho;
- anonimização não equivale a exclusão universal;
- conclusão/falha precisa ser auditável.

### REG-DAT-006 Retenção automática é opt-in e limitada

`runDataRetention`, em `src/features/privacy/server.ts`, só executa quando `DATA_RETENTION_ENABLED=true` e `LEGAL_APPROVAL_REFERENCE` está configurada. O cron atual limpa dados técnicos vencidos, como sessões expiradas e janelas de rate limit; não implementa uma política geral de retenção para todas as tabelas.

Não afirmar conformidade LGPD com base somente nessa rotina. Prazo, base legal, exceções e categorias exigem aprovação jurídica.

## Concorrência e falhas

- emissão deve ocorrer em transação com a conclusão para evitar duplicidade;
- emissão e intenção de e-mail compartilham a transação; falha ao gravar a outbox desfaz a emissão;
- reemissões concorrentes exigem revisão do estado final;
- anonimização é irreversível do ponto de vista operacional e nunca deve ser habilitada sem referência jurídica verificável;
- cron de retenção deve ser idempotente.

## Evidências

- schema: `certificates`, `privacyRequests`, `publicCertificateRateLimits`;
- implementação: `src/features/certificates/server.ts`, `src/features/certificates/rules.ts`, `src/features/privacy/server.ts`;
- ações: `src/features/certificates/actions.ts`, `src/features/privacy/actions.ts`;
- rotas: `src/app/certificados/[code]`, `src/app/api/cron/retention/route.ts`;
- testes: `src/features/certificates/*.test.ts`, testes de ambiente em `src/lib/env.test.ts`.

## Pendências

- definir política jurídica de retenção e anonimização;
- recovery/ativação por senha permanece fora da outbox por conter token secreto;
- infraestrutura de cron e base legal de produção não verificadas.
