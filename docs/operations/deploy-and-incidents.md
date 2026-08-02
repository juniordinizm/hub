---
status: runbook
owner: operations
last_verified_commit: 4eab1a331f2d6989e5958aa0d6b55a66438f1396
---

# Deploy e incidentes

Este runbook explica o contrato técnico, configuração e recuperação. Para o
passo a passo diário, use o
[tutorial da alteração até Production](production-release-guide.md).

## Modelo de release na Vercel

O Hub usa Next.js nativo na Vercel Pro, Node.js 24 e região primária `gru1`.
Não existe imagem Docker, publicação GHCR ou runner de cron externo no caminho
de produção. A VPS anterior permanece fora do fluxo e não é autoridade de
release.

O workflow `CI` valida o código em Pull Requests e pushes para `staging` ou
`main`, sem criar deployments. Uma CI verde do SHA atual de `staging` dispara
`Deploy Vercel staging`, que cria backup Neon de sete dias, migra e publica no
Custom Environment `staging`. O backup declara `parent_branch` com o ID de Staging;
usar o input inexistente `parent` faz a action ignorar o ancestral pretendido. Os
workflows de Staging e Production consultam a branch criada pela API Neon e interrompem
a release antes da migration quando o `parent_id` diverge do ambiente esperado. O
gatilho automático aceita somente uma CI verde originada por `push` em `staging`;
uma CI de Pull Request com head `staging` não pode criar backup ou deployment. O
workflow manual `Deploy Vercel production`
recebe um SHA completo contido em `main`, exige duas confirmações, prova a CI
verde desse SHA e cria backup Neon de 14 dias antes da migration. Só então cria
um deployment Production sem promovê-lo, testa readiness e o promove. Deploys
Git automáticos da Vercel devem permanecer desligados.

O bootstrap de 2026-08-01 ocorreu antes de esses workflows existirem na branch
padrão. A CI `30726910261` aprovou o SHA
`4eab1a331f2d6989e5958aa0d6b55a66438f1396`; em seguida, o mesmo checkout local
executou o migrador guardado e `vercel deploy --target=staging` sobre esse SHA.
O deployment `dpl_9UYQJxnrWMZXqWBdQaZai4imkLkU` ficou `READY`, recebeu os aliases
de Staging e passou em readiness, `noindex,nofollow` e ausência de sitemap. Essa
exceção de bootstrap usou apenas dados explicitamente descartáveis de Staging.
Depois que o workflow chegar à `main`, releases seguintes devem usar
exclusivamente o caminho automatizado.

Na homologação final de 2026-08-02, a CI `30734378547` aprovou o SHA
`11704416ab64f9d6b3a1a8d6cf946c5d7fe2cef2`. O deployment manual de bootstrap
`dpl_4v6TvdoNchJJewiFsaFoyiZCQf5G` publicou esse SHA no target `staging`, ficou
`READY` e recebeu os aliases `preview.neurocapacitar.com.br` e
`hub-env-staging-neuro-capacitar.vercel.app`. A conciliação do reembolso parcelado
confirmou a solicitação, encerrou a Revisão de identidade bloqueada e preservou zero
Conta, Concessão e Matrícula para a compra inelegível. O Curso descartável foi restaurado
para R$ 19,90, Pix + cartão e máximo de 3x ao final.

Ainda em 2026-08-02, a PR `#20` promoveu Staging para `main` no commit
`cde26cf411b316446ab0493238e5ed66f22a35fe`; a CI `30735381462` aprovou esse
SHA. O workflow protegido `30735668308` criou backup Neon com expiração em
2026-08-16, aplicou e auditou as migrations de Production, publicou primeiro sem
promoção e validou readiness. Em seguida promoveu o deployment
`dpl_HquonccfkfWzyjJ7DDNkWX25U8Qb` e confirmou `503` em `/`, `/entrar` e `/admin`,
além de saúde e readiness válidos. Production permaneceu integralmente em manutenção;
nenhum checkout ou webhook de Production foi habilitado.

O primeiro disparo automático após essa promoção revelou duas falhas de configuração:
o secret `VERCEL_TOKEN` do Environment `vercel-staging` continha BOM e o backup usava
o input inválido `parent`. O token foi substituído sem BOM. Como `workflow_run` avalia
o arquivo da branch padrão, três retentativas ainda criaram backups descendentes de
Production antes da correção chegar a `main`; os três foram removidos. O contrato
versionado passou a exigir `parent_branch`, proibir `parent` por teste automatizado e
confirmar a ancestralidade pela API antes de qualquer migration.

O run `30738007829`, tentativa 2, reaplicou as migrations de forma idempotente e publicou o deployment
`dpl_BWy4dBVMfCkPfBimAEuFkWBvYS1z`. O `HEALTHCHECK_SECRET`, também contaminado no
provisionamento inicial, foi rotacionado com o mesmo valor limpo no Custom Environment
Vercel e no GitHub Environment. O smoke confirmou raiz não indexável, sitemap ausente e
readiness autenticada. Os backups dessa rodada foram posteriormente removidos por terem
ancestralidade incorreta; a proteção adicional impede a repetição silenciosa.

