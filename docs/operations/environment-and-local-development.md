---
status: runbook
owner: engineering
last_verified_commit: aceeaf830cf75667df8ce21e5b586d47155dd5ac
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

Depois de reconciliar os providers, esta estação mantém somente `.env.local`.
`.env.staging` e `.env.production` são fontes locais temporárias e não devem
ser usados como secret manager, commitados ou mantidos depois que Vercel e
GitHub Environments tiverem sido confirmados. Rotação é manual, na ordem
Staging → Production, registrando somente presença e fingerprint seguro; o
valor de nenhuma chave entra em chat, log ou documentação. Rotacionar
`BETTER_AUTH_SECRET` em Production exige janela aprovada e invalida sessões.

## Topologia de ambientes

O projeto possui cinco perfis:

- Development local: integração manual contra recursos de teste;
- E2E: execução efêmera e isolada na CI;
- Preview: candidato técnico descartável, fail-closed e sem providers;
- Staging: homologação persistente em
  `https://preview.neurocapacitar.com.br`, com cadastro público e dados
  descartáveis;
- Production: ambiente definitivo, sem manutenção permanente; o estado comercial
  é restaurado após cada operação controlada.

Staging é identificado por `VERCEL_TARGET_ENV=staging`, mesmo quando
`VERCEL_ENV=preview`. Ele usa banco Neon próprio, Asaas Sandbox e projeto
Sentry de Development. Compartilha os buckets R2 de Development sob o namespace
físico `staging/`, o plano JMVStream de Production e a estrutura Resend já
aprovada, mas o preflight exige `STAGING_EMAIL_RECIPIENT_ALLOWLIST`; sem essa
variável, o runtime é bloqueado. Essas exceções exigem confirmações explícitas
e não oferecem isolamento completo nos três providers compartilhados.

Durante migration e deploy controlados, Production pode entrar em
`APPLICATION_MAINTENANCE_MODE=full`; ao terminar, deve retornar a `off` e ser
validada novamente. A configuração estável deste sprint mantém
`PAYMENTS_CHECKOUT_MODE=disabled`, `ASAAS_WEBHOOK_ENABLED=false` e
`SCHEDULED_JOBS_ENABLED=false`. Preview permanece como perfil dormente e
recusa credenciais de providers caso volte a ser usado.

Staging envia `noindex` por metadata e `X-Robots-Tag`, não publica sitemap e
exibe uma faixa visual. Isso reduz indexação acidental, mas a URL continua
pública para participantes convidados. A limpeza de dados é somente manual;
não há retenção ou reset automático. Vercel Authentication está desligada no
projeto porque Standard Protection também protege domínios de Custom
Environments e a exceção por domínio exige Advanced Deployment Protection.
Deploy automático de Preview permanece desligado; os 30 deployments Preview
históricos foram removidos. Smokes e testes manuais usam exclusivamente
`https://preview.neurocapacitar.com.br`.

## Matriz de variáveis

“Obrigatória” significa exigida quando a capacidade indicada é usada, salvo exigência adicional de produção.

