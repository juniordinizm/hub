---
status: runbook
owner: operations
last_verified_commit: 9fa916691ed1226233847f40b13bdfac6787c995
---

# Deploy e incidentes

## Modelo de release na Vercel

O Hub usa Next.js nativo na Vercel Pro, Node.js 24 e região primária `gru1`.
Não existe imagem Docker, publicação GHCR ou runner de cron externo no caminho
de produção. A VPS anterior permanece fora do fluxo e não é autoridade de
release.

O workflow `CI` valida o código e cria um deployment Preview por build remoto
na Vercel. O workflow manual `Deploy Vercel production` exige confirmação
explícita, deriva o SHA do checkout da `main`, verifica que ele é o
`origin/main` atual e consulta a API do GitHub para provar uma CI verde desse
SHA. Só então aplica
migrations com conexão direta, cria um deployment Production sem promovê-lo,
testa sua readiness e o promove. Deploys Git automáticos da Vercel devem
permanecer desligados para não criar uma segunda promoção concorrente.

### Ambientes

- `vercel-preview`: smoke descartável de build/runtime. Usa somente Neon
  sanitizado, autenticação e readiness próprios;
  `SCHEDULED_JOBS_ENABLED=false`.
- `vercel-production`: ambiente protegido no GitHub. Contém token de deploy,
  segredo de readiness e URL direta de migration.
- `neon-development`: ambiente protegido no GitHub. Contém somente a URL direta
  da branch Development e o hostname esperado desse compute.
- Vercel Preview: contém apenas o núcleo permitido pelo perfil limitado e
  nenhuma credencial de provider.
- Vercel Production: contém todas as variáveis de runtime definitivas.

`DATABASE_URL_DIRECT` não pertence ao runtime Vercel. Ela existe apenas como
secret do GitHub Environment `vercel-production`. `DATABASE_URL` pooled pertence
ao runtime Vercel.

O pool isolado de readiness permite até 5 segundos para estabelecer o handshake
TLS com o Neon e continua limitado a uma conexão. Depois de conectado, a
consulta de compatibilidade usa `statement_timeout` de 1 segundo. Isso evita que
latência transitória de conexão seja confundida com schema indisponível sem
transformar a rota em uma consulta longa.

Sharp é externo ao bundle do servidor e depende de binários por plataforma. O
`outputFileTracingIncludes` deve preservar `node_modules/sharp/**/*` e
`node_modules/@img/sharp-*/**/*`. Módulos de leitura do R2 não devem importar os
processadores de imagem no topo; eles são carregados somente pelos fluxos de
upload/renderização que precisam deles.

## Gate de deploy

O caminho versionado é:

1. CI: documentação, migrations, typecheck, estilo, testes e audit.
2. CI: integração PostgreSQL e jornadas Chromium em branches Neon efêmeras.
3. CI: build e Knip.
4. CI: `vercel deploy` remoto e smoke autenticado de Preview.
5. Produção: despacho manual com confirmação de Production.
6. Produção: derivação do SHA e prova de que ele é o `main` atual com CI verde.
7. Produção: `db:migrate:production` e auditoria do journal.
8. Produção: `vercel deploy --prod --skip-domain`.
9. Produção: smoke autenticado de `/api/health/ready` no deployment isolado.
10. Produção: `vercel promote` apenas depois do smoke aprovado.

O grupo de concorrência de produção não cancela uma execução em andamento. Isso
evita interromper uma migration para iniciar outra. Como o repositório é privado
e required reviewers de Environments não estão disponíveis nos planos
GitHub Free/Pro/Team, a autorização humana é o próprio `workflow_dispatch`:
marque `confirm_production`. O workflow recusa execução fora da `main`, SHA
atual sem CI verde ou checkout que tenha ficado desatualizado.

Não avance quando houver migration não validada, Preview usando dados
definitivos, variável ausente, falha de CI, webhook não conferido ou alteração
irreversível sem plano de recuperação.

## Configuração obrigatória

### GitHub Repository

- secret `NEON_API_KEY`;
- variable `NEON_PROJECT_ID`, apontando ao projeto Neon permitido para branches
  efêmeras de CI.

### GitHub Environment `vercel-preview`

- secret `VERCEL_TOKEN`;
- secret `HEALTHCHECK_SECRET`, igual ao valor configurado no runtime Preview;
- secret `VERCEL_AUTOMATION_BYPASS_SECRET`, dedicado ao smoke protegido;
- variables `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.

### GitHub Environment `vercel-production`

- secret `VERCEL_TOKEN`;
- secret `HEALTHCHECK_SECRET`, igual ao valor configurado no runtime Production;
- secret `VERCEL_AUTOMATION_BYPASS_SECRET`, igual ao bypass do projeto Vercel;
- secret `DATABASE_URL_DIRECT`, apontando à branch Neon definitiva;
- variables `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.

