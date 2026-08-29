---
status: accepted
owner: engineering
last_verified_commit: 0527164842b68e3ea804420f0ff5ee170b0fc964
audit_date: 2026-08-29
---

# Auditoria de saúde do repositório — 2026-08-29

## Decisão operacional

**Estado: AMARELO.** A aplicação pública continua respondendo e não há erro
ativo no deployment Production atual. A árvore de arquivos de `staging` agora
contém a reconciliação de `main` e os patches de Staging; os últimos patches
passaram CI, deploy protegido e smoke. Ainda há gates operacionais antes de
retomar novas features em fluxo normal: promoção controlada para `main`,
revalidação dos gates externos de Production, controles de conta e decisão
administrativa sobre o run zombie.

Production não foi alterada durante esta auditoria. Nenhuma migration,
configuração, dado, domínio, deployment ou provider Production foi modificado.

## Checkpoint de proteção do repositório e documentação — 2026-08-29

O PR `#143` habilitou, no repositório público `juniordinizm/hub`, Secret
Scanning, Push Protection, Dependabot Security Alerts e Dependabot Security
Updates. A API confirmou os quatro estados como `enabled`; não havia alertas
ativos de segredo ou de vulnerabilidade na consulta. O Code Scanning foi então
configurado pelo default setup do GitHub com a suíte `default`, runner
`standard` e linguagens autodetectadas para Actions/JavaScript-TypeScript. A
configuração não altera o runtime nem adiciona dependência paga. A primeira
análise do SHA histórico de `main` encontrou três alertas abertos de alta
severidade: dois `js/xss-through-dom` nos iframes de JMVStream e um
`js/double-escaping` no servidor de objetos de E2E. A correção foi mesclada
em Staging no PR `#146`; o resultado definitivo depende de uma nova análise
após a promoção futura para `main`.

O PR `#144` atualizou este relatório para o commit verificável
`77d34cf4e5f05af9f4809ddc61c727a8c158df09`. A CI pós-merge `33265057590` e o
deploy protegido de Staging `33265665028` passaram todos os gates, inclusive
backup/ancestry Neon, migrations, publicação da SHA exata e smoke do alias
`preview.neurocapacitar.com.br`. O cleanup controlado `33265643919` removeu
somente `br-shy-silence-ac759tip` e preservou `br-steep-darkness-acniyejp`.
Production permaneceu intocada.

O PR `#146` foi validado pela CI `33267067065`, mesclado no commit
`ed59130a17cbf7412c7354dbd598924c70f6b397` e publicado pelo deploy protegido
`33268106032`. O cleanup `33268084085` removeu somente o backup efêmero
`br-steep-darkness-acniyejp` e preservou `br-wandering-voice-acnkvs1o`.
Production permaneceu intocada.

## Escopo e método

Foram conferidos, em modo somente leitura salvo pela limpeza explicitamente
autorizada:

- estado local, branches, worktrees, refs, reflog e objetos inalcançáveis;
- branches, PRs, regras, workflows e execuções no GitHub;
- deployments e erros de runtime na Vercel;
- arquivos de código, testes, configuração, documentação e lockfile;
- alinhamento com `README.md`, `PRODUCT.md`, `CONTEXT.md`, `docs/README.md`,
  ADRs e o plano mestre de Production Readiness.

Nenhum secret foi impresso. Valores de ambiente foram tratados somente como
presença, ausência ou tipo de credencial.

## Requalificação externa — 2026-08-29

Esta seção registra somente consultas externas de leitura e o ensaio remoto
explicitamente não destrutivo executado em Staging. Nenhuma configuração DNS,
Sentry, Conta, sessão, banco de dados ou deployment de Production foi alterada.

### Sentry

- A API da organização `neurocapacitar` confirmou dois projetos ativos:
  `hub-web` (ID `4511808556564480`) e `hub-production` (ID
  `4511951566798848`). O slug canônico de desenvolvimento é `hub-web`; a API
  ainda apresenta o nome de exibição legado `hub-development`. Nenhuma
  renomeação ou consolidação foi feita.
- No projeto `hub-web`, o alerta `Hub Production readiness` está ativo. O
  evento sintético de Staging `f74a01d2a4e846deb2f4a770b16d5928`, emitido para o
  release `f9eb31ae2a4019a376660269f609518ac303faaf`, passou o checker com:
  `match=true`, `sourceMapped=true` e `alertTriggered=true`.