| Variável | Ambiente/obrigatoriedade | Consumidor | Sensível |
|---|---|---|---|
| `DATABASE_URL` | runtime com banco | `getPool` | sim |
| `DATABASE_URL_DIRECT` | somente job de migration/auditoria; proibida no web runtime de produção | `drizzle.config.ts`, `migrate-production.ts` | sim |
| `STAGING_DATABASE_HOST` | confirmação do compute Neon de Staging | preflight e comandos guardados | identificador protegido |
| `STAGING_NEON_BRANCH_ID` | confirmação da branch Neon de Staging | migration, seed e reset | identificador protegido |
| `STAGING_OPERATION_CONFIRMATION` | literal `staging` | comandos de Staging | não |
| `STAGING_ADMIN_EMAIL` | seed idempotente do Admin inicial | `seed-staging-admin.ts` | dado interno |
| `STAGING_ADMIN_PASSWORD` | seed idempotente do Admin inicial | `seed-staging-admin.ts` | sim |
| `STAGING_RECOVERY_ADMIN_EMAIL` | seed idempotente do segundo Admin do rollout TOTP | `seed-staging-admin.ts` | dado interno |
| `STAGING_RECOVERY_ADMIN_PASSWORD` | seed idempotente do segundo Admin do rollout TOTP | `seed-staging-admin.ts` | sim |
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
| `PRIVILEGED_MFA_ENFORCED` | opcional, default `false`; `true` após rollout TOTP de Admin/Suporte | assurance servidor-side | não |
| `BETTER_AUTH_API_KEY` | Infra opcional | Dash/Sentinel | sim |
| `BETTER_AUTH_API_URL` | Infra opcional | Dash/Sentinel | não |
| `BETTER_AUTH_KV_URL` | Infra opcional | Dash/Sentinel | pode conter credencial |
| `NEXT_ALLOWED_DEV_ORIGINS` | dev atrás de proxy | `next.config.ts` | não |
| `NEXT_PUBLIC_APP_URL` | explícita em Production; derivada do hostname Vercel em Preview | links/redirects | público |
| `NEXT_PUBLIC_VERCEL_TARGET_ENV` | gerenciada pela Vercel; nunca manual em Development | classificação Sentry no navegador | público |
| `CLIENT_IP_SOURCE` | runtime; `x-forwarded-for` na Vercel ou `cloudflare` com origem restrita | rate limits e checkout | não |
| `RESEND_API_KEY` | envio de e-mail | `sendTransactionalEmail` | sim |
| `RESEND_WEBHOOK_SECRET` | assinatura Svix do lifecycle | webhook Resend | sim; diferente da API key |
| `DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST` | Development | bloqueio de destinatário externo | dado interno |
| `STAGING_EMAIL_RECIPIENT_ALLOWLIST` | obrigatória em Staging no preflight | preflight de Staging | dado interno |
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
| `RECOVERY_DRILL_OWNER` | operador do registro de ensaio somente leitura | `ops:recovery:evidence` | não |
| `RECOVERY_DRILL_ENVIRONMENT` | `development`, `staging` ou `production` do ensaio | `ops:recovery:evidence` | não |
| `RECOVERY_DRILL_MIGRATION_JOURNAL` | topo do journal conferido manualmente | `ops:recovery:evidence` | não |
| `RECOVERY_DRILL_READINESS`, `RECOVERY_DRILL_MIGRATION`, `RECOVERY_DRILL_ALERTS` | resultado `passed`/`failed` confirmado pelo operador | `ops:recovery:evidence` | não |
| `SENTRY_DSN` | exceções/traces servidor | configs Sentry | identificador protegido |
| `NEXT_PUBLIC_SENTRY_DSN` | exceções navegador | `instrumentation-client.ts` | público controlado |
| `NEXT_PUBLIC_SENTRY_RELEASE` | SHA Git completo injetado pelo build | SDK cliente | público controlado |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_PROJECT_ID` | organização, slug e ID do projeto único | `withSentryConfig`, checker | não |
| `STAGING_SENTRY_PROJECT_ID` | confirmação do projeto Development compartilhado | preflight Staging | identificador protegido |
| `DEVELOPMENT_SENTRY_PROJECT_ID` | preflight Development | confirmação do projeto Sentry | identificador protegido |
| `SENTRY_AUTH_TOKEN` | source maps no build | `withSentryConfig` | sim |
| `SENTRY_READINESS_SECRET` | autoriza emissão sintética controlada | `POST /api/health/sentry` em Staging/Production | sim |
| `SENTRY_READINESS_AUTH_TOKEN` | inspeção somente leitura do evento | checker local/CI, ausente do runtime web | sim |
| `SENTRY_READINESS_ALERT_NAME` | nome exato do workflow ativo esperado | checker Sentry | não |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | secret de build estável entre releases sobrepostas | `next build` | sim |
| `DEPLOYMENT_VERSION` | build; SHA imutável do Git | `next.config.ts` | não |
| `JMVSTREAM_API_BASE_URL` | vídeo | cliente JMVStream | não |
| `JMVSTREAM_API_TOKEN` | fallback JWT | cliente JMVStream | sim |
| `JMVSTREAM_PLAN_ID` | operações de vídeo | cliente JMVStream | identificador protegido |
| `DEVELOPMENT_JMVSTREAM_PLAN_ID` | preflight Development | confirmação de plano isolado, quando usado | identificador protegido |
| `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION` | preflight Development | confirmação explícita do plano Production compartilhado | `true` somente quando aprovado |
| `STAGING_JMVSTREAM_USES_PRODUCTION` | preflight Staging | confirmação explícita do plano Production compartilhado | `true` |
| `JMVSTREAM_AUTH_RESOURCE` | autenticação preferida | `/v2/authenticate` | identificador protegido |
| `R2_ACCOUNT_ID` | mídia R2 | cliente S3 | identificador protegido |
| `R2_BUCKET_NAME` | mídia privada | cliente S3 | não |
| `R2_ACCESS_KEY_ID` | mídia R2 | cliente S3 | sim |
| `R2_SECRET_ACCESS_KEY` | mídia R2 | cliente S3 | sim |
| `R2_PUBLIC_BUCKET_NAME` | publicação pública | Copy/Delete | não |
| `R2_PUBLIC_BASE_URL` | leitura pública | URLs/Next Image | público |
| `R2_OBJECT_PREFIX` | namespace físico; `staging` em Staging | fronteira S3 | não |
| `STAGING_R2_USES_DEVELOPMENT` | confirmação dos buckets Development compartilhados | preflight Staging | `true` |
| `BACKUP_DATABASE_URL` | role direta somente leitura de Production | GitHub Environment `production-backup` | sim |
| `BACKUP_CADENCE_HOURS` | intervalo fixo igual ao cron | workflow de backup | `6` |
| `BACKUP_R2_ACCOUNT_ID` | conta do bucket privado dedicado | backup, restore e gate de release | não |
| `BACKUP_R2_BUCKET_NAME` | bucket privado dedicado | backup, restore e gate de release | não |
| `BACKUP_R2_ACCESS_KEY_ID` | identificação da credencial read/write limitada ao bucket | workflow de backup | sim |
| `BACKUP_R2_SECRET_ACCESS_KEY` | segredo da credencial read/write limitada ao bucket | workflow de backup | sim |
| `BACKUP_AGE_RECIPIENT` | destinatário público X25519 | cifragem do dump | não |
| `PRODUCTION_DATABASE_HOST` | host direto esperado de Production | backup e guardas de restore | identificador protegido |
| `PRODUCTION_NEON_BRANCH_ID` | branch Production esperada | backup | identificador protegido |
| `PRODUCTION_NEON_PROJECT_ID` | projeto Neon Production esperado | backup | identificador protegido |
| `NEON_API_KEY` | leitura da branch e endpoints que provam a origem do dump | GitHub Environment `production-backup` | sim |
| `VERCEL_TOKEN` | leitura do deployment Production implantado | GitHub Environment `production-backup` | sim |
| `VERCEL_ORG_ID` | organização dona do deployment Production | backup | identificador protegido |
| `VERCEL_PROJECT_ID` | projeto Vercel Production esperado | backup | identificador protegido |
| `RESTORE_R2_ACCESS_KEY_ID` | identificação da credencial read-only limitada ao bucket | restore e gate de release | sim |
| `RESTORE_R2_SECRET_ACCESS_KEY` | segredo da credencial read-only limitada ao bucket | restore e gate de release | sim |
| `RESTORE_MANIFEST_KEY` | manifesto selecionado no namespace permitido | exercício manual | não |
| `RESTORE_AGE_IDENTITY_FILE` | caminho absoluto offline, fora do repositório | exercício manual | caminho protegido; nunca conteúdo |
| `RESTORE_DATABASE_URL` | alvo PostgreSQL 18 descartável `hub_restore_*` | exercício manual | sim |
| `RESTORE_CONFIRMATION` | confirmação literal fail-closed | exercício manual | não |
| `PGSSLROOTCERT` | caminho do bundle de CAs do cliente PostgreSQL local | restore local com `sslmode=verify-full` | caminho protegido |
| `PROTECTED_DATABASE_HOSTS` | computes adicionais que o restore deve recusar | exercício manual | não |
| `EXPIRY_WARNING_V1_CONFIRMATION` | confirmação literal do script pós-`0066` | Staging/Production, uso único | não |
| `STAGING_RESEND_USES_PRODUCTION` | confirmação da estrutura Resend compartilhada | preflight Staging | `true` |
| `RESEND_READINESS_SECRET` | bearer exclusivo da emissão controlada de lifecycle | Vercel Staging e GitHub Environment `vercel-staging` | sim; mínimo 32 caracteres |

As seis rotas cron, inclusive `/api/cron/asaas-webhooks` e
`/api/cron/resend-webhooks`, compartilham
`CRON_SECRET` e `SCHEDULED_JOBS_ENABLED`. O worker Asaas está agendado a cada minuto em
UTC, mas deve permanecer desabilitado até migrations, configuração e homologação do
ambiente alvo.

Vercel Cron executa no deployment Production. Staging usa
`.github/workflows/run-staging-jobs.yml`: a agenda de cinco minutos deve chamar
Asaas, outbox, JMVStream e Resend; omitir qualquer inbox deixa o ambiente sem
projeção equivalente. A prova manual do Resend usa
`.github/workflows/run-staging-jobs.yml`, operação manual
`verify-resend-lifecycle`, exige confirmação
`SEND_CONTROLLED_STAGING_PASSWORD_RESET`, roda somente no GitHub Environment
`vercel-staging` e publica apenas estado, tipos de evento, contagem e UUID de
correlação. A operação compartilha um workflow que já existe na branch padrão,
permitindo carregar a definição de `staging` sem promover código para `main`.
O e-mail controlado, token e conteúdo nunca pertencem ao log.

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
  `NEXT_PUBLIC_SENTRY_RELEASE`, `R2_PUBLIC_BASE_URL` e `DEPLOYMENT_VERSION`;
- build secreto: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` e, opcionalmente,
  `SENTRY_AUTH_TOKEN`, armazenados no ambiente Vercel correspondente. Quando o
  token existe, `SENTRY_ORG`, `SENTRY_PROJECT` e o SHA Git completo são
  obrigatórios; o token não é disponibilizado ao runtime;
