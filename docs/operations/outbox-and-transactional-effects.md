---
status: runbook
owner: operations
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Outbox e efeitos transacionais

## Objetivo

Uma alteração de domínio não chama um provedor externo dentro da transação do banco. Ela grava uma intenção durável em `outbox_messages`; o consumidor entrega essa intenção depois do commit. Isso evita perder um e-mail quando o processo cai entre o commit e a chamada externa.

O contrato está em `src/features/outbox/rules.ts`, a persistência em `src/features/outbox/server.ts`, o consumidor em `src/features/outbox/runner.ts` e o adaptador Resend em `src/features/outbox/delivery.ts`.

## Catálogo aprovado

`certificate.render` é idempotente por certificado. A entrega reivindica um Certificado `pending` e `valid` com token persistido e lease de dez minutos, sem manter conexão Postgres durante o trabalho externo. Ela gera o PDF privado e tenta criá-lo com PUT condicional; uma disputa relê o objeto vencedor e usa o hash desses bytes. Depois salva hash e chave R2, muda para `ready` somente se ainda possuir o token e se o Certificado continuar válido, e só então enfileira `email.certificate-issued`. Falha recuperável libera o claim condicionalmente. O lease aplica fencing à conclusão do artefato, não execução exatamente uma vez: depois da expiração pode haver IO duplicado, mas o token antigo não sobrescreve o objeto nem altera o estado final. Uma tentativa repetida encontra o mesmo certificado/artefato e não cria novo documento ou e-mail; a unicidade da chave da outbox torna o enfileiramento do e-mail idempotente.

Falhas inesperadas de `certificate.render` usam o código operacional `certificate_render_failed`; `resend_delivery_failed` fica restrito às entregas que realmente chamam o provedor de e-mail. Ambos são recuperáveis enquanto houver tentativas.

Se a renderização esgota tentativas, a mensagem vai para `dead_letter` e o certificado fica `failed`; o reprocessamento manual autorizado devolve o certificado a `pending` antes de reentregar a mesma mensagem.

- `certificate.render`: emitido na transação de emissão; agregado `certificate`; chave `certificate.render/<certificate-id>/v1`; payload somente `certificateId`. Ele é o único evento que pode criar o PDF.
- `email.certificate-issued`: emitido somente pela entrega bem-sucedida de `certificate.render`, depois que o Certificado está `ready`; agregado `certificate`; chave `email.certificate-issued/<certificate-id>/v1`; payload somente `certificateId`.
- `email.access-released`: emitido no webhook AbacatePay quando a Conta já possui credencial; agregado `order`; chave `email.access-released/<order-id>/v1`; payload somente `userId` e `courseId`.
- `email.access-expiry-warning`: emitido pela manutenção de Matrícula; agregado `enrollment`; chave por Matrícula e janela `1d` ou `7d`; payload somente `enrollmentId` e `warningKind`.

O payload nunca contém nome, e-mail, token de redefinição, senha, chave de API ou URL secreta. O adaptador consulta os dados atuais somente no momento da entrega.

### Exceção registrada: recuperação e ativação por senha

`sendPasswordResetEmail` continua no callback do Better Auth. A URL contém um token secreto que não pode entrar no payload da outbox. Para a ativação de uma Compradora sem credencial, `processAbacatePayWebhook` solicita a redefinição após o commit, mas não cria evento de outbox.

Essa exceção não oferece retry durável nem idempotência de provedor. Para removê-la será necessário redesenhar o protocolo de token do Better Auth sem persistir segredo reutilizável. Não tente copiar a URL para `outbox_messages`.

## Entrega, concorrência e idempotência

`runOutboxWorker` é chamado por `GET /api/cron/outbox` a cada cinco minutos. A rota exige `Authorization: Bearer <CRON_SECRET>` em produção.

- A rota só executa com `SCHEDULED_JOBS_ENABLED=true` e adquire um lease
  persistente por nome de job.
- O worker reivindica uma mensagem por vez e encerra antes do prazo interno da
  função; uma nova execução retoma o backlog.
- O claim é uma atualização atômica com `FOR UPDATE SKIP LOCKED`.
- Cada mensagem recebe lease de dez minutos com `locked_at` e `locked_by`.
- Lease abandonado fica elegível novamente; dois consumidores não devem entregar a mesma linha ativa.
- Nenhuma conexão do pool permanece reservada durante PDFKit, R2 ou Resend.
- Uma mensagem é `delivered` somente depois de o adaptador confirmar a chamada ao Resend.
- Há no máximo cinco tentativas, com backoff exponencial de um minuto e jitter de até 12,5%.
- Versão desconhecida de payload ou agregado não entregável vai para `dead_letter`.

O adaptador envia a `idempotencyKey` para o Resend. O provedor conserva essa deduplicação por 24 horas. Portanto, retries automáticos permanecem dentro dessa janela.

## Dead letter e incidente

Somente Admin pode usar `retryOutbox`. A página **Admin > Auditoria** lista até 50 dead letters sem expor payload. O reprocessamento exige motivo, não permite editar payload e grava `outbox.requeued` em `audit_logs` na mesma transação.

Depois de 24 horas, o Resend não consegue mais deduplicar a mesma chave. Antes de reprocessar uma mensagem antiga, a administradora deve confirmar o estado do agregado e aceitar explicitamente o risco de e-mail duplicado. Não reprocessar automaticamente um resultado ambíguo.

1. Confira tópico, tentativas, código de erro e data da última tentativa.
2. Confirme que o Certificado ou acesso ainda está válido.
3. Para erro de versão ou agregado ausente, corrija a causa antes de reprocessar.
4. Registre motivo no formulário; o sistema reativa uma vez a mesma mensagem.
5. Confira a próxima execução do cron e o estado final.

A Administração do Hub é a dona operacional de dead letters e incidentes de e-mail.

## Retenção

Cada execução do consumidor remove:

- mensagens `delivered` há mais de 30 dias;
- mensagens `dead_letter` cuja última falha tem mais de 180 dias;
- auditorias `outbox.requeued` com mais de 180 dias.

Essa retenção cobre somente a outbox e sua auditoria operacional. Não autoriza apagar auditorias financeiras, dados de Conta ou outros registros sujeitos a política jurídica própria.

## Evidências

- schema e migrations: `outboxMessages` em `src/db/schema.ts`, `0023_lyrical_lucky_pierre.sql` e `0024_light_stature.sql`;
- transações: `completeLesson`, `processAbacatePayWebhook` e `processEnrollmentMaintenance`;
- testes: `src/features/outbox/*.test.ts`, `outbox.integration.test.ts` e `certificate-issuance.integration.test.ts`;
- provedor: [documentação de idempotência da Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Todo tópico novo precisa definir versão de payload, chave idempotente, dona operacional, retenção, classificação de PII e runbook antes de ser gravado na outbox.
