---
status: runbook
owner: engineering
last_verified_commit: 9fa916691ed1226233847f40b13bdfac6787c995
---

# Status da migração Vercel-first

Este documento registra o estado executado da sprint. Ele não substitui os
runbooks canônicos de deploy, banco, R2 e outbox; cada pacote atualiza também a
autoridade correspondente.

## Ambiente confirmado

- plano: Vercel Pro, confirmado manualmente pela proprietária;
- time: `Neuro Capacitar` (`team_mHFcEG9cedToJWgCu8ikH8VE`);
- projeto Vercel: `hub` (`prj_oHQOBsqhr7wlWpJoGVMTlw7ciyFg`);
- Neon definitivo: `damp-snow-22911188`;
- branch Neon: `production` (`br-dark-boat-ac5ju6m4`);
- região Neon: `aws-sa-east-1`;
- região Vercel decidida: `gru1`;
- journal local: 44 entradas, topo `0043_staged_admin_image_uploads`;
- journal de produção: 44 entradas, topo `0043_staged_admin_image_uploads`.

## Pacotes

### Pacote 0: desenho e inventário

**Status:** concluído em 2026-07-25.

Registrados arquitetura, interfaces de teste, limites de payload, estratégia de
jobs, separação de environments e sequência de promoção. A auditoria confirmou
que a stack é compatível e que não existe projeto Vercel criado.

### Pacote 1: runtime e banco

**Status:** concluído em 2026-07-25.

Configurados `gru1`, Node.js 24, output standalone apenas fora da Vercel e pool
de três conexões por instância serverless. README, arquitetura e runbook de
banco agora registram o alvo Vercel e paridade local/produção com 44
migrations, topo 0043. Testes focados passaram.

### Pacote 2: uploads diretos

**Status:** concluído e promovido em 2026-07-26.

Fundo/assinatura de Certificado, Banner e Capa de Curso agora usam PUT assinado
direto ao R2. Cada upload é registrado em `0043`, vinculado ao Admin e agregado,
confirmado por `HEAD` e reivindicado atomicamente para consumo único. Respostas
assíncronas antigas não substituem a seleção mais recente. Temporários só são
removidos depois do sucesso e a manutenção reconcilia abandonos com mais de 24
horas. A migration conjunta passou no Postgres descartável e a suíte integral
passou com 158 arquivos/597 testes, além de typecheck, Ultracite, docs,
migrations, build e Knip.

### Pacote 3: jobs e concorrência

**Status:** concluído e promovido em 2026-07-26.

As quatro rotas agora têm kill switch, lease persistente e prazo interno.
Outbox e JMVStream trabalham em lotes retomáveis sem reservar conexão durante
I/O externo. Deadlines e verificação de posse interrompem novas mutações quando
a invocação perde o lease. Artes substituídas de Certificado usam reconciliação
durável com carência, tombstone e retry. O ensaio inicial de `0042` foi
cancelado sem promoção depois da revisão. A validação autoritativa seguinte,
`ff79a0c9-5404-49d1-8582-bd7675fb8015`, confirmou journal, catálogo, conflito,
expiração e consumo único na branch `br-wild-dew-ac538g2r`. A migration foi
promovida à branch definitiva, auditada no topo `0043` e a branch temporária
foi removida.

### Pacote 4: CI/CD

**Status:** implementado; credencial GitHub project-scoped e primeiro run
pendentes.

A CI preserva todos os gates e cria um candidato Preview por build remoto após
sucesso. Um workflow separado e manual serializa migration e deployment
Production não promovido do SHA verde exato, testa `/api/health/ready` e só
então promove. O formulário exige confirmação, e o job prova que o SHA é o
`main` atual com CI verde antes de acessar o GitHub Environment. Segredos de
runtime não são baixados ao runner. Docker, GHCR e runner externo foram
removidos do caminho atual.

O projeto `neuro-capacitar/hub` foi criado sem deployment, vinculado ao
diretório local e auditado com preset Next.js e Node.js 24.x. O conector
confirma owner e project ID corretos.

### Pacote 5: promoção

**Status:** projeto, domínio e Production configurados; primeiro Preview
construído e primeiro deployment Production pendente.

