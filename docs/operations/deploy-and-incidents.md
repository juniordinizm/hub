---
status: runbook
owner: operations
last_verified_commit: 72600abe9f85e945b15b6d81db5fb259bff22d7e
---

# Deploy e incidentes

## Modelo de release no Coolify

O artefato de produção é a imagem `linux/arm64` publicada pela CI em
`ghcr.io/<owner>/<repositorio>:<git-sha>`. O Coolify consome a imagem pronta;
não compila o repositório e não usa tag mutável `latest`.

- build: Bun `1.3.11`, `next build` standalone e chave estável de Server
  Actions fornecida como secret do BuildKit;
- runtime: Node `24.18.0` em Debian/glibc, usuário sem privilégios e porta
  interna `3000`;
- version skew: `DEPLOYMENT_VERSION=<git-sha>` alimenta `deploymentId`; releases
  que podem coexistir precisam usar a mesma
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` no build;
- saúde: o `HEALTHCHECK` da imagem consulta
  `GET /api/health/ready` com `HEALTHCHECK_SECRET`, comprovando processo, banco
  e migration mínima sem gravar o segredo nos metadados da imagem;
- operações deliberadas: a imagem inclui `run-scheduled-job.mjs`,
  `migrate-production.mjs` e a cadeia SQL versionada.

No GitHub, configure os secrets `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` e,
opcionalmente, `SENTRY_AUTH_TOKEN`; configure as variables
`PRODUCTION_APP_URL`, `R2_PUBLIC_BASE_URL` e, opcionalmente,
`NEXT_PUBLIC_SENTRY_DSN`. A CI recusa publicar na `main` sem chave estável,
URL pública ou origem R2. O token de leitura do pacote GHCR pertence ao
registro privado configurado no servidor Coolify, não ao container.

No Coolify, crie uma aplicação **Docker Image**, exponha apenas a porta interna
`3000`, associe o domínio HTTPS e fixe a tag no SHA publicado. Não crie
`ports_mappings` para a internet: o tráfego entra somente pelo Traefik. O
Dockerfile já possui health check autenticado de readiness; preserve
`HEALTHCHECK_SECRET` no runtime e não duplique o segredo na configuração do
check.
Use uma instância durante o primeiro release. Rolling update só é seguro com a
chave estável e migrations expand/contract.

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
- banco web: somente `DATABASE_URL` pooled;
- job de migration: somente `DATABASE_URL_DIRECT`, nunca persistida no
  container web;
- auth: `BETTER_AUTH_SECRET` e origens confiáveis;
- e-mail: `RESEND_API_KEY`, remetente/domínio e `SUPPORT_EMAIL`;
- pagamentos: chave, base v2, segredo e endpoint HTTPS AbacatePay;
- vídeo: `JMVSTREAM_AUTH_RESOURCE`, token fallback opcional e plan ID;
- R2: conta, dois buckets, chave, domínio público e CORS;
- crons: `CRON_SECRET`, incluindo manutenção;
- Sentry/readiness: DSNs e `HEALTHCHECK_SECRET` quando aplicáveis.

O processo Node valida o contrato completo antes de aceitar tráfego. Não
configure no web container `DATABASE_URL_DIRECT`, `INTERNAL_BOOTSTRAP_SECRET`
nem variáveis E2E. `SENTRY_AUTH_TOKEN`,
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` e `DEPLOYMENT_VERSION` são entradas de
build, não segredos de runtime.

## Banco

Com alteração de schema, valide migration forward em banco descartável, audite
o alvo e aplique uma única vez com URL direta e aprovação explícita. Execute
`bun run db:migrate:production` em uma job isolada ou
`node /app/migrate-production.mjs` em um container one-shot da mesma imagem.
O comando usa advisory lock; não o execute no startup do web container. Em
seguida audite journal/catálogo e execute o migrador outra vez. Nunca use
`db:push`, `db:reset` ou rollback destrutivo. Ver
[Banco e migrations](database-and-migrations.md).

## Crons

O contrato autoritativo vive em `src/config/scheduled-jobs.ts`. No Coolify,
cadastre Scheduled Tasks em UTC com os comandos abaixo:

- `0 10 * * *`: `node /app/run-scheduled-job.mjs enrollments`;
- `*/5 * * * *`: `node /app/run-scheduled-job.mjs jmvstream`;
- `*/5 * * * *`: `node /app/run-scheduled-job.mjs outbox`;
- `0 4 * * *`: `node /app/run-scheduled-job.mjs maintenance`;
- timeout da tarefa no Coolify: 10 minutos para `enrollments` e `maintenance`; 4 minutos para `jmvstream` e `outbox`;
- Bearer igual a `CRON_SECRET`;
- última execução, duração, status e alerta de falha.

Manutenção técnica expira sessões/rate limits e aplica a retenção de analytics. Não há cron, inbox ou execução de anonimização.
O runner aplica timeout por tarefa e retorna código diferente de zero em erro.
O Coolify não deve iniciar retry paralelo: repita somente depois do término ou
timeout anterior. Outbox e manutenções são idempotentes; a sync JMVStream usa
advisory lock e responde `skipped` quando outra execução está ativa.

## Smoke test

- liveness pública em `/api/health` e readiness autenticada em
  `/api/health/ready`, sem detalhes de dependência;
- login e recuperação de senha em Conta de teste;
- catálogo, Aula e painel conforme papel;
- checkout seguro, webhook de teste e deduplicação;
- upload/sync JMVStream e upload/download R2;
- consulta pública de Certificado;
- execução manual autorizada de cada cron em ambiente de teste.

Infraestrutura externa não é comprovada pelo repositório. Registre ambiente, data e operadora da conferência.

## Rollback

- aplicação: selecionar a tag SHA anterior e reimplantar somente se ela for
  compatível com o schema atual; o rollback nativo do Coolify depende de a
  imagem ainda existir localmente, portanto GHCR e o SHA são a autoridade;
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

## Gates externos ao repositório

Antes do primeiro tráfego real: habilite 2FA no Coolify, desative atualização
automática do control plane, restrinja SSH por IP/VPN, configure alertas de
deploy/task/backup/disco/servidor, preserve `APP_KEY` e chaves SSH fora da VPS
e conclua um restore do backup em destino isolado. Nenhum teste deste
repositório comprova esses controles.
