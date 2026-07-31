---
status: runbook
owner: engineering
last_verified_commit: 34f35e12a4cbe9b6e3b14bfda176bf7ec5501d2b
---

# Ambiente e desenvolvimento local

## Regra de segurança

Use `.env.local`, nunca versione segredos. Parta de `.env.example`. Banco e provedores externos devem apontar a ambiente de desenvolvimento. `db:reset`, `db:seed` e `db:seed:student` recusam host remoto; siga o [runbook de banco](database-and-migrations.md).

O `.env.local` da estação principal foi corrigido e passa pelo preflight
fail-closed de Development. Ele usa a branch Neon `development`, os buckets
`hub-development-private` e `hub-development-public`, Asaas Sandbox e o projeto
Sentry de Development. Resend reutiliza o domínio verificado
com allowlist obrigatória. JMVStream reutiliza conscientemente o plano
Production e, por isso, continua sendo a única integração sem isolamento
técnico completo.

A topologia, o onboarding de outra estação e as restrições de cada provider
estão no [guia de Development compartilhado](shared-development-and-release-guide.md).

## Matriz de variáveis

“Obrigatória” significa exigida quando a capacidade indicada é usada, salvo exigência adicional de produção.

| Variável | Ambiente/obrigatoriedade | Consumidor | Sensível |
|---|---|---|---|
| `DATABASE_URL` | runtime com banco | `getPool` | sim |
| `DATABASE_URL_DIRECT` | somente job de migration/auditoria; proibida no web runtime de produção | `drizzle.config.ts`, `migrate-production.ts` | sim |
| `DEVELOPMENT_DATABASE_HOST` | preflight e seed Development | confirmação do endpoint Neon | identificador protegido |
| `SHARED_DEVELOPMENT_SEED_CONFIRMATION` | seed Development | confirmação literal `development` | não |
| `DEVELOPMENT_ADMIN_EMAIL` | seed Development | Conta Admin fictícia | dado interno |
| `DEVELOPMENT_ADMIN_PASSWORD` | seed Development | Conta Admin fictícia | sim |
| `DEVELOPMENT_STUDENT_EMAIL` | seed Development | Conta Aluna fictícia | dado interno |
| `DEVELOPMENT_STUDENT_PASSWORD` | seed Development | Conta Aluna fictícia | sim |
| `E2E_TEST_MODE` | somente CI com `CI=true` | limite Better Auth | não |
| `E2E_DATABASE_URL` | Playwright; banco descartável já migrado | seed e servidor E2E | sim |
| `E2E_R2_BUCKET_NAME` | Playwright; confirmação explícita do bucket R2 isolado | seed e teardown E2E | não |
| `LOCAL_DATABASE_NAMES` | reset local | proteção de comando destrutivo | não |
| `SMOKE_DATABASE_URL` | `db:smoke:empty` | smoke PostgreSQL | sim |
| `CERTIFICATE_CONCURRENCY_DATABASE_URL` | teste de integração | certificados, outbox e inbox Asaas | sim |
| `BETTER_AUTH_SECRET` | obrigatória em produção; mínimo de 32 caracteres | Better Auth | sim |
| `BETTER_AUTH_TRUSTED_ORIGINS` | origens extras | `parseTrustedOrigins` | não |
| `BETTER_AUTH_URL` | explícita em Production; derivada do hostname Vercel em Preview | Better Auth | não |
| `AUTH_PUBLIC_SIGNUP_ENABLED` | opcional, default `false` | rota Better Auth | não |
| `BETTER_AUTH_API_KEY` | Infra opcional | Dash/Sentinel | sim |
| `BETTER_AUTH_API_URL` | Infra opcional | Dash/Sentinel | não |
| `BETTER_AUTH_KV_URL` | Infra opcional | Dash/Sentinel | pode conter credencial |
| `NEXT_ALLOWED_DEV_ORIGINS` | dev atrás de proxy | `next.config.ts` | não |
| `NEXT_PUBLIC_APP_URL` | explícita em Production; derivada do hostname Vercel em Preview | links/redirects | público |
| `CLIENT_IP_SOURCE` | runtime; `x-forwarded-for` na Vercel ou `cloudflare` com origem restrita | rate limits e checkout | não |
| `RESEND_API_KEY` | envio de e-mail | `sendTransactionalEmail` | sim |
| `DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST` | Development | bloqueio de destinatário externo | dado interno |
| `RESEND_FROM_EMAIL` | remetente verificado; `Neuro Capacitar <notificacoes@neurocapacitar.com.br>` em Production | Resend | não |
| `SUPPORT_EMAIL` | caixa real e `Reply-To` padrão; `suporte@neurocapacitar.com.br` em Production | e-mail de suporte | dado operacional |
| `ASAAS_API_KEY` | checkout Asaas server-only | adapter Asaas | sim |
| `ASAAS_API_BASE_URL` | sandbox em Development e endpoint aprovado em Production | adapter Asaas | não |
| `ASAAS_USER_AGENT` | identificação estável com contato técnico | adapter Asaas | não |
| `ASAAS_WEBHOOK_TOKEN` | segredo próprio com mínimo de 32 caracteres | inbox Asaas | sim |
| `ASAAS_WEBHOOK_ENABLED` | `false` no pré-corte; habilita ingresso e worker Asaas juntos | inbox/cron Asaas | não |
| `PAYMENTS_CHECKOUT_MODE` | `disabled`, `authenticated` ou `public`; explícita em Production e sempre `disabled` em Preview | entradas de checkout | não |
| `INTERNAL_BOOTSTRAP_SECRET` | bootstrap Admin não produtivo | endpoint dev | sim |
| `CERTIFICATE_PUBLIC_BASE_URL` | explícita em Production; derivada do hostname Vercel em Preview | certificado/PDF | público |
| `CRON_SECRET` | crons, obrigatória em produção; mínimo de 32 caracteres | handlers cron | sim |
| `SCHEDULED_JOBS_ENABLED` | kill switch; `true` somente após liberar os crons de Production | handlers cron | não |
| `HEALTHCHECK_SECRET` | readiness, obrigatória em produção; mínimo de 32 caracteres | `GET /api/health/ready` | sim |
| `SENTRY_DSN` | exceções/traces servidor | configs Sentry | identificador protegido |
| `NEXT_PUBLIC_SENTRY_DSN` | exceções navegador | `instrumentation-client.ts` | público controlado |
| `DEVELOPMENT_SENTRY_PROJECT_ID` | preflight Development | confirmação do projeto Sentry | identificador protegido |
| `SENTRY_AUTH_TOKEN` | source maps no build | `withSentryConfig` | sim |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | secret de build estável entre releases sobrepostas | `next build` | sim |
| `DEPLOYMENT_VERSION` | build; SHA imutável do Git | `next.config.ts` | não |
| `JMVSTREAM_API_BASE_URL` | vídeo | cliente JMVStream | não |
| `JMVSTREAM_API_TOKEN` | fallback JWT | cliente JMVStream | sim |
| `JMVSTREAM_PLAN_ID` | operações de vídeo | cliente JMVStream | identificador protegido |
| `DEVELOPMENT_JMVSTREAM_PLAN_ID` | preflight Development | confirmação de plano isolado, quando usado | identificador protegido |
| `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION` | preflight Development | confirmação explícita do plano Production compartilhado | `true` somente quando aprovado |
| `JMVSTREAM_AUTH_RESOURCE` | autenticação preferida | `/v2/authenticate` | identificador protegido |
| `R2_ACCOUNT_ID` | mídia R2 | cliente S3 | identificador protegido |
| `R2_BUCKET_NAME` | mídia privada | cliente S3 | não |
| `R2_ACCESS_KEY_ID` | mídia R2 | cliente S3 | sim |
| `R2_SECRET_ACCESS_KEY` | mídia R2 | cliente S3 | sim |
| `R2_PUBLIC_BUCKET_NAME` | publicação pública | Copy/Delete | não |
| `R2_PUBLIC_BASE_URL` | leitura pública | URLs/Next Image | público |

