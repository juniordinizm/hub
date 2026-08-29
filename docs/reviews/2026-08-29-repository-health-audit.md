---
status: accepted
owner: engineering
last_verified_commit: 7929b64f9166e973a2e765252d4e10295ee15817
audit_date: 2026-08-29
---

# Auditoria de saúde do repositório — 2026-08-29

## Decisão operacional

**Estado: AMARELO.** A aplicação pública continua respondendo e não há erro
ativo no deployment Production atual, mas o repositório ainda não está pronto
para receber novas features sem uma normalização curta. O principal risco não é
uma quebra observada no checkout; é a divergência entre `main` e `staging`,
somada a resíduos dos deploys emergenciais e à falta de uma guarda explícita no
workflow de Staging.

Production não foi alterada durante esta auditoria. Nenhuma migration,
configuração, dado, domínio, deployment ou provider Production foi modificado.

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
- **Estado:** correção implementada nesta branch; aguarda CI e merge em
  `staging`.
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
- **Estado:** aberto.
- **Correção resumida:** inventariar branches Neon, executar dry-run, preservar
  os ambientes persistentes e remover somente backups efêmeros expirados;
  repetir deploy e conferir ancestry.

### [DX-01] Reconciliar `main` e `staging`

- **Evidência:** `origin/main=f3cd21b` e `origin/staging=7929b64` divergem desde
  `32ddbbd`; há 87 commits exclusivos de `main` e 10 exclusivos de `staging`,
  com diferença direta em 44 arquivos.
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

- **Evidência:** `src/app/api/webhooks/resend/route.ts:39-46` executa
  `request.text()` antes de aplicar o limite de 256 KiB.
- **Impacto:** um corpo grande com headers presentes pode consumir memória e CPU
  antes de ser rejeitado; o limite declarado não protege a leitura.
- **Esforço:** S.
- **Risco da correção:** MED — os bytes usados pela verificação Svix precisam
  permanecer exatamente iguais.
- **Confiança:** HIGH.
- **Estado:** aberto.
- **Correção resumida:** implementar leitura bounded por stream e cobrir ausência
  ou falsidade de `Content-Length`.

### [TEST-01] Cobrir as fronteiras HTTP críticas

- **Evidência:** não há testes diretos para exportação de analytics, cron de
  enrollments, cron de JMVStream e cron de maintenance; existem testes apenas
  para parte das rotas de cron/webhook.
- **Impacto:** regressões de autorização, lease, resposta HTTP e execução
  duplicada podem chegar à produção sem teste específico.
- **Esforço:** M.
- **Risco da correção:** LOW.
- **Confiança:** HIGH.
- **Estado:** aberto.
- **Correção resumida:** adicionar testes de 401/403, jobs desabilitados, lease
  ocupado, erros sanitizados e respostas de sucesso.

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

**Estado:** `PARCIALMENTE CONCLUÍDA`.

- [x] Registrar esta auditoria em `docs/reviews/`.
- [x] Remover 29 branches remotos de PRs mescladas sem worktree ativo.
- [x] Podar refs `origin/*` que apontavam para branches removidas.
- [x] Preservar `main`, `staging`, PRs abertas/fechadas, branches locais e
  diretórios físicos não classificados.
- [ ] Registrar o resultado do run zombie `32985845134` no painel GitHub ou
  aguardar expiração administrativa.
- [x] Atualizar `last_verified_commit` dos documentos deste commit.

**Aceite:** `git worktree list` sem registro órfão; nenhuma branch persistente
removida; working tree limpo após o commit; `bun run docs:check` verde.

### Sprint 1 — reconstruir a topologia staging-first

**Estado:** `BLOQUEANTE / ABERTA`.