A auditoria seguinte identificou que uma CI de Pull Request com head `staging` também
satisfazia o filtro `workflow_run.branches` e disparava um segundo deployment do mesmo
SHA. O job passou a exigir `workflow_run.event == 'push'`; o backup redundante dessa
execução foi removido e o teste de contrato impede regressão.

### Ambientes

- `vercel-staging`: ambiente protegido no GitHub. Contém secrets operacionais
  para backup, migration, deploy e seed/reset do Staging persistente.
- `vercel-production`: ambiente protegido no GitHub. Contém token de deploy,
  segredo de readiness e URL direta de migration.
- `neon-development`: ambiente protegido no GitHub. Contém somente a URL direta
  da branch Development e o hostname esperado desse compute.
- Vercel Staging: Custom Environment associado à branch `staging` e ao domínio
  `preview.neurocapacitar.com.br`.
- Vercel Preview: perfil dormente, fail-closed e sem providers.
- Vercel Production: perfil definitivo; em manutenção integral até promoção
  deliberada.

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
4. Staging: CI verde do SHA atual cria backup, migra, publica com
   `--target=staging` e testa URL do deployment e domínio estável.
5. Produção: despacho manual com SHA completo e confirmações de manutenção.
6. Produção: prova de pertencimento a `main` e CI verde do mesmo SHA.
7. Produção: backup Neon confirmado, `db:migrate:production` e auditoria.
8. Produção: `vercel deploy --prod --skip-domain`.
9. Produção: smoke autenticado de readiness no deployment isolado.
10. Produção: promoção e smoke de manutenção (`503` nas superfícies públicas).

O grupo de concorrência de produção não cancela uma execução em andamento. Isso
evita interromper uma migration para iniciar outra. Como o repositório é privado
e required reviewers de Environments não estão disponíveis nos planos
GitHub Free/Pro/Team, a autorização humana é o próprio `workflow_dispatch`:
marque `confirm_production` e digite `DEPLOY_PRODUCTION_MAINTENANCE`. O workflow
recusa SHA que não pertença a `main`, não possua CI verde ou não corresponda ao
checkout.

Não avance quando houver migration não validada, Preview usando dados
definitivos, variável ausente, falha de CI, webhook não conferido ou alteração
irreversível sem plano de recuperação.

O workflow `Run Staging jobs` chama os workers frequentes a cada cinco minutos
e os jobs diários em horários próprios. Essa latência de até cinco minutos é
aceita em homologação. Schedules do GitHub só executam a versão presente na
branch padrão. O GitHub também não registra `workflow_dispatch` de um arquivo
ausente na branch padrão; portanto não existe despacho manual pela UI antes do
primeiro merge. O único bootstrap permitido é o procedimento exato documentado
acima, com CI verde e SHA imutável.

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
- secret `NEON_API_KEY`, usado somente pelo workflow manual de limpeza;
- variables `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`;
- variables `PRODUCTION_NEON_PROJECT_ID`, `PRODUCTION_NEON_BRANCH_ID` e
  `PRODUCTION_DATABASE_HOST`, usadas para fechar o alvo da limpeza.

### Corte Asaas em duas releases

A Release A deve ser publicada primeiro sobre o schema `0043`, com
`PAYMENTS_CHECKOUT_MODE=disabled` já configurado em Vercel Production. O smoke deve
provar que as entradas autenticada e pública retornam indisponibilidade antes de sessão,
banco ou provider e que a Conta Admin continua acessível.

Ao definir enum ou booleano pela Vercel CLI em PowerShell, não use pipeline textual
com CRLF. O caractere `CR` pode ser persistido depois que a CLI remove apenas o `LF` e
faz o preflight Zod falhar. Envie bytes exatos sem terminador ou use o painel; um novo
deployment é obrigatório porque variáveis Vercel são capturadas no build.

A Release B deve entrar com `ASAAS_WEBHOOK_ENABLED=false` e checkout ainda
desabilitado. A limpeza dos dados de teste é um workflow manual separado: `plan` não
escreve nem cria backup; `execute` exige fingerprint, duas confirmações e cria uma
branch Neon de backup sem expiração automática antes da transação. O backup permanece
durante a estabilização e só pode ser removido após aceite explícito. O workflow não
executa migration, deploy ou exclusão da branch de backup.

O corte de 2026-07-31 concluiu essa fase fechada. A limpeza preservou somente a
Conta Admin e sua identidade, manteve o backup `br-withered-tree-acj50vrb` e
zerou todas as tabelas operacionais. O deploy `30605515827` aplicou `0044` a
`0052` e promoveu a Release B. O smoke retornou destino final `200` no acesso
público, `503` no checkout, `503` no webhook Asaas e `404` na rota legada,
confirmando o estado fechado esperado. Não habilite checkout, webhook ou worker
antes de configurar e validar as credenciais Asaas de Production.

