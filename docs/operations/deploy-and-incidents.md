---
status: runbook
owner: operations
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Deploy e incidentes

## Gate de deploy

Deploy não deve avançar quando:

- há mudança de schema enquanto o bloqueio de migrations não foi resolvido;
- `docs:check`, testes, typecheck, check ou build falham;
- variáveis obrigatórias não estão presentes no ambiente alvo;
- endpoint/segredo de webhook ou crons não foram conferidos;
- mudança irreversível não possui recuperação testada.

### CI e verificação

O bloqueio histórico de `page-source.test.ts` foi removido: o estado de processamento de vídeo é
testado pelo componente renderizado. A sequência de gates, o banco efêmero e as jornadas de navegador
estão no [runbook de testes e CI](testing-and-ci.md). A primeira execução remota permanece dependente
da configuração de `NEON_API_KEY` e `NEON_PROJECT_ID` no GitHub, sem reutilizar credenciais de produção.

## Checklist

### Código

1. `bun run docs:check`
2. `bun run test`
3. `bun run typecheck`
4. `bun run check`
5. `bun run build`
6. `bun run knip`
7. `git diff --check`

### Ambiente

- URLs públicas: `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CERTIFICATE_PUBLIC_BASE_URL`;
- banco: `DATABASE_URL` pooled e `DATABASE_URL_DIRECT` direto, sem expor valores;
- auth: `BETTER_AUTH_SECRET`, origens confiáveis e Infra opcional;
- e-mail: `RESEND_API_KEY`, domínio/remetente verificado, `SUPPORT_EMAIL`;
- AbacatePay: chave canônica, base v2, segredo e endpoint HTTPS;
- JMVStream: `JMVSTREAM_AUTH_RESOURCE` UUID, token fallback opcional e plan ID; não usar e-mail/senha;
- R2: conta, dois buckets, chave, domínio público e CORS;
- crons: `CRON_SECRET`;
- privacidade: manter `DATA_RETENTION_ENABLED=false` sem referência jurídica aprovada.

### Banco

Sem alteração de schema, confirmar compatibilidade do ambiente. Com alteração de schema, interromper: o processo atual está bloqueado em [Banco e migrations](database-and-migrations.md).

### Crons

Conferir no provedor:

- `/api/cron/enrollments`: `0 10 * * *`;
- `/api/cron/jmvstream`: `*/5 * * * *`;
- `/api/cron/retention`: `0 4 * * *`;
- Bearer token igual a `CRON_SECRET`;
- última execução e resposta.

### Smoke test

- `/api/health`;
- login e recuperação de senha em conta de teste;
- catálogo e Aula com acesso;
- painel conforme papel;
- checkout em modo seguro/teste;
- webhook de teste e deduplicação;
- upload pequeno JMVStream e sync;
- upload/download R2 e imagem pública;
- validação pública de Certificado;
- cron manual autorizado em ambiente de teste.

Infraestrutura externa não é comprovada pelo repositório. Registre data, ambiente e operadora da conferência.

## Rollback

- aplicação: reimplantar versão anterior compatível com o mesmo schema;
- variáveis: restaurar valor anterior sem registrar secret em ticket;
- provedor: desabilitar somente a capacidade afetada quando o produto permitir;
- banco: não usar `db:reset`; fazer forward-fix ou plano SQL revisado;
- mídia: não apagar objetos até confirmar referências.

## Runbooks de incidente

### Pagamento/webhook

1. Identifique Pedido e evento externo.
2. Verifique autenticação, `webhook_events` e revisão.
3. Compare snapshot de valor/estado.
4. Confira Concessão/Matrícula.
5. Retry apenas com `retryWebhook`; não libere acesso manualmente sem registrar origem.

### Reembolso

1. Confirme `refund_requests` e ID externo.
2. Confira evento de confirmação.
3. Não revogue por timeout da chamada.
4. Escale conflito para revisão financeira.

### JMVStream

1. Verifique sessão/ativo local e hash.
2. Separe falha de parte, complete, processamento, sync ou delete.
3. Preserve ETags e IDs.
4. Use sync/retry específico; não reinicie upload completo sem conferir sessão.
5. Trate divergência `gallery` como bloqueio de contrato.

### R2

1. Identifique bucket/chave, sem URL assinada completa.
2. HEAD no privado; GET no público quando aplicável.
3. Confira CORS, domínio e publicação.
4. Reconcile cópia/registro; não faça limpeza ampla.

### E-mail

1. Determine se a transação de banco concluiu.
2. Verifique erro Resend pelo ID, sem conteúdo sensível.
3. Reenvie somente após avaliar duplicidade; código não usa idempotency key/outbox.
4. Para acesso/Certificado, confirme estado no Hub antes do reenvio.

### Cron

1. Confira agenda, Bearer e status HTTP.
2. Rode manualmente apenas em ambiente seguro.
3. Verifique idempotência e registros antes de repetir.
4. Retenção permanece desligada sem aprovação jurídica.

### Certificado e privacidade

1. Certificado: localizar código, status e cadeia de reemissão; nunca editar snapshot diretamente.
2. Privacidade: confirmar solicitação, aprovação, permissão e referência jurídica.
3. Anonimização é irreversível; não executar como teste.

## Registro mínimo do incidente

Horário UTC, ambiente, capacidade, IDs internos/externos não sensíveis, impacto, decisão, comandos/ações, resultado, dona da próxima ação e necessidade de post-mortem.