O checklist operacional detalha criação sem deploy automático, separação
Preview/Production, matriz de secrets, GitHub Environments, domínio, providers,
primeira aprovação e evidência de smoke. `0042`/`0043` já estão auditadas em
produção. A branch Neon `vercel-preview` (`br-cool-leaf-acabyy5q`) foi criada,
teve todo dado herdado removido e preservou as 44 migrations. Recursos Preview
dos demais providers, domínio canônico e secrets do GitHub ainda dependem de
configuração externa.

As variáveis Production independentes de domínio foram cadastradas diretamente
na Vercel, com `SCHEDULED_JOBS_ENABLED=false`. O filtro excluiu
`DATABASE_URL_DIRECT`, `INTERNAL_BOOTSTRAP_SECRET`, valores E2E e as URLs ngrok
locais. As três URLs canônicas, `SUPPORT_EMAIL`, `RESEND_FROM_EMAIL` e a chave
Resend restrita foram adicionados depois das respectivas validações externas.

### Pacote 6: domínio e identidade de e-mail

**Status:** concluído; reset de senha real depende do primeiro deployment.

Definidos `app.neurocapacitar.com.br` como origem canônica da plataforma,
`Neuro Capacitar <notificacoes@neurocapacitar.com.br>` como remetente
transacional e `suporte@neurocapacitar.com.br` como endereço de atendimento.
O DNS permanece na Hostinger e o site institucional não foi alterado. A
auditoria inicial encontrou `app` livre; depois da configuração, consultas
públicas confirmaram o CNAME da Vercel, os MX/SPF do Lark Mail, o Return-Path,
DKIM e DMARC do Resend.

Preview agora deriva as três URLs canônicas do alias de branch somente quando
`VERCEL_ENV=preview`; a implementação será ajustada para preferir
`VERCEL_BRANCH_URL` e aceitar `VERCEL_URL` apenas sem Standard Deployment
Protection. Production continua exigindo
`https://app.neurocapacitar.com.br` explicitamente. E-mails transacionais usam
`SUPPORT_EMAIL` como `Reply-To` padrão, evitando respostas para a identidade sem
caixa `notificacoes@`.

As três URLs de Production e `RESEND_FROM_EMAIL` foram cadastrados no projeto
Vercel. A tentativa automatizada de associar `app` recebeu
`domain_not_owned`: o domínio já pertence a outra conta/time Vercel. O runbook
agora detalha a verificação TXT sem transferência, o CNAME de `app`, a caixa
Lark Mail, a verificação do domínio raiz no Resend e o cadastro seguro
de `RESEND_API_KEY`/`SUPPORT_EMAIL`.

Verificação local do pacote: 158 arquivos/601 testes, typecheck, Ultracite,
Knip, documentação e build Next.js passaram. Nenhum deployment foi iniciado e
os crons permanecem desligados.

Em nova auditoria DNS de 2026-07-26, apareceram o MX e SPF do Return-Path
`send.neurocapacitar.com.br` em `sa-east-1`, o DKIM
`resend._domainkey.neurocapacitar.com.br` e DMARC `p=none`. Isso prova
publicação DNS. O conector Resend confirmou depois o estado `verified`, envio
habilitado, recebimento desabilitado e tracking desligado. A chave
`hub-production`, limitada a envio por esse domínio, foi criada e cadastrada
como `RESEND_API_KEY` sensível somente em Production; o token não foi salvo no
repositório ou em arquivo local.

O TXT `_vercel` e o CNAME `app` foram publicados na Hostinger e a Vercel marcou
o domínio como configurado. Consultas autoritativas públicas confirmaram o
CNAME específico do projeto. Um smoke HTTPS com SNI recebeu
`DEPLOYMENT_NOT_FOUND` em `gru1`, comprovando DNS, TLS e roteamento antes do
primeiro deployment.

A caixa `suporte@neurocapacitar.com.br` foi criada e testada no Lark Mail. DNS
público confirma os três MX Lark e o SPF raiz; esses registros coexistem com o
Return-Path `send` do Resend. `SUPPORT_EMAIL` foi cadastrado em Production. Um
e-mail controlado saiu de `notificacoes@neurocapacitar.com.br`, usou a caixa de
suporte como `Reply-To` e alcançou o estado `delivered` no Lark.

### Pacote 7: Preview isolado e limitado

**Status:** implementado localmente em 2026-07-26; runtime Preview configurado,
credencial CI requer correção e smoke remoto permanece pendente.