Nunca registrar respostas completas da API Neon, URLs de conexão, tokens, IDs de Conta
ou PII. Somente presença de configuração, contagens, fingerprint, status e ID da branch
de backup podem aparecer nos logs.

### GitHub Environment `neon-development`

- secret `DATABASE_URL_DIRECT`, apontando à branch Neon `development`;
- variable `DEVELOPMENT_DATABASE_HOST`, contendo somente o hostname direto
  `ep-silent-leaf-aclmy5uk...neon.tech`, sem protocolo, usuário ou senha.

O workflow `Migrate Neon development` deve ser executado apenas na `main`, depois
da CI verde, e somente quando o merge contiver migration. Sua concorrência não
cancela uma migration em andamento.

O Preview persistente não recebe migrations de PR. Cada candidato da CI cria
uma branch Neon efêmera, aplica nela a cadeia validada e a injeta somente no
deployment daquele run. Não aplique SQL manualmente em `vercel-preview`.

### Vercel

Configure cada valor no ambiente correto. Preview nunca reutiliza banco, bucket,
webhook ou credenciais financeiras de Production.

O projeto usa a máquina Standard na fila compartilhada. O On-Demand Concurrent
Builds deve permanecer desligado no escopo do projeto: esta equipe não precisa
furar a fila, e habilitá-lo torna os minutos da máquina Standard cobrados. Essa
configuração de infraestrutura é independente do grupo de concorrência do
workflow Production, que continua impedindo duas releases simultâneas.

Preview recebe `BETTER_AUTH_SECRET`, `HEALTHCHECK_SECRET`,
`CLIENT_IP_SOURCE=x-forwarded-for`, `AUTH_PUBLIC_SIGNUP_ENABLED=false` e
`SCHEDULED_JOBS_ENABLED=false`. As variáveis de sistema da Vercel devem estar
expostas; a origem prefere `VERCEL_BRANCH_URL` e usa `VERCEL_URL` nos
deployments criados pela CLI sem alias de branch.

`DATABASE_URL` continua configurada para a branch persistente como fallback de
infraestrutura, mas o workflow substitui o valor somente no deployment candidato
pela URL pooled da branch efêmera migrada. Integração PostgreSQL, E2E e Preview
usam três branches descartáveis distintas e as removem ao terminar.

Os valores abaixo pertencem a Production:

- URLs: `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
  `CERTIFICATE_PUBLIC_BASE_URL`;
- banco: `DATABASE_URL` pooled;
- auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS` quando necessário e
  `AUTH_PUBLIC_SIGNUP_ENABLED`;
- e-mail: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPORT_EMAIL`;
- pagamentos: credencial, base URL, User-Agent e token de webhook Asaas;
- vídeo: credenciais JMVStream;
- R2: conta, dois buckets, chaves, origem pública e CORS;
- crons: `CRON_SECRET` e `SCHEDULED_JOBS_ENABLED`;
- observabilidade: Sentry e `HEALTHCHECK_SECRET`;
- build: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

As três URLs canônicas devem compartilhar a mesma origem HTTPS em Production.
Atualize os callbacks/webhooks dos providers somente depois que o domínio
definitivo responder no deployment novo.

## Crons

`vercel.json` é a autoridade das cinco agendas. A Vercel chama os Route
Handlers com `Authorization: Bearer <CRON_SECRET>`. Cada rota:

- recusa execução quando `SCHEDULED_JOBS_ENABLED=false`;
- adquire lease persistente em `scheduled_job_leases`;
- limita o trabalho ao prazo interno menor que `maxDuration`;
- libera somente o lease do próprio token;
- pode ser repetida sem depender da memória de uma instância.

Agendas UTC:

- `* * * * *`: inbox de webhooks Asaas;
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
7. Uma chamada controlada do cron afetado em Development ou, quando
   indispensável, no candidato/ambiente Production sob observação. Preview não
   possui providers e mantém jobs desligados.
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

- pagamento: confira `webhook_events`, Pedido, revisão, solicitação de reembolso,
  movimentos do extrato e projeção de acesso. Alertas administrativos expõem fila
  Asaas, eventos falhos, Pedidos pagos sem ID de pagamento e reembolsos incertos;
- e-mail/outbox: confira tópico, tentativas, dead letter e janela de
  idempotência do Resend;
- JMVStream/R2: diferencie presign, CORS, upload, processamento, cópia e delete;
- cron: confira kill switch, autenticação, lease, deadline e backlog;
- banco: confira URL alvo sem expor credencial, journal e migration mínima.

Registre horário UTC, ambiente, SHA, impacto, ação, resultado e responsável pela
próxima decisão.