- runtime web: URLs, `DATABASE_URL` pooled e credenciais dos providers;
- job de migration: `DATABASE_URL_DIRECT`;
- ausentes no web de produção: `DATABASE_URL_DIRECT`,
  `INTERNAL_BOOTSTRAP_SECRET`, `E2E_*`, `SMOKE_DATABASE_URL` e
  `CERTIFICATE_CONCURRENCY_DATABASE_URL`.

Em produção, `src/instrumentation.ts` chama `getServerEnv` no startup Node. O
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
explícita `127.0.0.1`. `DATABASE_URL_DIRECT` e `INTERNAL_BOOTSTRAP_SECRET` continuam
proibidas nesse processo web. Metadados `VERCEL_ENV` de Production/Preview e
`VERCEL_TARGET_ENV=staging` têm precedência e impedem o modo E2E.

O sink de e-mail de Certificado e `/api/e2e/email-deliveries` obedecem à mesma
classificação fail-closed: fora desse runtime isolado, o módulo recusa acesso e a rota
responde `404`. O registro em memória contém somente tópico, hash SHA-256 do destinatário
normalizado e chave de idempotência; não guarda e-mail, nome, código ou conteúdo da mensagem.

`CLIENT_IP_SOURCE=cloudflare` só é seguro quando a origem não aceita tráfego
fora da Cloudflare. Na Vercel, use o default `x-forwarded-for`; a aplicação
valida o endereço antes de usá-lo em rate limit.