Preview será um smoke de infraestrutura com Neon sanitizado, autenticação e
readiness próprios. Não receberá credenciais de AbacatePay, JMVStream, R2,
Resend ou qualquer dado de Production; jobs permanecerão desligados. A
validação falhará fechada se esses limites forem violados. Jornadas funcionais
continuam na CI e providers definitivos pertencem ao candidato Production.

O desenho também substitui a dependência primária de `VERCEL_URL` por
`VERCEL_BRANCH_URL`, pois a documentação atual da Vercel declara
`VERCEL_URL` incompatível com Standard Deployment Protection. O fallback antigo
só permanece para deployments Preview explicitamente desprotegidos.

A auditoria read-only do projeto confirmou `autoExposeSystemEnvs=true`,
Standard Deployment Protection em todos os deployments exceto domínios
personalizados, ausência de conexão Git e zero deployments. Portanto,
`VERCEL_BRANCH_URL` não é apenas preferência: é requisito para o primeiro
Preview protegido criado pelo workflow.

O runtime agora possui validação Preview separada e fail-closed. Ela exige Neon
pooled, segredos próprios de autenticação/readiness, atribuição
`x-forwarded-for`, cadastro público desligado, jobs desligados e alias de
branch. URLs canônicas explícitas, conexão direta, bootstrap, variáveis E2E e
credenciais de AbacatePay, JMVStream, R2, Resend ou Sentry bloqueiam o startup.
Production preserva seu contrato integral.

`application-origin` prefere `VERCEL_BRANCH_URL`; o fallback em `VERCEL_URL`
continua restrito ao utilitário para Preview desprotegido, enquanto o perfil
deste projeto exige o alias. O job Preview continua sem secrets de provider.
Verificação local desta fatia: 60 testes focados e typecheck passaram. Nenhum
deployment ou commit ocorreu.

A reauditoria Neon confirmou a branch `br-cool-leaf-acabyy5q` pronta, journal
com 44 entradas, hash de topo idêntico ao SQL local
`0043_staged_admin_image_uploads` e zero registros nos agregados auditados. O
compute Preview possui hostname pooled distinto de Production.

Foram cadastradas somente em Vercel Preview: `DATABASE_URL` pooled,
`BETTER_AUTH_SECRET` exclusivo, `HEALTHCHECK_SECRET` exclusivo,
`CLIENT_IP_SOURCE=x-forwarded-for`, `AUTH_PUBLIC_SIGNUP_ENABLED=false` e
`SCHEDULED_JOBS_ENABLED=false`. A listagem posterior confirmou exatamente os
seis nomes e o escopo, sem credenciais de providers. A proprietária confirmou o
mesmo `HEALTHCHECK_SECRET` no GitHub Environment; o primeiro workflow ainda
precisa provar a igualdade pelo smoke autenticado.

Verificação integral após o cadastro: Ultracite examinou 516 arquivos sem
alterações, documentação validou 23 documentos, migrations passaram, Vitest
passou 160 arquivos/639 testes, typecheck e check passaram, o build Next.js
16.2.11 concluiu todas as rotas e Knip saiu com código zero. Os hints de
configuração do Knip são preexistentes e não representam dependências órfãs.

A auditoria nominal de Production confirmou todas as capacidades exigidas e
nenhuma variável web proibida. `JMVSTREAM_AUTH_EMAIL` e
`JMVSTREAM_AUTH_PASSWORD` estavam cadastradas, mas não possuem consumidor no
schema, código, exemplo de ambiente ou documentação; ambas foram removidas
somente da Vercel Production. A autenticação vigente por
`JMVSTREAM_AUTH_RESOURCE`/token foi preservada. Crons continuam desligados.

A listagem de tokens Vercel expôs somente metadados. O token persistente
`GitHub hub deploy` foi criado, porém a API o reporta com escopo do time
`Neuro Capacitar` e sem expiração, não restrito ao projeto `hub`. Ele deve ser
substituído antes do primeiro workflow. Sessões de navegador, ChatGPT e CLI
local não serão reutilizadas no CI.

A tentativa de substituição com a sessão local retornou
`Cannot create tokens for this app. (403)`. Isso confirma que o login da CLI é
uma sessão OAuth de aplicativo, que a Vercel não permite usar para criar tokens.
O runbook agora exige um token clássico temporário de conta, mantido apenas em
memória, para criar o token project-scoped; ambos os tokens amplos serão
revogados depois da auditoria.