- A consulta de issues não resolvidas nos últimos 14 dias encontrou cinco
  registros em `hub-web/staging`: dois grupos sintéticos do probe, um
  `AccessDenied` no cron de manutenção, uma terminação inesperada de conexão no
  outbox e um erro histórico de Server Components. Os probes sintéticos são
  evidência do ensaio, não incidente de produto; os três demais permanecem na
  fila de triagem e impedem declarar a observabilidade de Staging totalmente
  verde.
- `hub-web/production` mantém cinco issues históricas não resolvidas no
  período, e `hub-production/production` não apresentou issue não resolvida no
  mesmo recorte. Isso é uma fotografia de observabilidade, não prova de que a
  árvore candidata foi servida em Production.
- O evento próprio de Production não foi emitido: a política reserva essa
  ação para depois de uma candidata promovida e de autorização explícita.

**Resultado do gate Sentry:** Staging requalificado; Production ainda pendente
do fluxo de promoção protegido e do probe próprio posterior.

### DMARC

Às `2026-08-29T19:49:38Z`, os resolvers públicos `1.1.1.1` e `8.8.8.8`
retornaram exatamente um TXT para `_dmarc.neurocapacitar.com.br`:

```text
v=DMARC1; p=none; pct=100; rua=mailto:suporte@neurocapacitar.com.br; adkim=r; aspf=r; ri=86400
```

A publicação e a propagação estão consistentes. O estágio inicial começou em
`2026-08-29T00:06:50Z` e só termina em `2026-09-12T00:06:50Z`; não há base
para avançar a política antes dessa janela e dos relatórios agregados. A caixa
de `rua` e o diretório local `.dmarc-reports` não foram disponibilizados para
esta consulta, portanto não foi possível analisar alinhamento de remetentes,
bounce ou complaint. O registro DNS permaneceu intocado.

**Resultado do gate DMARC:** propagação confirmada; observação e análise de
relatórios ainda bloqueiam a progressão e o fechamento de `F-006`.

### Contas administrativas e TOTP

- O ambiente GitHub `vercel-staging` contém os quatro nomes de secrets esperados
  para as duas Contas Admin de Staging (conta primária e conta de recuperação),
  além das variáveis de host, projeto e branch Neon. A presença dos nomes não
  revela valores nem comprova login.
- O workflow `Reset Staging data` foi executado em modo `plan` no run
  `33271984257`, apontado para `staging`, e terminou com sucesso sem backup,
  truncate, seed ou limpeza de objetos. A leitura remota encontrou a tabela
  `two_factors` com `0` registros, logo não existe TOTP cadastrado no banco de
  Staging no momento desta requalificação.
- Não foi possível comprovar por leitura remota login das duas Contas Admin,
  challenge TOTP, uso único de backup code ou revogação de sessão. Essas provas
  dependem de interação com o autenticador e não podem ser inferidas pela
  existência de secrets de senha.

**Resultado do gate administrativo:** não requalificado. Antes de ativar
`PRIVILEGED_MFA_ENFORCED`, duas Contas Admin distintas precisam concluir o
setup de TOTP em Staging; uma delas precisa provar recuperação com backup code.
Depois, o login autenticado de ambas e a revogação de sessão devem ser
registrados sem copiar códigos ou segredos para o repositório.

### Decisão consolidada

O estado externo permanece **AMARELO**: o gate Sentry de Staging passou, o
registro DMARC está corretamente publicado mas ainda em observação, e o gate
de contas administrativas está bloqueado por ausência de TOTP efetivamente
cadastrado. Não há autorização técnica para emitir o probe de Production,
alterar a política DMARC, consolidar projetos Sentry ou promover `main` nesta
requalificação.

## Evidências verdes

### Verificação local

As verificações abaixo passaram no workspace:

```text
bun run docs:check
Documentação válida: 35 documentos canônicos.

bun run db:migrations:check
Migrations validas.

bun run check
Checked 884 files. No fixes applied.

bun run knip
exit 0; somente sugestões de configuração.

bun audit --production
{}; nenhum advisory retornado.
```

O working tree continha somente alterações em documentos operacionais. Não há
arquivo de build ou `node_modules` rastreado; `.env.local` está ignorado.

### GitHub Actions

O ruleset `protect-release-branches` está ativo para `main` e `staging`. Ele
impede deleção e non-fast-forward e exige os quatro checks:

