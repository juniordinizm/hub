---
status: runbook
owner: engineering
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# Ambiente e desenvolvimento local

## Regra de segurança

Use `.env.local`, nunca versione secrets. Parta de `.env.example`. Banco e provedores externos devem ser ambientes de desenvolvimento.

Para trabalhar localmente, use uma branch Postgres de desenvolvimento ou um banco descartável compatível com o schema. `db:reset`, `db:seed` e `db:seed:student` recusam host remoto; siga o [runbook de banco](database-and-migrations.md) antes de executá-los.

## Matriz única de variáveis

“Obrigatória” significa exigida quando a capacidade indicada é usada, salvo regra mais forte de produção.

| Variável | Ambiente/obrigatoriedade | Default | Consumidor | Sensível |
|---|---|---|---|---|
| `DATABASE_URL` | todo ambiente com banco | nenhum | `getPool` | sim |
| `DATABASE_URL_DIRECT` | migrations/admin de banco | fallback para `DATABASE_URL` no Drizzle config | `drizzle.config.ts` | sim |
| `LOCAL_DATABASE_NAMES` | obrigatória para `db:reset:local` | nenhum | `assertSafeLocalDatabaseCommand` | não |
| `SMOKE_DATABASE_URL` | opcional, necessário para `db:smoke:empty` | fallback para `DATABASE_URL_DIRECT`/`DATABASE_URL` | `smoke-empty-database.ts` | sim |
| `CERTIFICATE_CONCURRENCY_DATABASE_URL` | opcional, necessário para o teste de integração de certificados | nenhum | `certificate-issuance.integration.test.ts` | sim |
| `BETTER_AUTH_SECRET` | produção obrigatória | segredo inseguro só em dev/test | `getAuth` | sim |
| `BETTER_AUTH_URL` | produção obrigatória | `http://localhost:3000` | Better Auth | não |
| `BETTER_AUTH_TRUSTED_ORIGINS` | quando há origens extras | vazio | `parseTrustedOrigins` | não |
| `AUTH_PUBLIC_SIGNUP_ENABLED` | opcional | `false` | rota Better Auth | não |
| `BETTER_AUTH_API_KEY` | opcional, habilita Infra | vazio | Dash/Sentinel | sim |
| `BETTER_AUTH_API_URL` | opcional com Infra | provedor | Dash/Sentinel | não |
| `BETTER_AUTH_KV_URL` | opcional com Infra | provedor | Dash/Sentinel | pode conter credencial |
| `NEXT_ALLOWED_DEV_ORIGINS` | desenvolvimento atrás de proxy/host extra | vazio | `next.config.ts` | não |
| `NEXT_PUBLIC_APP_URL` | produção obrigatória | `http://localhost:3000` | links e redirect | público |
| `RESEND_API_KEY` | envio de e-mail | nenhum | `sendTransactionalEmail` | sim |
| `RESEND_FROM_EMAIL` | envio de e-mail | `PROTEA-R <noreply@example.com>` | Resend | não |
| `SUPPORT_EMAIL` | suporte por e-mail | fallback para remetente | `sendSupportRequestEmail` | dado operacional |
| `ABACATE_PAY_API_KEY` | checkout/reembolso | nenhum | cliente AbacatePay | sim |
| `ABACATEPAY_API_KEY` | alias legado | nenhum | cliente AbacatePay | sim |
| `ABACATEPAY_API_BASE_URL` | integração | `https://api.abacatepay.com/v2` | cliente AbacatePay | não |
| `ABACATEPAY_WEBHOOK_SECRET` | webhook, obrigatório em produção | nenhum | route webhook | sim |
| `INTERNAL_BOOTSTRAP_SECRET` | bootstrap Admin não produtivo | nenhum | endpoint dev | sim |
| `CERTIFICATE_PUBLIC_BASE_URL` | produção obrigatória | `http://localhost:3000` | certificado/PDF | público |
| `CRON_SECRET` | crons, obrigatório em produção | nenhum | três handlers cron | sim |
| `DATA_RETENTION_ENABLED` | habilitação jurídica/operacional | `false` | privacidade/retenção | não |
| `LEGAL_APPROVAL_REFERENCE` | obrigatória quando retenção está ativa | nenhum | validação de ambiente | referência interna |
| `JMVSTREAM_API_BASE_URL` | vídeo | `https://api.jmvstream.com` | cliente JMVStream | não |
| `JMVSTREAM_AUTH_RESOURCE` | autenticação preferida | nenhum | `/v2/authenticate` | identificador protegido |
| `JMVSTREAM_API_TOKEN` | fallback JWT | nenhum | cliente JMVStream | sim |
| `JMVSTREAM_PLAN_ID` | operações de vídeo/plano | nenhum | cliente JMVStream | identificador protegido |
| `R2_ACCOUNT_ID` | mídia R2 | nenhum | cliente S3 | identificador protegido |
| `R2_BUCKET_NAME` | mídia R2 | nenhum | bucket privado | não |
| `R2_ACCESS_KEY_ID` | mídia R2 | nenhum | cliente S3 | sim |
| `R2_SECRET_ACCESS_KEY` | mídia R2 | nenhum | cliente S3 | sim |
| `R2_PUBLIC_BUCKET_NAME` | publicação pública | nenhum | Copy/Delete | não |
| `R2_PUBLIC_BASE_URL` | leitura pública | exemplo `https://media.example.com` | URLs/Next Image | público |
| `NODE_ENV` | fornecida pelo runtime | `development` | validações | não |
| `VERCEL` | fornecida pela Vercel | vazio | runtime | não |

Não configure os dois aliases AbacatePay com valores diferentes. Não coloque JWT em `JMVSTREAM_AUTH_RESOURCE`.

## Setup com banco compatível

1. Instale Bun 1.3.11.
2. Execute `bun install`.
3. Copie `.env.example` para `.env.local`.
4. Configure `DATABASE_URL` de uma branch dev já migrada.
5. Gere um `BETTER_AUTH_SECRET` exclusivo para dev.
6. Mantenha cadastro público e retenção desligados.
7. Execute `bun run dev`.

Para criar Admin em dev, configure `INTERNAL_BOOTSTRAP_SECRET` e use o endpoint protegido conforme `getBootstrapAdminDecision`. Nunca habilite esse fluxo em produção; o código retorna 404.

## Capacidades opcionais

- e-mail: Resend;
- checkout: AbacatePay;
- vídeo: JMVStream;
- anexos/capas/banners: R2;
- Dash/Sentinel: Better Auth Infra.

Sem credenciais, a capacidade deve falhar com erro de configuração; não use credenciais de produção para “fazer passar”.

## Verificação local

```bash
bun run docs:check
bun run test
bun run typecheck
bun run check
bun run build
```

`bun run dev` é o único comando necessário para servir. `bun run fix` altera arquivos e deve ser usado deliberadamente.

## Fontes

- schema de ambiente: `getServerEnv`, em `src/lib/env.ts`;
- variáveis R2 dinâmicas: `readRequiredEnv`, em `src/features/storage/r2.ts`;
- origens dev: `getAllowedDevOrigins`, em `src/lib/allowed-dev-origins.ts`;
- imagem remota: `next.config.ts`;
- configuração Drizzle: `drizzle.config.ts`.