As tentativas seguintes provaram os limites da API: sem `--scope`, a criação
project-scoped recusa ausência de contexto do time; um token já limitado ao time
recusa `projectId`; e uma variável PowerShell vazia não fornece `--token`. Dois
tokens temporários foram publicados por engano no canal de suporte e passaram a
ser considerados comprometidos; o próximo passo obrigatório é revogá-los no
dashboard. Nenhum valor foi copiado para arquivos ou documentação. O comando
tecnicamente correto usaria um novo token temporário de conta completa com
`--scope neuro-capacitar --project <project-id>`, mas esse caminho não será
adotado no primeiro deploy.

A auditoria posterior listou somente o projeto `hub` no time
`Neuro Capacitar`. Assim, o hardening project-scoped não reduz o raio efetivo
hoje e foi reclassificado como overhead. O padrão aprovado passou a ser um token
do time criado diretamente no dashboard, com expiração máxima de 90 dias e
rotação se um segundo projeto entrar no time. Os tokens publicados continuam
comprometidos e devem ser revogados; essa simplificação não os torna válidos.

A rotação foi concluída. `GitHub hub deploy 2026-07` foi auditado no time
correto, com vencimento em 2026-10-24, e cadastrado pela proprietária no GitHub
Environment `vercel-preview`. Os tokens publicados não aparecem mais na
listagem, e o token anterior sem expiração foi revogado pela CLI e confirmado
ausente. A igualdade do `HEALTHCHECK_SECRET` e a validade prática do novo token
serão provadas pelo primeiro job Preview.

Após a rotação, os gates finais foram repetidos: Ultracite examinou 516 arquivos
sem alterações, documentação validou 23 documentos, migrations passaram,
Vitest passou 160 arquivos/639 testes, typecheck e check passaram, o build
Next.js 16.2.11 concluiu todas as rotas e Knip saiu com código zero. O diff
possui 75 arquivos rastreados alterados e 32 novos; `git diff --check` saiu com
código zero e a busca final não encontrou token Vercel em nenhum arquivo novo
ou alterado. Commit e push continuam condicionados à autorização explícita.

A auditoria nominal de Production confirmou 29 variáveis no escopo correto,
incluindo URLs canônicas, Neon pooled, Better Auth, R2, Resend, AbacatePay,
JMVStream, Sentry, readiness e kill switch de jobs. Nenhuma URL direta Neon,
variável E2E ou segredo de bootstrap foi encontrada no runtime. Uma busca nos
workflows, código, configuração e documentação canônica também confirmou que
Dockerfile, Docker Compose, Coolify, OpenShip, ngrok e o runner legado de jobs
não permanecem no caminho Vercel-first.

O pré-audit do conjunto local contabilizou 75 arquivos rastreados alterados e
32 novos. `git diff --check` saiu com código zero; os avisos exibidos são apenas
conversão LF/CRLF do Git no Windows. A busca por padrões de connection string
com senha, tokens Vercel/Resend, senha administrativa conhecida e chaves
privadas não encontrou credenciais candidatas nos arquivos alterados ou novos.

O repositório GitHub foi confirmado como privado. A documentação vigente do
GitHub restringe required reviewers de Environments a repositórios públicos nos
planos Free/Pro/Team; portanto, o gatilho automático `workflow_run` foi removido
para não permitir promoção silenciosa depois do merge. Production agora usa
`workflow_dispatch` com SHA completo, confirmação booleana, igualdade com o
`origin/main` atual e consulta autenticada das execuções verdes de `CI`. O teste
do contrato de deployment passou com 3 casos e 40 asserções.

O candidato inicial foi publicado no PR `#7`, SHA
`d6843576b7ce3fb4d02f583d6c482dfaeb1ae902`. Quality gates e integração
PostgreSQL passaram; 18 das 19 jornadas de navegador passaram. O trace da única
falha comprovou que a CSP bloqueava o `PUT` direto da arte de Certificado para o
storage hermético do E2E em `http://127.0.0.1:4568`. A correção preserva a CSP
de Production e acrescenta a origem somente quando `R2_ENDPOINT` passa pela
validação existente de E2E, restrita a HTTP loopback. O storage falso também
passou a responder o preflight CORS do upload direto, aceitando apenas origens
loopback e o header `content-type`. O preflight real respondeu `204` com origem,
método e header esperados. Sete testes focados, a suíte integral com 162
arquivos/643 testes, typecheck, documentação e Ultracite passaram; a nova
execução remota comprovou a jornada completa no SHA
`99a988f3509bdc979f4f8e9a29e4005c04e54a2a`.