- `Quality gates`;
- `PostgreSQL integration`;
- `Browser journeys`;
- `Build and dependency audit`.

Os quatro checks passaram no CI do `main` (`f3cd21b`) e no CI do `staging`
(`7929b64`). Os backups Production agendados mais recentes e os workflows de
limpeza também passaram.

### Vercel e Production

O deployment Production atual consultado foi
`dpl_8TdrhAsLdPF6BCDSuw5ArE8VCkFb`, READY, SHA
`1c0202f935934285901f90e2b8c68f887f00222e`. O deployment Staging atual foi
`dpl_5J7v7Qb7ztR5GPo3PKft77d99Y9v`, READY, SHA
`f9eb31ae2a4019a376660269f609518ac303faaf`.

Após a reconciliação, o workflow `Deploy Vercel staging` `33254285118`
publicou o topo de `staging` (`28cc7d9`) e passou backup Neon, ancestry,
migrations, publicação da SHA exata e smoke do alias estável
`preview.neurocapacitar.com.br`. Production não foi promovida.

O PR documental `#138` foi então mesclado em `staging`, produzindo o topo
`858eb5ab7df24a5adca2a23e692ec1c43138dc97`. Sua CI pós-merge
`33255552588` passou os quatro gates. O primeiro deploy automático
`33255999615` falhou antes da publicação com `BRANCHES_LIMIT_EXCEEDED`, sem
alterar Vercel ou banco; o dry-run/execute de cleanup `33256066788` removeu
somente o backup superseded `br-young-waterfall-acf3tzj4` e preservou
`br-misty-silence-ac6gomqq`. O deploy protegido repetido
`33256090157` passou backup, ancestry, migrations, publicação e smoke do
alias estável. Production permaneceu intocada.

As sondas públicas retornaram:

```text
/                         200
/entrar                   200
/comprar/protea-r         200
/api/health               200
/api/checkouts/course     400  (validação sem parâmetros; checkout habilitado)
/api/webhooks/asaas      401  (autenticação ausente; proteção ativa)
/api/webhooks/resend     400  (payload inválido; rota ativa)
```

Não foram encontrados erros de nível `error`/`fatal` nos deployments Production
ou Staging atuais. Os erros de `RESEND_WEBHOOK_SECRET` encontrados na Vercel são
históricos, ocorreram em um deployment Production anterior
(`dpl_CFqwntMuWPRmeL3Nbxsk46GNiTt9`) em 25 de agosto e não reapareceram no
deployment Production atual.

## Limpeza segura executada

### Branches remotos

Foram removidas 29 refs remotas que atendiam simultaneamente a todos os
critérios:

- PR já mesclada;
- nenhuma PR aberta apontando para a branch;
- branch não era `main` nem `staging`;
- nenhum worktree Git ativo apontava para ela.

As PRs e os commits de merge continuam preservados no histórico do GitHub.
Após a remoção, `git fetch --prune origin` eliminou as refs locais obsoletas.

Foram preservados:

- `main` e `staging`;
- as cinco PRs Dependabot abertas;
- as duas branches de PRs fechadas não mescladas;
- `codex/docs-staging-first`;
- `codex/restore-node-tls` e seu worktree ativo;
- todas as branches locais que não têm equivalente remoto.

### Execuções GitHub

Cinco das seis execuções antigas em `queued` foram canceladas automaticamente
pelo GitHub durante a auditoria. A execução `32985845134` permanece em estado
inconsistente: a consulta informa `queued`, mas os endpoints de cancelamento
normal e forçado retornam HTTP 409 informando que ela ainda não está em estado
cancelável. Ela não possui jobs nem runner associado e deve ser tratada pelo
GitHub ou removida pela interface administrativa, sem apagar evidência de
código.

### O que não foi removido

Não foram apagados branches locais, commits inalcançáveis, worktrees físicos,
arquivos de código ou diretórios fora do Git. O diretório
`C:\Users\Junior\.config\superpowers\worktrees\hub\certificate-hardening`
contém código e aproximadamente 969 MB de artefatos; sua exclusão sem
inspeção seria insegura.

## Checkpoint pós-merge — 2026-08-29

O PR `#135` foi mesclado por squash em `staging` no commit
`01700ae04d9880bd2f433ce35a781d8d2ffbc146`. A CI pós-merge `33250715335`
passou os quatro jobs: Quality gates, PostgreSQL integration, Browser journeys
e Build and dependency audit.