Não há variável de “aprovação jurídica” ou “retenção de privacidade”: o produto não tem workflow de anonimização. O cron de manutenção aplica o prazo técnico de analytics e remove registros técnicos expirados.

## Setup local

1. Instale Bun 1.3.11 e execute `bun install`. O projeto fixa `sharp` na mesma
   linha compatível com o `sharp` opcional do Next; não force outra versão no
   `overrides`, pois dois runtimes nativos de `sharp` no mesmo processo Windows
   podem causar `ERR_DLOPEN_FAILED`.
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

## Política de datas e fusos

O banco guarda instantes em UTC nos timestamps com `withTimezone: true`. A
interface do produto exibe esses instantes no fuso fixo `America/Sao_Paulo`, por
meio dos helpers de `src/lib/formatters.ts`. Isso torna Development, Staging e
Production determinísticos, independentemente do fuso do processo Node/Bun,
da região de execução da Vercel ou do navegador do usuário.

Não use `Intl.DateTimeFormat` sem `timeZone`, `Date#toLocaleString`,
`Date#toString` ou `toISOString().slice(0, 10)` para saída de calendário. Uma
data escolhida sem horário é interpretada como calendário de São Paulo e só
depois convertida em um instante UTC antes de ser persistida. Agendamentos e
logs operacionais continuam em UTC e devem ser rotulados como tal.
Relatórios diários e agregações SQL usam explicitamente a meia-noite desse fuso;
não dependem do `TimeZone` da sessão PostgreSQL.

## Evidências

`src/lib/env.ts`, `drizzle.config.ts`, `src/features/maintenance/server.ts`, `src/app/api/cron/maintenance/route.ts`, `src/features/storage/r2.ts` e `next.config.ts`.
