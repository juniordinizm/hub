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
- `email.access-released`: emitido pelo processor financeiro quando a Conta já possui
  credencial; agregado `order`; chave `email.access-released/<order-id>/v1`; payload
  somente `userId` e `courseId`.
- `email.access-expiry-warning`: emitido pela manutenção de Matrícula; agregado `enrollment`; chave por Matrícula e janela `1d` ou `7d`; payload somente `enrollmentId` e `warningKind`.
- `auth.account-activation`: intenção emitida pelo processor Asaas quando a Conta
  vinculada ao Pedido pago ainda não possui credential; agregado `order`; chave
  `auth.account-activation/<order-id>/v1`; payload exatamente `userId` e `orderId`.

O payload nunca contém nome, e-mail, token de redefinição, senha, chave de API ou URL secreta. O adaptador consulta os dados atuais somente no momento da entrega.

### Ativação de Conta

`sendPasswordResetEmail` continua no callback do Better Auth. A URL contém token secreto e
nunca entra na outbox. O delivery de `auth.account-activation` exige Pedido Asaas `paid`,
`orders.user_id` igual ao payload e Conta existente. Ele resolve o e-mail atual da Conta e
chama `requestPasswordReset` com `/redefinir-senha`; se credential já existe, conclui como
no-op sem enviar `email.access-released`.

Antes de chamar Better Auth, o delivery deriva por HMAC-SHA256 uma chave opaca e estável
da `idempotencyKey` da outbox com `BETTER_AUTH_SECRET`. Um header interno transporta
somente essa chave derivada. O callback exige digest e tag HMAC no formato estrito
`auth-account-activation-v1-<digest-hex>-<tag-hex>`, valida a tag com o secret e encaminha
a chave ao Resend somente quando também existe um contexto assíncrono local associado à
mesma chave. Recuperação pública, header ausente, valor forjado ou chave sem contexto
correspondente continuam no caminho normal, sem chave de idempotência.

Better Auth cria e persiste o token, chama o callback e captura qualquer erro de envio
antes de resolver `requestPasswordReset`; Conta inexistente também resolve sem chamar o
callback. Por isso, sucesso da API isoladamente não confirma entrega. O delivery abre um
contexto `AsyncLocalStorage` contendo apenas chave HMAC e resultado, chama a API e exige
que o callback tenha registrado sucesso. Falha de Resend ou allowlist, callback ausente e
Conta não encontrada deixam a intenção retryable como `account_activation_failed`.
Contextos concorrentes são isolados e não guardam e-mail, token, URL ou payload.
Quando o contexto interno está ativo, o callback registra a falha e lança ao Better Auth
somente `account_activation_email_delivery_failed`, sem causa nem mensagem do provedor;
o caminho público continua propagando seu erro original para o tratamento público.

Pedido inelegível usa `aggregate_not_deliverable`, sem retry. Falha do Better Auth usa
`account_activation_failed`, com retry e sem causa ou PII. O fluxo legado AbacatePay ainda
solicita ativação fora da outbox; o processor Asaas enfileira esta intenção quando
`activationRequired=true`.

## Entrega, concorrência e idempotência

`runOutboxWorker` é chamado por `GET /api/cron/outbox` a cada cinco minutos. A rota exige `Authorization: Bearer <CRON_SECRET>` em produção.
O worker da inbox Asaas é separado da outbox e roda por
`GET /api/cron/asaas-webhooks` a cada minuto, mas reutiliza o mesmo guard de
`CRON_SECRET`, kill switch e padrão de lease/deadline.

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

O adaptador envia a `idempotencyKey` para o Resend. Em
`auth.account-activation`, retries do Better Auth geram novos tokens válidos, mas usam a
mesma chave Resend derivada enquanto a intenção da outbox for a mesma. Como a URL muda, o
Resend responde `invalid_idempotent_request` ao payload diferente dentro de 24 horas; para
uma chave de ativação no formato estrito, o adaptador considera esse resultado satisfeito,
pois a chave confirma que o primeiro e-mail foi aceito e o token anterior permanece
válido. Outros erros continuam falhando. Depois de 24 horas o provedor esquece a chave e
um retry pode enviar outro e-mail. A entrega é ao menos uma vez e não promete execução
exatamente uma vez além da janela.

## Dead letter e incidente

Somente Admin pode usar `retryOutbox`. A página **Admin > Auditoria** lista até 50 dead letters sem expor payload. O reprocessamento exige motivo, não permite editar payload e grava `outbox.requeued` em `audit_logs` na mesma transação.

Depois de 24 horas, o Resend não consegue mais deduplicar a mesma chave. Antes de reprocessar uma mensagem antiga, a administradora deve confirmar o estado do agregado e aceitar explicitamente o risco de e-mail duplicado. Não reprocessar automaticamente um resultado ambíguo.

1. Confira tópico, tentativas, código de erro e data da última tentativa.
2. Confirme que o Certificado ou acesso ainda está válido.
3. Para erro de versão ou agregado ausente, corrija a causa antes de reprocessar.
4. Registre motivo no formulário; o sistema reativa uma vez a mesma mensagem.
5. Confira a próxima execução do cron e o estado final.

A Administração do Hub é a dona operacional de dead letters, inclusive
`auth.account-activation`, e incidentes de e-mail.

## Retenção

Cada execução do consumidor remove:

- mensagens `delivered` há mais de 30 dias;
- mensagens `dead_letter` cuja última falha tem mais de 180 dias;
- auditorias `outbox.requeued` com mais de 180 dias.

Essa retenção cobre somente a outbox e sua auditoria operacional. Não autoriza apagar auditorias financeiras, dados de Conta ou outros registros sujeitos a política jurídica própria.

Todos os tópicos usam a outbox existente. `auth.account-activation` é classificado como
payload sem PII por conter somente identificadores locais; segue a mesma retenção de 30
dias para `delivered` e 180 dias para `dead_letter`.

## Evidências

- schema e migrations: `outboxMessages` em `src/db/schema.ts`, `0023_lyrical_lucky_pierre.sql` e `0024_light_stature.sql`;
- transações: `completeLesson`, `processAbacatePayWebhook` e `processEnrollmentMaintenance`;
- testes: `src/features/outbox/*.test.ts`, `outbox.integration.test.ts` e `certificate-issuance.integration.test.ts`;
- idempotência de ativação: `src/lib/account-activation-idempotency.ts`,
  `src/lib/auth-password-reset.ts` e testes correspondentes;
- provedor: [documentação de idempotência da Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Todo tópico novo precisa definir versão de payload, chave idempotente, dona operacional, retenção, classificação de PII e runbook antes de ser gravado na outbox.