O dry-run de cleanup Neon identificou somente o backup superseded
`br-dark-boat-ac54ehu3`, mantendo `br-broad-silence-aczlme90`. O execute
`33251220857` removeu exatamente o candidato proposto.

O deploy manual de Staging `33251243839`, apontado explicitamente para `staging`,
passou todas as etapas: SHA exato, configuração, criação e ancestry do backup,
migrations, deployment Vercel e smoke no deployment e no alias estável. O
deployment publicou o SHA `01700ae04d9880bd2f433ce35a781d8d2ffbc146`.

Esse checkpoint comprova que a quota Neon foi liberada para uma execução normal
e que o guard aceitou o fluxo correto de Staging. Ainda falta observar uma
execução originada de CI de `main` para comprovar o caminho rejeitado; nenhuma
promoção ou alteração em Production ocorreu.

## Achados priorizados

### [CORRECTNESS-01] Fechar o guard de branch do deploy de Staging

- **Evidência:** `.github/workflows/deploy-staging.yml:19-22` aceita qualquer
  `workflow_run` concluído com sucesso e evento `push`; as execuções
  `33221611162`, `33219937396`, `33217436193` e `33212181574` foram criadas com
  `headBranch=main` e tentaram o caminho de Staging.
- **Impacto:** um CI de `main` pode criar backup Neon e iniciar um deploy de
  Staging, contrariando `feature → staging → homologação → main`.
- **Esforço:** S.
- **Risco da correção:** MED — o dispatch manual legítimo precisa continuar
  permitido.
- **Confiança:** HIGH.
- **Estado:** merge e deploy de Staging concluídos; falta observar uma execução
  automática originada de `main` para fechar a evidência negativa.
- **Correção resumida:** exigir no `if` que o `workflow_run` tenha
  `head_branch=staging`, além do filtro declarativo, e cobrir o guard em teste
  de contrato.

### [CORRECTNESS-02] Resolver o limite de branches Neon antes de nova release

- **Evidência:** as três últimas execuções automáticas de Staging falharam na
  criação de `staging-release-<run_id>-<attempt>` com HTTP 422
  `BRANCHES_LIMIT_EXCEEDED`.
- **Impacto:** a publicação para Staging para antes da migration e não chega ao
  smoke.
- **Esforço:** M.
- **Risco da correção:** HIGH — cleanup equivocado pode remover uma branch de
  recuperação ou de ambiente persistente.
- **Confiança:** HIGH.
- **Estado:** parcialmente resolvido; um backup superseded foi removido e o
  deploy de Staging seguinte passou, mas a política recorrente de quota ainda
  precisa de acompanhamento.
- **Correção resumida:** inventariar branches Neon, executar dry-run, preservar
  os ambientes persistentes e remover somente backups efêmeros expirados;
  repetir deploy e conferir ancestry.

### [DX-01] Reconciliar `main` e `staging`

- **Evidência:** no início da auditoria, `origin/main=f3cd21b` e
  `origin/staging=7929b64` divergiam desde `32ddbbd`; havia 87 commits
  exclusivos de `main` e 10 exclusivos de `staging`, com diferença direta em
  44 arquivos. Após o PR `#135`, `staging` avançou para `01700ae`, mas a
  divergência estrutural com `main` permanece.
- **Impacto:** `staging` não contém todos os patches de backup, restore, R2 e
  release que já estão em `main`; uma promoção direta pode perder correções ou
  gerar conflito em Sentry e operações.
- **Esforço:** L.
- **Risco da correção:** HIGH — merge mal resolvido pode alterar contratos de
  produção.
- **Confiança:** HIGH.
- **Estado:** aberto e bloqueante para novas features.
- **Correção resumida:** criar branch de integração a partir de `staging`,
  incorporar `main`, revisar cada conflito, executar CI/deploy/smoke de Staging
  e só depois abrir PR separado `staging → main`.

### [ARCH-01] Classificar worktrees e branches locais restantes

- **Evidência:** o Git reconhece dois worktrees limpos, mas existem oito
  diretórios físicos não registrados; há 12 branches locais sem equivalente
  remoto e 84 commits inalcançáveis.
