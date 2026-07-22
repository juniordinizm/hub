---
status: runbook
owner: engineering
last_verified_commit: ef8819df4bf53add09c2b05876fb8b7eff306f21
---

# Ambiente e desenvolvimento local

## Regra de segurança

Use `.env.local`, nunca versione segredos. Parta de `.env.example`. Banco e provedores externos devem apontar a ambiente de desenvolvimento. `db:reset`, `db:seed` e `db:seed:student` recusam host remoto; siga o [runbook de banco](database-and-migrations.md).

## Matriz de variáveis

“Obrigatória” significa exigida quando a capacidade indicada é usada, salvo exigência adicional de produção.

| Variável | Ambiente/obrigatoriedade | Consumidor | Sensível |
|---|---|---|---|
| `DATABASE_URL` | runtime com banco | `getPool` | sim |
| `DATABASE_URL_DIRECT` | migrations/auditoria; fallback para `DATABASE_URL` | `drizzle.config.ts` | sim |
| `E2E_TEST_MODE` | somente CI com `CI=true` | limite Better Auth | não |
| `E2E_DATABASE_URL` | Playwright; banco descartável já migrado | seed e servidor E2E | sim |
| `LOCAL_DATABASE_NAMES` | reset local | proteção de comando destrutivo | não |
| `SMOKE_DATABASE_URL` | `db:smoke:empty` | smoke PostgreSQL | sim |
| `CERTIFICATE_CONCURRENCY_DATABASE_URL` | teste de integração | certificados | sim |
| `BETTER_AUTH_SECRET` | obrigatória em produção | Better Auth | sim |
| `BETTER_AUTH_TRUSTED_ORIGINS` | origens extras | `parseTrustedOrigins` | não |
| `BETTER_AUTH_URL` | obrigatória em produção | Better Auth | não |
| `AUTH_PUBLIC_SIGNUP_ENABLED` | opcional, default `false` | rota Better Auth | não |
| `BETTER_AUTH_API_KEY` | Infra opcional | Dash/Sentinel | sim |
| `BETTER_AUTH_API_URL` | Infra opcional | Dash/Sentinel | não |
| `BETTER_AUTH_KV_URL` | Infra opcional | Dash/Sentinel | pode conter credencial |
| `NEXT_ALLOWED_DEV_ORIGINS` | dev atrás de proxy | `next.config.ts` | não |
| `NEXT_PUBLIC_APP_URL` | obrigatória em produção | links/redirects | público |
| `RESEND_API_KEY` | envio de e-mail | `sendTransactionalEmail` | sim |
| `RESEND_FROM_EMAIL` | envio de e-mail | Resend | não |
| `SUPPORT_EMAIL` | suporte por e-mail | e-mail de suporte | dado operacional |
| `ABACATE_PAY_API_KEY` | checkout/reembolso | cliente AbacatePay | sim |
| `ABACATEPAY_API_KEY` | alias legado | cliente AbacatePay | sim |
| `ABACATEPAY_API_BASE_URL` | integração | cliente AbacatePay | não |
| `ABACATEPAY_WEBHOOK_SECRET` | webhook de produção | route webhook | sim |
| `INTERNAL_BOOTSTRAP_SECRET` | bootstrap Admin não produtivo | endpoint dev | sim |
| `CERTIFICATE_PUBLIC_BASE_URL` | obrigatória em produção | certificado/PDF | público |
| `CRON_SECRET` | crons, obrigatória em produção | handlers cron | sim |
| `HEALTHCHECK_SECRET` | readiness, obrigatória em produção | `GET /api/health/ready` | sim |
| `SENTRY_DSN` | exceções/traces servidor | configs Sentry | identificador protegido |
| `NEXT_PUBLIC_SENTRY_DSN` | exceções navegador | `instrumentation-client.ts` | público controlado |
| `SENTRY_AUTH_TOKEN` | source maps no build | `withSentryConfig` | sim |
| `JMVSTREAM_API_BASE_URL` | vídeo | cliente JMVStream | não |
| `JMVSTREAM_API_TOKEN` | fallback JWT | cliente JMVStream | sim |
| `JMVSTREAM_PLAN_ID` | operações de vídeo | cliente JMVStream | identificador protegido |
| `JMVSTREAM_AUTH_RESOURCE` | autenticação preferida | `/v2/authenticate` | identificador protegido |
| `R2_ACCOUNT_ID` | mídia R2 | cliente S3 | identificador protegido |
| `R2_BUCKET_NAME` | mídia privada | cliente S3 | não |
| `R2_ACCESS_KEY_ID` | mídia R2 | cliente S3 | sim |
| `R2_SECRET_ACCESS_KEY` | mídia R2 | cliente S3 | sim |
| `R2_PUBLIC_BUCKET_NAME` | publicação pública | Copy/Delete | não |
| `R2_PUBLIC_BASE_URL` | leitura pública | URLs/Next Image | público |

Não configure os dois aliases AbacatePay com valores divergentes. Não coloque JWT em `JMVSTREAM_AUTH_RESOURCE`. `E2E_TEST_MODE` só eleva limite de login no banco efêmero da CI.

Não há variável de “aprovação jurídica” ou “retenção de privacidade”: o produto não tem workflow de anonimização. O cron de manutenção aplica o prazo técnico de analytics e remove registros técnicos expirados.

## Setup local

1. Instale Bun 1.3.11 e execute `bun install`.
2. Copie `.env.example` para `.env.local`.
3. Configure `DATABASE_URL` para branch dev já migrada ou banco descartável compatível.
4. Gere `BETTER_AUTH_SECRET` exclusivo para dev.
5. Execute `bun run dev`.

Bootstrap Admin em dev exige `INTERNAL_BOOTSTRAP_SECRET`; em produção a rota retorna 404.

## Manutenção técnica

`GET /api/cron/maintenance` exige `CRON_SECRET` em produção e executa diariamente: expira sessões e rate limits, consolida analytics diários e remove eventos brutos após 90 dias e agregados após 13 meses. Não executa anonimização ou pedidos de dados.

## Verificação local

```bash
bun run docs:check
bun run test
bun run typecheck
bun run check
bun run build
```

`bun run dev` serve o projeto. `bun run fix` altera arquivos e deve ser deliberado.

## Evidências

`src/lib/env.ts`, `drizzle.config.ts`, `src/features/maintenance/server.ts`, `src/app/api/cron/maintenance/route.ts`, `src/features/storage/r2.ts` e `next.config.ts`.
