---
status: runbook
owner: operations
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Deploy e incidentes

## Gate de deploy

Não avance quando houver migration sem validação controlada, falha em `docs:check`, testes, typecheck, check ou build, variável obrigatória ausente, webhook/cron não conferido ou mudança irreversível sem recuperação revisada.

### Checklist de código

1. `bun run docs:check`
2. `bun run test`
3. `bun run typecheck`
4. `bun run check`
5. `bun run build`
6. `bun run knip`
7. `git diff --check`

### Checklist de ambiente

- URLs: `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CERTIFICATE_PUBLIC_BASE_URL`;
- banco: `DATABASE_URL` pooled e `DATABASE_URL_DIRECT` direto;
- auth: `BETTER_AUTH_SECRET` e origens confiáveis;
- e-mail: `RESEND_API_KEY`, remetente/domínio e `SUPPORT_EMAIL`;
- pagamentos: chave, base v2, segredo e endpoint HTTPS AbacatePay;
- vídeo: `JMVSTREAM_AUTH_RESOURCE`, token fallback opcional e plan ID;
- R2: conta, dois buckets, chave, domínio público e CORS;
- crons: `CRON_SECRET`, incluindo manutenção;
- Sentry/readiness: DSNs e `HEALTHCHECK_SECRET` quando aplicáveis.

## Banco

Com alteração de schema, valide migration forward em banco descartável, audite o alvo e aplique uma única vez com URL direta e aprovação explícita. Em seguida audite journal/catálogo e execute o migrador outra vez. Nunca use `db:push`, `db:reset` ou rollback destrutivo. Ver [Banco e migrations](database-and-migrations.md).

## Crons

Conferir no provedor:

- `/api/cron/enrollments`: `0 10 * * *`;
- `/api/cron/jmvstream`: `*/5 * * * *`;
- `/api/cron/outbox`: `*/5 * * * *`;
- `/api/cron/maintenance`: `0 4 * * *`;
- Bearer igual a `CRON_SECRET`;
- última execução e resposta.

Manutenção técnica expira sessões/rate limits e aplica a retenção de analytics. Não há cron, inbox ou execução de anonimização.

## Smoke test

- liveness e readiness com bearer, sem detalhes de dependência;
- login e recuperação de senha em Conta de teste;
- catálogo, Aula e painel conforme papel;
- checkout seguro, webhook de teste e deduplicação;
- upload/sync JMVStream e upload/download R2;
- consulta pública de Certificado;
- execução manual autorizada de cada cron em ambiente de teste.

Infraestrutura externa não é comprovada pelo repositório. Registre ambiente, data e operadora da conferência.

## Rollback

- aplicação: reimplantar versão anterior compatível com mesmo schema;
- variáveis: restaurar valor anterior sem registrar segredo;
- banco: forward-fix revisado, nunca reset;
- mídia: preservar objetos até confirmar referências.

## Runbooks de incidente

### Pagamento/webhook

1. Identifique Pedido e evento externo.
2. Verifique autenticação, `webhook_events` e revisão.
3. Compare snapshot de valor/estado e Concessão/Matrícula.
4. Use `retryWebhook` somente com registro de motivo.

### JMVStream e R2

1. Isole sessão/ativo local e hash ou bucket/chave.
2. Diferencie parte, complete, processamento, sync, delete, CORS e publicação.
3. Preserve ETags e IDs; não reinicie upload ou limpeza ampla sem conferir estado.
4. Trate divergência `gallery` como bloqueio de contrato.

### E-mail e outbox

1. Confirme commit do banco.
2. Consulte dead letter em **Admin > Auditoria** para Certificado, acesso e expiração.
3. Verifique tópico, tentativas, código e estado atual sem expor payload.
4. Reprocesse com motivo; após 24 horas o Resend pode duplicar resultado ambíguo.

### Manutenção, banco e recuperação

1. Confira agenda, Bearer, status e `correlationId`; nunca registre o bearer.
2. Confirme pool runtime, URL direta e journal antes de diagnosticar schema.
3. Para indisponibilidade, restaure aplicação compatível ou aplique forward-fix revisado.
4. Para ensaio de restore, use branch isolada e siga [Observabilidade e recuperação](observability-and-recovery.md#ensaio-de-recuperação).

## Registro mínimo

Horário UTC, ambiente, capacidade, IDs internos/externos não sensíveis, impacto, decisão, comandos/ações, resultado, responsável pela próxima ação e necessidade de post-mortem.