- **Impacto:** limpeza futura pode apagar código WIP ou snapshots necessários;
  nomes de diretório e branch também estão desalinhados em
  `production-normalization`/`codex/restore-node-tls`.
- **Esforço:** M.
- **Risco da correção:** HIGH — exclusão é potencialmente irreversível.
- **Confiança:** HIGH para a existência; MED para a classificação de conteúdo.
- **Estado:** parcialmente tratado; remoção pendente de inspeção humana.
- **Correção resumida:** gerar inventário por diretório, branch, PR, reflog e
  data; preservar `certificate-hardening` até leitura do conteúdo; só então
  remover diretórios vazios e branches locais sem valor.

### [SECURITY-01] Aplicar limite de corpo antes de materializar webhook Resend

- **Evidência inicial:** a rota materializava `request.text()` antes de aplicar
  o limite de 256 KiB.
- **Impacto:** um corpo grande com headers presentes pode consumir memória e CPU
  antes de ser rejeitado; o limite declarado não protege a leitura.
- **Esforço:** S.
- **Risco da correção:** MED — os bytes usados pela verificação Svix precisam
  permanecer exatamente iguais.
- **Confiança:** HIGH.
- **Estado:** implementado no candidato de Staging.
- **Correção resumida:** `readLimitedBody` aplica o limite durante a leitura,
  cancela o stream ao exceder 256 KiB e trata `Content-Length` ausente, inválido
  ou acima do limite. O corpo bruto legítimo continua sendo o mesmo usado pela
  verificação Svix.

### [TEST-01] Cobrir as fronteiras HTTP críticas

- **Evidência inicial:** não havia testes diretos para exportação de analytics,
  cron de enrollments, cron de JMVStream e cron de maintenance; existiam testes
  apenas para parte das rotas de cron/webhook.
- **Impacto:** regressões de autorização, lease, resposta HTTP e execução
  duplicada podem chegar à produção sem teste específico.
- **Esforço:** M.
- **Risco da correção:** LOW.
- **Confiança:** HIGH.
- **Estado:** implementado no candidato de Staging.
- **Correção resumida:** quatro contratos de rota agora cobrem resposta de
  autorização/jobs desligados antes do lease, lease ocupado, sucesso,
  contexto de deadline/owner, CSV escapado e códigos de falha encaminhados à
  observabilidade sem materializar o erro bruto na resposta.

### [DOCS-01] Atualizar metadados de verificação documental

- **Evidência:** no início desta auditoria, os cinco documentos operacionais
  modificados no workspace apontavam `last_verified_commit` para snapshots
  anteriores ao conteúdo atual; os metadados foram atualizados antes do commit.
- **Impacto:** o histórico pode indicar que uma afirmação foi verificada contra
  um commit que não contém o texto registrado.
- **Esforço:** S.
- **Risco da correção:** LOW.
- **Confiança:** HIGH.
- **Estado:** resolvido nesta alteração documental, com todos os frontmatters
  apontando para o baseline existente `7929b64`.
- **Correção resumida:** após criar o commit, atualizar cada frontmatter para um
  SHA existente que contenha o código/documentação contra o qual a afirmação foi
  conferida e rodar `bun run docs:check`.

### [SECURITY-02] Reavaliar proteções nativas do GitHub

- **Evidência:** o repositório público tem Secret Scanning, Push Protection,
  Dependabot Security Alerts, Dependabot Security Updates e Code Scanning
  desativados.
- **Impacto:** um segredo ou vulnerabilidade pode entrar no repositório sem
  alerta automático.
- **Esforço:** S/M, dependendo das opções disponíveis na conta.
- **Risco da correção:** LOW.
- **Confiança:** HIGH.
- **Estado:** decisão operacional pendente; não é incidente ativo.
- **Correção resumida:** avaliar e habilitar apenas os recursos compatíveis com
  o plano Free, sem alterar o runtime.

### [SECURITY-03] Alertas Code Scanning em componentes legados de vídeo e E2E

- **Evidência:** a primeira análise default do CodeQL no SHA histórico de
  `main` encontrou os alertas `#1` e `#2` (`js/xss-through-dom`) nos sinks de
  iframe de JMVStream e o alerta `#3` (`js/double-escaping`) no parser XML do
  servidor de objetos de E2E.
- **Impacto:** URL de iframe derivada de formulário não tinha uma defesa
  explícita no componente; a decodificação em cadeia podia transformar uma
  entidade XML aninhada em caractere estrutural.