### GitHub Environment `neon-development`

- secret `DATABASE_URL_DIRECT`, apontando à branch Neon `development`;
- variable `DEVELOPMENT_DATABASE_HOST`, contendo somente o hostname direto
  `ep-silent-leaf-aclmy5uk...neon.tech`, sem protocolo, usuário ou senha.

O workflow `Migrate Neon development` deve ser executado apenas na `main`, depois
da CI verde, e somente quando o merge contiver migration. Sua concorrência não
cancela uma migration em andamento.

### Vercel

Configure cada valor no ambiente correto. Preview nunca reutiliza banco, bucket,
webhook ou credenciais financeiras de Production.

Preview recebe somente `DATABASE_URL` pooled da branch `vercel-preview`,
`BETTER_AUTH_SECRET`, `HEALTHCHECK_SECRET`,
`CLIENT_IP_SOURCE=x-forwarded-for`, `AUTH_PUBLIC_SIGNUP_ENABLED=false` e
`SCHEDULED_JOBS_ENABLED=false`. As variáveis de sistema da Vercel devem estar
expostas; a origem prefere `VERCEL_BRANCH_URL` e usa `VERCEL_URL` nos
deployments criados pela CLI sem alias de branch.

O workflow Preview não promove migrations de PR para essa branch persistente.
Integração PostgreSQL e E2E validam o schema novo em branches descartáveis.

Os valores abaixo pertencem a Production:

- URLs: `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
  `CERTIFICATE_PUBLIC_BASE_URL`;
- banco: `DATABASE_URL` pooled;
- auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS` quando necessário e
  `AUTH_PUBLIC_SIGNUP_ENABLED`;
- e-mail: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPORT_EMAIL`;
- pagamentos: credenciais e segredo de webhook AbacatePay;
- vídeo: credenciais JMVStream;
- R2: conta, dois buckets, chaves, origem pública e CORS;
- crons: `CRON_SECRET` e `SCHEDULED_JOBS_ENABLED`;
- observabilidade: Sentry e `HEALTHCHECK_SECRET`;
- build: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

As três URLs canônicas devem compartilhar a mesma origem HTTPS em Production.
Atualize os callbacks/webhooks dos providers somente depois que o domínio
definitivo responder no deployment novo.

## Crons

`vercel.json` é a autoridade das quatro agendas. A Vercel chama os Route
Handlers com `Authorization: Bearer <CRON_SECRET>`. Cada rota:

- recusa execução quando `SCHEDULED_JOBS_ENABLED=false`;
- adquire lease persistente em `scheduled_job_leases`;
- limita o trabalho ao prazo interno menor que `maxDuration`;
- libera somente o lease do próprio token;
- pode ser repetida sem depender da memória de uma instância.

Agendas UTC:

- `0 10 * * *`: matrículas;
- `*/5 * * * *`: JMVStream;
- `*/5 * * * *`: outbox;
- `0 4 * * *`: manutenção.

Mantenha o kill switch desligado durante configuração e smoke. Ative em
Production somente depois de migrations, providers e observabilidade estarem
confirmados.

## Smoke test

1. `/api/health` responde `ok`.
2. `/api/health/ready`, com segredo, comprova banco e migration mínima.
3. Login, cadastro, recuperação e fronteiras Admin/Aluna.
4. Curso, Aula, checkout e webhook de teste.
5. Upload direto JMVStream e R2, incluindo CORS.
6. Emissão, download autenticado e consulta pública de Certificado.
7. Uma chamada manual autorizada de cada cron em Preview.
8. Logs e evento de teste no Sentry sem PII.

## Rollback

- aplicação: redeploy de um SHA anterior somente se compatível com o schema;
- banco: forward-fix revisado, nunca reset ou migration destrutiva improvisada;
- variáveis: restaure a versão anterior no ambiente correto;
- mídia: preserve objetos até confirmar referências;
- jobs: desligue `SCHEDULED_JOBS_ENABLED` antes de conter um incidente recorrente.

O deployment anterior da Vercel é um recurso operacional, não um rollback de
schema. Migrations devem continuar expand/contract quando versões puderem
coexistir.

## Incidentes

Use `correlationId`, deployment SHA e ambiente para localizar logs. Nunca copie
tokens, URLs de banco ou payloads pessoais para tickets.

- pagamento: confira `webhook_events`, Pedido, revisão e projeção de acesso;
- e-mail/outbox: confira tópico, tentativas, dead letter e janela de
  idempotência do Resend;
- JMVStream/R2: diferencie presign, CORS, upload, processamento, cópia e delete;
- cron: confira kill switch, autenticação, lease, deadline e backlog;
- banco: confira URL alvo sem expor credencial, journal e migration mínima.

Registre horário UTC, ambiente, SHA, impacto, ação, resultado e responsável pela
próxima decisão.