As cinco rotas cron, inclusive `/api/cron/asaas-webhooks`, compartilham
`CRON_SECRET` e `SCHEDULED_JOBS_ENABLED`. O worker Asaas está agendado a cada minuto em
UTC, mas deve permanecer desabilitado até migrations, configuração e homologação do
ambiente alvo.

As quatro variáveis Asaas são opcionais no parser; o factory exige as três do adapter e a
rota de webhook exige o token próprio. Development exige as quatro para a homologação
sandbox. Production permite
o deploy pré-corte sem elas enquanto checkout, webhook e worker estão desabilitados; quando
`PAYMENTS_CHECKOUT_MODE` é `authenticated`/`public` ou
`ASAAS_WEBHOOK_ENABLED=true`, as cinco variáveis `ASAAS_*` da tabela tornam-se
obrigatórias em conjunto. A origem e a força do token são validadas, e o adapter e a
rota falham de forma segura se o respectivo segredo estiver ausente. Preview recusa
credenciais de provider. Não coloque JWT em `JMVSTREAM_AUTH_RESOURCE`. `E2E_TEST_MODE` só eleva limite de
login no banco efêmero da CI. O seed e o teardown E2E recusam operações R2 se
`E2E_R2_BUCKET_NAME` estiver ausente ou não for exatamente igual a `R2_BUCKET_NAME`; nunca
confirme um bucket de produção.