- **Esforço:** S.
- **Risco da correção:** LOW/MED — o player precisa continuar carregando e o
  contrato do mock de storage precisa permanecer compatível.
- **Confiança:** HIGH.
- **Estado:** PR `#146` mesclado e publicado em Staging; alertas permanecem
  abertos no SHA antigo até nova análise após promoção.
- **Correção resumida:** canonicalizar somente `https://player.jmvstream.com`
  sem porta ou credenciais, usar sandbox com scripts para os iframes do editor e
  decodificar entidades XML em uma única substituição. Testes focados e suíte
  completa passam no candidato.

### [DEPENDENCY-01] Não mesclar Dependabot sem decisão de compatibilidade

- **Evidência:** PRs #68, #69, #70 e #122 falham em typecheck/build/audit por
  mudanças incompatíveis; PR #6 passa, mas ainda é upgrade não aprovado.
- **Impacto:** mesclar agora pode quebrar o editor, tabelas administrativas ou
  o build, contrariando a política Free-first sem necessidade.
- **Esforço:** M/L por PR, caso algum upgrade seja escolhido.
- **Risco da correção:** MED/HIGH.
- **Confiança:** HIGH.
- **Estado:** manter aberto sem merge.
- **Correção resumida:** deixar as PRs pendentes; quando houver autorização,
  tratar cada upgrade isoladamente com CI completo e rollback claro.

## Falso positivo rejeitado

A rota de exportação de analytics não está sem autorização server-side. Embora
`src/app/api/admin/learning-analytics/export/route.ts` não chame o helper
diretamente, `getLessonAnalyticsMetrics()` em
`src/features/learning-analytics/server.ts` executa
`requirePermission("manageLearningAnalytics")` antes da consulta.

## Plano de sprints

As sprints abaixo são a fila operacional após a limpeza. Cada sprint só avança
quando seus critérios de aceite estiverem registrados no relatório de
requalificação e a branch seguir `feature → staging → homologação → main`.

### Sprint 0 — preservar evidências e fechar a higiene segura

**Estado:** `CONCLUÍDA COM EXCEÇÃO ADMINISTRATIVA` — somente a execução zombie
permanece sem decisão.

- [x] Registrar esta auditoria em `docs/reviews/`.
- [x] Remover 29 branches remotos de PRs mescladas sem worktree ativo.
- [x] Podar refs `origin/*` que apontavam para branches removidas.
- [x] Preservar `main`, `staging`, PRs abertas/fechadas, branches locais e
  diretórios físicos não classificados.
- [x] Remover a branch e o worktree temporários da reconciliação após o merge;
  manter somente o worktree `production-normalization`, que ainda tem branch
  local ativa.
- [ ] Registrar o resultado do run zombie `32985845134` no painel GitHub ou
  aguardar expiração administrativa.
- [x] Atualizar `last_verified_commit` dos documentos deste commit.

**Aceite:** `git worktree list` sem registro órfão; nenhuma branch persistente
removida; working tree limpo após o commit; `bun run docs:check` verde.

### Sprint 1 — reconstruir a topologia staging-first

**Estado:** `CONCLUÍDA EM STAGING; PROMOÇÃO PENDENTE`.

- [x] Criar branch de integração a partir de `origin/staging`.
- [x] Incorporar `origin/main` sem descartar os dez commits de Staging.
- [x] Revisar conflitos de Sentry, R2, backup, restore, workflows e docs.
- [x] Executar CI completo da integração (`33253781385`).
- [x] Fazer deploy e smoke de Staging, incluindo providers de Staging
  (`33254285118`).
- [x] Abrir PR separada da integração para `staging` (`#137`).
- [ ] Somente após homologação abrir PR `staging → main`.

**Aceite:** `origin/staging` contém os patches necessários dos dois lados,
CI/deploy/smoke verdes e nenhum commit direto em `main`.

O merge de `#137` foi squash. Portanto, a contagem de ancestralidade Git ainda
mostra commits exclusivos em ambos os lados, embora a árvore de arquivos esteja
reconciliada; isso não deve ser tratado como novo trabalho de produto.

### Sprint 2 — tornar o deploy de Staging determinístico

**Estado:** `PARCIALMENTE CONCLUÍDA` (a execução foi comprovada; a política
definitiva ainda depende da promoção da guarda ao workflow de `main`).