- [ ] Criar branch de integração a partir de `origin/staging`.
- [ ] Incorporar `origin/main` sem descartar os dez commits de Staging.
- [ ] Revisar conflitos de Sentry, R2, backup, restore, workflows e docs.
- [ ] Executar CI completo da integração.
- [ ] Fazer deploy e smoke de Staging, incluindo providers de Staging.
- [ ] Abrir PR separada da integração para `staging`.
- [ ] Somente após homologação abrir PR `staging → main`.

**Aceite:** `origin/staging` contém os patches necessários dos dois lados,
CI/deploy/smoke verdes e nenhum commit direto em `main`.

### Sprint 2 — tornar o deploy de Staging determinístico

**Estado:** `ABERTA` (depende da Sprint 1).

- [x] Adicionar guarda explícita para `workflow_run.head_branch=staging` em
  `.github/workflows/deploy-staging.yml`.
- [ ] Manter dispatch manual explicitamente apontado para `staging`.
- [x] Adicionar teste de contrato para aceitar Staging e rejeitar `main` em
  `src/tooling/release-workflows.test.ts`.
- [ ] Inventariar branches Neon antes de cada backup efêmero.
- [ ] Corrigir a política de retenção de `staging-release-*` e testar dry-run.
- [ ] Reexecutar deploy de Staging sem atingir `BRANCHES_LIMIT_EXCEEDED`.

**Aceite:** um CI de `main` não cria backup/deploy de Staging; um push de
`staging` chega a READY; a branch temporária tem parent correto e expira.

### Sprint 3 — endurecer HTTP e cobertura de regressão

**Estado:** `ABERTA` (pode ser paralela à Sprint 2 depois da reconciliação).

- [ ] Implementar leitura limitada do webhook Resend.
- [ ] Testar payload abaixo/acima do limite, stream sem `Content-Length` e
  assinatura inválida.
- [ ] Criar testes das rotas de enrollments, JMVStream, maintenance e
  exportação de analytics.
- [ ] Cobrir autorização, jobs desligados, lease ocupado, falhas sanitizadas e
  resposta de sucesso.
- [ ] Executar `bun run check`, `bun run typecheck`, testes focados e CI completo.

**Aceite:** limite de corpo é aplicado durante a leitura, assinatura continua
válida para payload legítimo e as rotas críticas têm contrato automatizado.

### Sprint 4 — retirar o modo emergencial

**Estado:** `ABERTA`.

- [ ] Confirmar backup Production independente recente e restore documentado.
- [ ] Confirmar CI verde para o SHA candidato.
- [ ] Revisar os 11 runs emergenciais de 25–26/08 e manter somente a evidência
  necessária.
- [ ] Remover ou tornar temporárias as entradas `emergency_skip_backup` e
  `emergency_skip_ci`, sem remover o gate normal.
- [ ] Promover somente por workflow protegido, com maintenance controlada.
- [ ] Registrar smoke pós-promoção e o SHA efetivamente servido.

**Aceite:** próxima release não usa exceção; backup, CI, migration, deployment
não promovido, smoke e alias canônico passam em sequência.

### Sprint 5 — fechar gates externos de Production Readiness

**Estado:** `EM ANDAMENTO`.

- [x] Validar evento e alerta Sentry em Staging no projeto `hub-web`.
- [x] Publicar e confirmar DMARC em `p=none; pct=100`.
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

**Estado:** `ABERTA`.

- [ ] Avaliar Secret Scanning, Push Protection, Dependabot alerts e Code
  Scanning dentro do plano vigente.
- [ ] Confirmar duas Contas Admin, TOTP e códigos de recuperação.
- [ ] Revisar exposição de nomes de infraestrutura nos logs públicos sem
  rotacionar credenciais desnecessariamente.
- [ ] Definir se algum PR Dependabot será tratado, sempre um por vez.

**Aceite:** proteções escolhidas habilitadas, contas administrativas conferidas,
nenhum secret em histórico e PRs de dependência sem falha.

### Sprint 7 — retomar desenvolvimento de produto

**Estado:** `BLOQUEADA ATÉ SPRINTS 1–4`.

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