### Separação por fase

- build público: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`,
  `R2_PUBLIC_BASE_URL` e `DEPLOYMENT_VERSION`;
- build secreto: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` e, opcionalmente,
  `SENTRY_AUTH_TOKEN`, armazenados no ambiente Vercel correspondente;
- runtime web: URLs, `DATABASE_URL` pooled e credenciais dos providers;
- job de migration: `DATABASE_URL_DIRECT`;
- ausentes no web de produção: `DATABASE_URL_DIRECT`,
  `INTERNAL_BOOTSTRAP_SECRET`, `E2E_*`, `SMOKE_DATABASE_URL` e
  `CERTIFICATE_CONCURRENCY_DATABASE_URL`.

Em produção, `instrumentation.ts` chama `getServerEnv` no startup Node. O
processo encerra antes de servir tráfego quando uma capacidade obrigatória
está ausente. A lista de nomes fica em
`src/lib/production-environment.ts` para Production e
`src/lib/preview-environment.ts` para Preview; mensagens nunca incluem valores.
As URLs públicas devem usar HTTPS; `BETTER_AUTH_URL`,
`CERTIFICATE_PUBLIC_BASE_URL` e `NEXT_PUBLIC_APP_URL` devem ter a mesma
origem. Production exige as três explicitamente e usa
`https://app.neurocapacitar.com.br`. Com `VERCEL_ENV=preview`, Preview prefere
`VERCEL_BRANCH_URL`; deployments criados pela CLI sem integração Git usam
`VERCEL_URL`, pois não recebem alias de branch. Os dois hostnames permanecem sob
Standard Deployment Protection. O bypass de automação é usado somente pelo
smoke da CI e não torna a URL pública. O projeto Vercel precisa manter habilitada
a exposição automática de variáveis de sistema. O perfil Preview exige somente
Neon pooled, autenticação e readiness próprios, mantém jobs desligados e recusa
credenciais de providers.
`DATABASE_URL` aceita somente os protocolos `postgres:` e `postgresql:`.
Segredos emitidos por provedores externos seguem o contrato do provedor; o
limite local de 32 caracteres vale somente para os segredos próprios de
autenticação, cron e readiness.

`RESEND_FROM_EMAIL` identifica o remetente, mas não cria uma caixa. E-mails
automáticos usam `SUPPORT_EMAIL` como `Reply-To`; portanto, o endereço de
suporte só pode ser cadastrado em Production depois que o recebimento externo
for testado. Consulte [Resend e e-mail institucional](../integrations/resend.md).