- [x] Adicionar guarda explícita para `workflow_run.head_branch=staging` em
  `.github/workflows/deploy-staging.yml`.
- [x] Manter dispatch manual explicitamente apontado para `staging`.
- [x] Adicionar teste de contrato para aceitar Staging e rejeitar `main` em
  `src/tooling/release-workflows.test.ts`.
- [x] Inventariar branches Neon antes do backup efêmero desta release.
- [x] Executar dry-run e execute controlado da retenção de
  `staging-release-*`.
- [x] Reexecutar deploy de Staging sem atingir `BRANCHES_LIMIT_EXCEEDED`,
  inclusive após `#137` e `#138`, usando cleanup controlado quando o limite
  reapareceu.

**Aceite parcial:** um push de `staging` chega a READY, a branch temporária tem
parent correto e expira. Ainda falta observar uma execução originada de CI de
`main` para fechar o caminho rejeitado e definir a política definitiva.

### Sprint 3 — endurecer HTTP e cobertura de regressão

**Estado:** `CONCLUÍDA EM STAGING; PROMOÇÃO PARA MAIN PENDENTE` — limite de
corpo e cobertura das quatro rotas críticas estão implementados, testados e
publicados no alias de Staging.

- [x] Implementar leitura limitada do webhook Resend.
- [x] Testar payload abaixo/acima do limite, stream sem `Content-Length` e
  assinatura inválida.
- [x] Criar testes das rotas de enrollments, JMVStream, maintenance e
  exportação de analytics.
- [x] Cobrir autorização, jobs desligados, lease ocupado, falhas sanitizadas e
  resposta de sucesso.
- [x] Executar `bun run check`, `bun run typecheck`, testes focados e CI completo.

**Aceite:** limite de corpo é aplicado durante a leitura, assinatura continua
válida para payload legítimo e as rotas críticas têm contrato automatizado.

A fatia do limite foi implementada no commit
`84d2c2dcb4780591826aba51c8ae8e15f6dbfd55`, com nove testes focados. A
cobertura das rotas críticas foi adicionada no commit
`5af01837acc26581d2ca165a67514308d49d6c4a`: 21 testes focados, 2.407 testes
na suíte completa, typecheck, Ultracite, migrations e documentação verdes. A
PR `#142` foi mesclada no commit `c1d03e85d374cc8bac0b8d80bf19d5bc9429db9f`;
o CI pós-merge `33262530363` e o deploy protegido `33263104763` passaram todos
os gates, incluindo smoke do alias `preview.neurocapacitar.com.br`. Não houve
promoção para `main` nem alteração de Production.

### Sprint 4 — retirar o modo emergencial

**Estado:** `PARCIALMENTE CONCLUÍDA` — os bypasses foram removidos e o deploy
protegido de Staging passou; backup/restore Production e futura promoção ainda
exigem evidência própria.

- [ ] Confirmar backup Production independente recente e restore documentado.
- [ ] Confirmar CI verde para o SHA candidato.
- [ ] Revisar os 11 runs emergenciais de 25–26/08 e manter somente a evidência
  necessária.
- [x] Remover as entradas `emergency_skip_backup` e `emergency_skip_ci`, sem
  remover os gates normais.
- [ ] Promover somente por workflow protegido, com maintenance controlada.
- [ ] Registrar smoke pós-promoção e o SHA efetivamente servido.

**Aceite:** próxima release não usa exceção; backup, CI, migration, deployment
não promovido, smoke e alias canônico passam em sequência.

O workflow sem bypass está em Staging. O CI pós-merge `33260689568` e o deploy
protegido `33261310675` passaram backup, ancestry, migrations, publicação da
SHA exata e smoke do alias `preview.neurocapacitar.com.br`. Production continua
sem alteração até um PR separado `staging → main`. O contrato foi testado no
commit `9c204a35dc8eaa5855532f83bd1fa88ff959f166` com 15 testes verdes.

### Sprint 5 — fechar gates externos de Production Readiness

**Estado:** `EM ANDAMENTO` — Sentry de Staging passou; DMARC está na janela
inicial; contas administrativas continuam bloqueadas por ausência de TOTP.

- [x] Validar evento e alerta Sentry em Staging no projeto `hub-web`.
- [x] Publicar e confirmar DMARC em `p=none; pct=100`.
- [x] Revalidar, sem mutação, os projetos `hub-web` e `hub-production` e manter
  ambos separados.