Na mesma execução, Quality gates, Browser journeys, PostgreSQL integration e
Build/dependency audit passaram. O primeiro candidato Vercel chegou ao upload,
mas o build remoto parou no `bun install`: o script `prepare` tentava instalar
hooks Lefthook em um pacote sem metadata `.git`. O instalador de hooks agora tem
política explícita: instala e continua falhando normalmente em checkouts locais,
mas não executa em CI, Vercel ou source archives. O caminho exato
`VERCEL=1 bun install --frozen-lockfile` passou sem alterar dependências.

O GitHub Environment vazio `R2_PUBLIC_BASE_URL`, criado por engano, foi removido.
`vercel-production` foi criado com os IDs públicos corretos. O secret
`DATABASE_URL_DIRECT` foi obtido da branch Neon definitiva e validado contra o
compute direto `ep-hidden-tooth-ac843qc2`, sem reutilizar a credencial local
obsoleta de outro projeto. `HEALTHCHECK_SECRET` foi rotacionado com 32 bytes
aleatórios e sincronizado entre Vercel Production e GitHub. `VERCEL_TOKEN`
continua pendente em Production porque o GitHub não permite copiar ou ler o
secret já cadastrado em Preview.

O candidato Preview seguinte não falhou no build: a API Vercel o encerrou como
`BLOCKED`, com `TEAM_ACCESS_REQUIRED`, antes de executar qualquer build. A
autoria do commit está corretamente ligada ao GitHub `juniordinizm`, mas esse
GitHub ainda não consta em **Login Connections** da conta Vercel existente
`neurocapacitarprojetos`. A correção aprovada não cria outro membro nem altera
autoria: conecta o provedor GitHub à mesma conta Vercel. A execução presa foi
cancelada depois que todos os quatro gates anteriores passaram.

O workflow agora limita Preview a 20 minutos e Production a 30 minutos, evitando
runner indefinido se um provider devolver estado terminal desconhecido pela CLI.
Também informa explicitamente `githubCommitRef` e `githubCommitSha`; isso evita
registrar o merge checkout destacado como branch `HEAD` e mantém Preview e
release rastreáveis ao SHA candidato correto. O contrato automatizado cobre
esses invariantes.

A Login Connection com o GitHub `juniordinizm` foi concluída. A execução
`30229618404` aprovou os quatro gates anteriores e construiu o deployment
Preview `dpl_25C4uTAs4VWWAh3TYc9xLFzKto67` em `gru1`, estado `READY`, para o
SHA `f385123886f48258121b9170316806f01e62185e`. O único erro restante ocorreu
no smoke: o `vercel curl` não inferiu o time e recusou o recurso sob o scope
incorreto. A primeira correção tentou declarar `--scope neuro-capacitar`
explicitamente em todos os comandos.

A execução `30230235095` confirmou a autorização do time e criou outro Preview,
mas expôs uma particularidade da CLI 57: em `vercel curl`, `--scope` depois do
subcomando foi repassado ao curl nativo como opção desconhecida. A execução
`30230775100` provou que o comando beta também repassa a opção quando ela aparece
antes do subcomando. Todos os demais gates das duas execuções passaram.

A execução `30231483896` confirmou que `teams switch` persiste o time, mas o
comando beta ainda resolve o projeto no scope pessoal ao iniciar outro processo.
Esse caminho foi descartado.

A solução final usa o mecanismo estável recomendado pela Vercel para CI:
**Protection Bypass for Automation**. Um segredo dedicado, identificado no
painel como `GitHub Actions readiness smoke`, foi criado no projeto e armazenado
nos GitHub Environments `vercel-preview` e `vercel-production`. O smoke usa curl
nativo com `x-vercel-protection-bypass` e o header próprio
`Authorization: Bearer <HEALTHCHECK_SECRET>`. Deploy e promote continuam com o
scope explícito do time; o comando beta `vercel curl` saiu dos workflows.