O runtime E2E compilado pela CI usa `next start`, mas não representa um deploy
de produção. A dispensa das credenciais de providers só é aceita com
`E2E_TEST_MODE=true`, `CI=true` e as três URLs canônicas na mesma origem
loopback. `DATABASE_URL_DIRECT` e `INTERNAL_BOOTSTRAP_SECRET` continuam
proibidas nesse processo web.

`CLIENT_IP_SOURCE=cloudflare` só é seguro quando a origem não aceita tráfego
fora da Cloudflare. Na Vercel, use o default `x-forwarded-for`; a aplicação
valida o endereço antes de usá-lo em rate limit.

Não há variável de “aprovação jurídica” ou “retenção de privacidade”: o produto não tem workflow de anonimização. O cron de manutenção aplica o prazo técnico de analytics e remove registros técnicos expirados.

## Setup local

1. Instale Bun 1.3.11 e execute `bun install`.
2. Copie `.env.example` para `.env.local`.
3. Configure `DATABASE_URL` para a branch compartilhada `development` já
   migrada; nunca use o compute Production.
4. Gere `BETTER_AUTH_SECRET` exclusivo para dev.
5. Configure somente os providers Development descritos no
   [guia operacional](shared-development-and-release-guide.md).
6. Execute a conferência obrigatória do guia.
7. Execute `bun run dev`.

`bun run dev` agora executa um preflight fail-closed. O comando recusa o compute
Neon, buckets, remetente, plano JMVStream e projeto Sentry conhecidos de
Production. Para popular a branch Neon compartilhada, use somente
`bun run db:seed:development`; o comando local legado `db:seed` continua
restrito a hosts loopback.

Chaves Asaas começam com `$`. No `.env.local`, grave `ASAAS_API_KEY=\$...`, pois o
Next expande referências iniciadas por cifrão. O launcher de Development normaliza esse
escape para os subprocessos, executa o preflight no mesmo ambiente e remove somente a
chave herdada antes de o Next reler o arquivo. Não remova o escape nem inicie o Next
diretamente durante a homologação.

Em uma execução isolada com `CI=true` e `E2E_TEST_MODE=true`, o launcher preserva os
overrides explícitos recebidos do Playwright sobre `.env.local`. O preflight E2E ainda
exige banco descartável, bucket confirmado, endpoint R2 loopback e URLs canônicas na
mesma origem; essa precedência não se aplica ao Development comum.

Bootstrap Admin em dev exige `INTERNAL_BOOTSTRAP_SECRET`; em produção a rota retorna 404.

## Manutenção técnica

`GET /api/cron/maintenance` exige `CRON_SECRET` em produção e executa diariamente: expira sessões e rate limits, remove em lotes reservas Asaas pré-autorização abandonadas há mais de 15 minutos, sanitiza payloads de webhook Asaas vencidos há 30 dias, consolida analytics diários e remove eventos brutos após 90 dias e agregados após 13 meses. A limpeza de checkout exige estado canônico e checkout `pending`, zero tentativas e ausência completa de URL, IDs e estados do provedor. A sanitização troca somente o JSON bruto por `{}` e preserva os metadados operacionais. Ambas respeitam lease/deadline; a sanitização não disputa evento `processing` com lock vigente. Não executa anonimização ou pedidos de dados.

## Verificação local

```bash
bun run verify:quick
bun run verify
```

Use `verify:quick` durante o trabalho e `verify` antes do Pull Request.
`bun run dev` serve o projeto. `bun run fix` altera arquivos e deve ser
deliberado. O fluxo completo até Production está no
[tutorial de release](production-release-guide.md).

## Evidências

`src/lib/env.ts`, `drizzle.config.ts`, `src/features/maintenance/server.ts`, `src/app/api/cron/maintenance/route.ts`, `src/features/storage/r2.ts` e `next.config.ts`.