- [ ] Aguardar a janela DMARC inicial e analisar relatórios agregados.
- [ ] Progredir DMARC sem saltar etapas até `reject; pct=100` estável.
- [ ] Emitir o evento Sentry próprio de Production somente após candidato
  aprovado.
- [ ] Revalidar projeto `hub-production` antes de qualquer consolidação; não
  apagar o projeto automaticamente.
- [ ] Executar uma nova compra real supervisionada somente após Production
  protegida, validando e-mail, reset, acesso e reembolso.

**Aceite:** todos os gates externos têm evidência sanitizada, responsável,
timestamp e rollback; decisão `GO/NO-GO` é registrada antes da promoção.

### Sprint 6 — segurança da conta e proteção do repositório

**Estado:** `PARCIALMENTE CONCLUÍDA` — as proteções reversíveis compatíveis com
o repositório público foram habilitadas, o Code Scanning foi configurado e os
alertas encontrados já têm correção publicada em Staging; a reanálise do
branch padrão, a conferência das Contas Admin e os controles operacionais
continuam pendentes.

- [x] Habilitar Secret Scanning e Push Protection.
- [x] Habilitar Dependabot Security Alerts e Security Updates.
- [x] Avaliar e configurar Code Scanning dentro do plano vigente, sem adicionar
  execução não revisada ao CI; registrar e tratar o resultado da primeira
  análise no finding `SECURITY-03`.
- [ ] Confirmar duas Contas Admin, TOTP e códigos de recuperação.
- [ ] Revisar exposição de nomes de infraestrutura nos logs públicos sem
  rotacionar credenciais desnecessariamente.
- [ ] Definir se algum PR Dependabot será tratado, sempre um por vez.

**Evidência externa de 2026-08-29:** a API do GitHub confirmou o repositório
público `juniordinizm/hub` com `secret_scanning=enabled`,
`secret_scanning_push_protection=enabled`,
`dependabot_security_updates=enabled` e
`code-scanning/default-setup.state=configured`, com `query_suite=default` e
`runner_type=standard`. Não havia alertas ativos de Dependabot nem de Secret
Scanning no momento da consulta.
A primeira análise de JavaScript/TypeScript registrou três alertas
abertos no SHA histórico de `main` (`js/xss-through-dom` nos componentes
`jmvstream-duration-detector.tsx` e `lesson-video-editor-preview.tsx`, e
`js/double-escaping` no suporte de E2E). O PR `#146` foi mesclado em
`ed59130a17cbf7412c7354dbd598924c70f6b397` e o deploy protegido de Staging
`33268106032` passou backup/ancestry Neon, migrations, publicação da SHA exata
e smoke do alias. A requalificação deverá confirmar o fechamento dos alertas
depois de a mesma árvore chegar ao branch analisado.

**Aceite:** proteções escolhidas habilitadas, contas administrativas conferidas,
nenhum secret em histórico e PRs de dependência sem falha.

### Sprint 7 — retomar desenvolvimento de produto

**Estado:** `AGUARDANDO PROMOÇÃO CONTROLADA E GATES EXTERNOS` — Sprints 1–4
e a correção Code Scanning estão publicadas em Staging, mas a promoção para
`main` continua condicionada à requalificação.

- [ ] Criar cada feature a partir de `origin/staging` reconciliado.
- [ ] Testar localmente e abrir PR para `staging`.
- [ ] Homologar no alias de Staging.
- [ ] Promover por PR separado `staging → main`.
- [ ] Usar Production somente pelo workflow protegido.

**Aceite:** nenhum trabalho novo usa branch histórica, worktree não classificado,
deploy direto ou bypass emergencial.

## Critério global de retorno ao verde

O repositório volta a `GREEN` quando:

1. `main` e `staging` estiverem reconciliados e o fluxo staging-first for
   executável;
2. o deploy automático de Staging não responder a CI de `main`;
3. o limite Neon não bloquear uma execução normal;
4. não houver execução GitHub zombie sem decisão administrativa;
5. o working tree e a documentação estiverem commitados e validados;
6. webhook Resend e rotas críticas tiverem cobertura de contrato;
7. nenhuma nova Production release depender de exceção.

Até lá, novas features devem aguardar. A aplicação continua online, mas a fila
acima é a condição para voltar ao desenvolvimento normal com rastreabilidade.
