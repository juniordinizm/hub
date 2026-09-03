---
status: proposed
execution_status: active
owner: engineering
last_verified_commit: cc31c6daba08a10fa2523e562a540e8476a52dd8
current_sprint: 7
---

# Repository Cleanup Sprints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute this plan task-by-task. Cada etapa destrutiva exige a evidência indicada antes da execução.

**Goal:** reduzir o repositório ao conjunto mínimo necessário, preservando todo trabalho válido, resolvendo individualmente branches e PRs pendentes e deixando um fluxo de manutenção previsível.

**Architecture:** a limpeza será feita em camadas: primeiro decisões sobre PRs e branches, depois recuperação ou descarte de worktrees locais, depois limpeza remota, configurações de retenção e documentação. `main` e `staging` continuam sendo as únicas branches permanentes; nenhuma branch ou worktree com trabalho não revisado será apagada.

**Tech Stack:** Git, GitHub CLI, PowerShell, GitHub Actions, Bun, Ultracite, documentação Markdown e os ambientes Vercel/Neon/R2/Sentry/Resend somente para verificações de referência.

---

## 1. Resultado final esperado

Ao concluir todos os sprints:

- `main` e `staging` serão as únicas branches permanentes locais e remotas;
- não haverá PR aberta sem uma decisão clara: merge validado, fechamento documentado ou nova PR recriada a partir da base atual;
- não haverá branch remota de diagnóstico, branch de PR fechada ou branch de feature já incorporada;
- haverá somente o worktree principal e worktrees adicionais enquanto houver trabalho ativo neles;
- nenhum worktree sujo será removido sem que suas alterações tenham sido preservadas, incorporadas ou descartadas por decisão explícita;
- `git remote prune origin --dry-run` e `git worktree prune --dry-run -v` não produzirão referências obsoletas;
- o histórico Git continuará íntegro, sem `reset --hard`, reescrita de histórico ou `git gc --prune=now`;
- artefatos locais e artefatos do GitHub Actions terão retenção definida, sem remover evidências necessárias;
- documentação canônica refletirá o estado real do repositório;
- DMARC continuará sendo a única pendência em observação;
- MFA administrativo permanecerá fora do produto e fora deste plano;
- R2/restore, Resend e Sentry não serão repetidos, pois já foram concluídos.

## 2. Estado de partida verificado em 2026-09-03

Limpeza segura já executada antes deste plano:

- 48 branches locais obsoletas foram removidas;
- 21 branches remotas incorporadas, fechadas ou diagnósticas foram removidas;
- os worktrees limpos `hub-backup-debug` e `production-normalization` foram removidos;
- seis referências remotas locais já inexistentes foram podadas;
- o metadado local obsoleto `.git/REBASE_HEAD` foi removido;
- nenhum código, secret ou dado de ambiente foi apagado nessa etapa.

Inventário após a limpeza segura e o primeiro lote do Sprint 1:

- 2 branches locais: `main` e `staging`;
- 2 branches remotas: `main` e `staging`;
- 1 worktree: o checkout principal;
- 0 PRs abertas; todas as seis PRs anteriores foram fechadas ou merged sem deixar branch head;
- `main` aponta para `10c9cb8dd187482144850015841fb4485eacbd5f` e `staging` aponta para `1ee5677600e19f0657cd65072ca7d8cb6d9ab847`;
- o checkout principal está em `staging`, com `M docs/README.md`, `M skills-lock.json` e o plano desta limpeza não rastreado; a branch local está 2 commits à frente e 15 atrás de `origin/staging`;
- o worktree antigo de readiness e a branch `recover-stash-panel` foram removidos após revisão;
- não há refs stale de worktree ou de rastreamento remoto;
- `git fsck --full --strict --connectivity-only` encontrou somente objetos `dangling`, sem objeto ausente, corrompido ou erro de conectividade.

## 3. Regras de segurança obrigatórias

Estas regras valem para todos os sprints:

1. Nunca usar `git reset --hard`, `git checkout --`, `git clean -fd`, `git clean -fdx` ou `git gc --prune=now` neste trabalho.
2. Nunca remover `main`, `staging`, o worktree sujo ou `.env.local`.
3. Antes de cada exclusão, validar o nome exato da branch, o estado da PR, a existência de worktree associado e a situação do upstream.
4. `git branch -D` só pode receber uma lista literal de nomes previamente revisada; nenhum wildcard ou script que apague por padrão de nome.
5. Branch remota de PR aberta só pode ser removida depois de a PR ser fechada com motivo registrado ou substituída por uma PR nova.
6. Branch remota de PR merged só pode ser removida quando a PR e o commit incorporado estiverem confirmados no histórico atual.
7. Em caso de dúvida entre “histórico útil” e “histórico descartável”, preservar e registrar a dúvida; não apagar.
8. Nenhum valor de secret, `.env.local`, token, senha ou URL assinada pode aparecer em saída, comentário, commit ou documento.
9. Cada mudança de código ou workflow deve passar por branch própria, CI e revisão; este plano não autoriza merge direto em `main` ou `staging`.

## 4. Dependências entre os sprints

```text
Sprint 1: decidir PRs e branches
    -> Sprint 2: preservar, incorporar ou descartar worktrees locais
    -> Sprint 3: fechar PRs e remover refs remotas
    -> Sprint 4: retenção, environments, secrets e automações
    -> Sprint 5: atualizar documentação canônica
    -> Sprint 6: caches locais e manutenção do object store
    -> Sprint 7: verificação final e política permanente
```

Não iniciar um sprint posterior enquanto o critério de saída do anterior não estiver atendido.

## 5. Sprint 1 — decisão individual das PRs e branches remanescentes

**Objetivo:** classificar cada PR aberta e cada branch associada como mergeável, recriável, fechável ou preservável por uma razão concreta.

**Áreas envolvidas:** GitHub PRs #158, #192, #68, #69, #70 e #6; branches remotas Dependabot; `fix/lesson-resource-upload-resilience-20260830`; `codex/production-normalization`.

### Tarefa 1.1 — congelar o inventário antes das decisões

- [x] Executar:

  ```powershell
  gh pr list --state open --limit 50 --json number,title,headRefName,baseRefName,state,mergeable,mergeStateStatus,updatedAt
  git ls-remote --heads origin
  git worktree list --porcelain
  git status --short --branch
  ```

- [x] Salvar no checkpoint do plano os números, bases, heads e estados observados.
- [x] Resultado verificado: as três PRs abertas remanescentes são #158, #192 e #68; nenhum worktree novo está associado a uma branch candidata à exclusão.

### Tarefa 1.2 — decidir a PR #158 sem fazer merge do branch inteiro

Evidência já obtida:

- a PR possui 91 commits, 100 arquivos alterados e estado `CONFLICTING`/`DIRTY`;
- a arquitetura principal de upload de recursos e as migrations `0068`/`0069` já estão em `staging`;
- o branch antigo tenta reintroduzir o corpo `File` no PUT, enquanto o código atual usa `ArrayBuffer` para permitir replay;
- o branch também remove validações atuais de endpoint R2, mas adiciona `ContentType` e `signableHeaders` ao presign.

- [x] Confirmar a diferença atual sem alterar o checkout principal:

  ```powershell
  gh pr view 158 --json number,title,state,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
  gh api repos/juniordinizm/hub/pulls/158/files --paginate --jq ".[] | [.status,.additions,.deletions,.filename] | @tsv"
  git fetch --no-tags origin refs/pull/158/head
  git diff --shortstat origin/staging a0f00b698544124d49d6d733e05fe415f0962cf7
  ```

- [x] Não reaplicar o branch inteiro nem criar uma PR de código nesta limpeza. A assinatura de `Content-Type` fica registrada como melhoria futura isolada, somente se surgir um teste ou requisito operacional que a justifique:

  ```ts
  new PutObjectCommand({
    Bucket: config.bucketName,
    ContentType: reference.contentType,
    Key: config.namespace.toPhysicalKey(reference.key),
  })
  ```

  ```text
  O futuro ajuste deverá manter `expiresIn: R2_UPLOAD_URL_EXPIRES_SECONDS`,
  `ArrayBuffer`, `r2-endpoint` e os testes existentes; nunca reaplicar a árvore
  antiga inteira da PR #158.
  ```

- [x] A assinatura não é necessária para o objetivo desta limpeza; a PR foi fechada com motivo de supersessão e a branch foi removida:

  ```powershell
  gh pr close 158 --comment "Fechada como supersedida. O fluxo atual de upload de recursos já está integrado; esta branch conflitante mistura regressões de ArrayBuffer/endpoint com uma possível melhoria de assinatura Content-Type, que deverá ser reavaliada em uma PR pequena somente se necessária."
  git push origin --delete fix/lesson-resource-upload-resilience-20260830
  git remote prune origin
  ```

- [x] Critério de saída: a PR #158 não continua aberta como branch conflitante, nenhuma regressão do upload atual foi introduzida e a hipótese de assinatura ficou separada para uma futura avaliação.

### Tarefa 1.3 — decidir a PR #192 de dependências de produção

- [x] Verificar o estado e o erro:

  ```powershell
  gh pr view 192 --json number,title,state,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
  gh pr checks 192
  ```

- [x] Registrar que a atualização incluía 21 pacotes, entre eles Next.js, Better Auth, Sentry, Resend, AWS SDK, `pg`, `sharp` e `zod`.
- [x] Não fazer merge enquanto a falha de tipo em `src/lib/auth.ts:69` causada por Better Auth 1.7.2 existia.
- [x] Fechar a branch antiga com motivo de incompatibilidade e deixar uma futura atualização Dependabot nascer da base atual `staging`.
- [x] Critério de saída: a PR foi fechada sem merge, a branch foi removida e nenhuma dependência de produção foi alterada.

### Tarefa 1.4 — decidir a PR #68 de dependências de desenvolvimento

- [x] Verificar:

  ```powershell
  gh pr view 68 --json number,title,state,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
  gh pr checks 68
  ```

- [x] Registrar que a atualização continha Playwright, Biome, Tailwind, Knip, Lefthook, shadcn, Ultracite e Vitest.
- [x] Não fazer merge da base antiga; a última falha/cancelamento não era evidência suficiente para atualizar o checkout atual.
- [x] Fechar a branch antiga e deixar futuras atualizações Dependabot nascerem de `staging` atual.
- [x] Não misturar essa decisão com a PR #192; produção e ferramentas de desenvolvimento continuam tendo atualizações independentes.
- [x] Critério de saída: a PR foi fechada sem merge, a branch foi removida e nenhuma dependência de desenvolvimento foi alterada.

### Tarefa 1.5 — decidir as PRs #69, #70 e #6

- [x] PR #69, TypeScript 7.0.2: o build falhou e a PR foi fechada; uma futura migração deve nascer de `main` atual e ter escopo próprio.
- [x] PR #70, TanStack Table 9.1.2: a PR estava conflitante e os usos de `ColumnDef`, `getCoreRowModel` e `useReactTable` exigem migração; a PR foi fechada sem mascarar erros com casts.
- [x] PR #6, `actions/checkout` 7.0.1: as oito mudanças de workflow estavam conflitantes e baseadas em histórico antigo; a PR foi fechada. Uma futura atualização deve nascer da configuração atual e passar pela CI completa.
- [x] Para esse lote, as decisões foram registradas como `fechar e apagar`; as três branches remotas não existem mais e as refs locais foram podadas.
- [x] Critério de saída: nenhuma dessas três PRs continua aberta apenas por idade ou por falta de decisão.

### Tarefa 1.6 — conferir as branches fechadas já limpas

- [x] Confirmar que as branches de #132 e #171 não existem mais no remoto:

  ```powershell
  git ls-remote --heads origin codex/sentry-readiness-context fix/lesson-resource-arraybuffer-upload-production-20260831
  ```

- [x] Manter as PRs fechadas no histórico do GitHub; apagar branch não apaga a discussão nem o registro de merge/fechamento.

## 6. Sprint 2 — recuperar ou descartar o trabalho local remanescente

**Objetivo:** impedir perda de trabalho local antes de remover branches e worktrees.

**Áreas envolvidas:** `production-readiness-implementation`, `recover-stash-panel` e `production-normalization`.

### Tarefa 2.1 — proteger o worktree `production-readiness-implementation`

- [x] Registrar o estado sem modificar nada:

  ```powershell
  git -C "C:\Users\Junior\.config\superpowers\worktrees\hub\production-readiness-implementation" status --short --untracked-files=all
  git -C "C:\Users\Junior\.config\superpowers\worktrees\hub\production-readiness-implementation" diff --name-status
  git log --oneline --decorate -8 codex/production-readiness-implementation
  ```

- [x] A revisão inicial confirmou 17 itens de workflow, dependências, documentação e testes; todos permanecem preservados até a análise funcional individual.
- [x] Não executar `git clean`, `git reset`, `git checkout --` ou remoção do worktree enquanto houver item não classificado.
- [x] Cinco itens não rastreados foram comparados por hash com `origin/staging` e confirmados como cópias exatas; foram temporariamente restaurados por serem dependências do worktree antigo e depois removidos junto com o snapshot autorizado. O relatório `docs/reviews/2026-09-01-production-readiness-requalification.md` também foi descartado por ser uma versão antiga e contraditória.
- [x] Verificações da árvore antiga: `bun run typecheck` passou, `bun run test` passou com 351 arquivos/2.414 testes e `bun run build` passou com configuração sintética; `bun run check` parou em quatro erros de formatação de arquivos restaurados com CRLF e `bun audit --production` encontrou cinco vulnerabilidades no lockfile antigo.
- [x] Não houve mudança adicional necessária: as alterações candidatas foram classificadas individualmente, os itens equivalentes já estavam em `origin/staging` e o restante foi descartado por autorização; nenhuma PR adicional foi aberta a partir desse snapshot.
- [x] A validação equivalente da árvore vigente passou nas PRs #194 e #197; não foi repetida no snapshot descartado depois da classificação, porque ele não seria incorporado:

  ```powershell
  bun run verify:quick
  bun run docs:check
  ```

- [x] Critério de saída: não havia trabalho exclusivo válido a publicar; o snapshot foi removido somente depois da classificação, com a decisão registrada neste plano e sem perda de conteúdo necessário.

### Tarefa 2.2 — revisar `codex/recover-stash-panel`

- [x] Comparar a branch local com a base atual sem trocar o checkout principal:

  ```powershell
  git log --oneline --decorate --graph origin/main..codex/recover-stash-panel
  git diff --name-status origin/main...codex/recover-stash-panel
  git show --stat --oneline codex/recover-stash-panel
  ```

- [x] A revisão confirmou que `dfce89c` era um merge de recuperação sem spec, 693 commits atrás da árvore atual, com um `PanelLayout` antigo e logout sem teste próprio.
- [x] Nenhum comportamento foi reaplicado; a branch local foi removida após confirmar que não possuía commits exclusivos ou remoto.
- [x] Critério de saída: não restou branch “recover” sem finalidade nem código recuperado sem revisão.

### Tarefa 2.3 — resolver `codex/production-normalization`

- [x] Confirmar a divergência:

  ```powershell
  git rev-list --left-right --count origin/main...codex/production-normalization
  git diff --shortstat origin/main codex/production-normalization
  git log --format="%h %s" origin/main..codex/production-normalization
  gh pr list --state all --head codex/production-normalization --limit 50 --json number,title,state,mergedAt,closedAt
  ```

- [x] Tratar a branch como histórico composto, não como candidata a merge: ela estava 30 commits à frente, 145 atrás e diferia em 221 arquivos.
- [x] Conferir que a documentação do antigo PR #98 já está representada na árvore atual, sem necessidade de preservar a branch como base de desenvolvimento; nenhum merge da árvore inteira foi feito.
- [x] Remover a branch local e remota:

  ```powershell
  git push origin --delete codex/production-normalization
  git branch -D codex/production-normalization
  git remote prune origin
  ```

- [x] Critério de saída: nenhum branch composto, muito divergente e sem PR ativa continua sendo usado como base de desenvolvimento.

### Tarefa 2.4 — concluir a limpeza de worktrees

- [x] Revalidar todos os worktrees:

  ```powershell
  git worktree list --porcelain
  ```

- [x] Remover somente worktrees sem alterações e sem branch necessária:

  ```powershell
  git worktree remove "C:\Users\Junior\.config\superpowers\worktrees\hub\production-readiness-implementation"
  git worktree prune --dry-run -v
  ```

  A branch `codex/production-readiness-implementation` foi descartada com autorização registrada; não havia `.env.local` no caminho.

- [x] Critério de saída: somente o checkout principal permanece.

### Checkpoint de execução — 2026-09-03

- Sprint 1 concluído: PRs #158, #192, #68, #69, #70 e #6 foram fechadas sem merge; suas branches remotas foram removidas; nenhuma dependência ou código de aplicação foi atualizado por esse lote.
- Sprint 2 concluído: os snapshots `production-readiness-implementation` e `recover-stash-panel` foram revisados e removidos após autorização; nenhum conteúdo foi incorporado sem nova PR baseada em `staging`.
- Estado antes da publicação deste checkpoint: 2 branches locais, 2 branches remotas (`main` e `staging`), 0 PRs abertas e 1 worktree.
- O worktree principal mantém somente as alterações documentais desta limpeza e o `skills-lock.json` preexistente.
- Sprint 4/5/6 avançaram: policies de Environment, retenção de artifact, documentação de release e caches regeneráveis foram tratados; 438 artifacts ativos (361.135.814 bytes) e o object store aguardam retenção segura.

### Revisão técnica dos worktrees — 2026-09-03

- `codex/production-readiness-implementation` não tem commits exclusivos: está 690 commits atrás e totalmente contida em `origin/staging`. Seu snapshot contém rotas históricas de MFA, enquanto a árvore atual não as contém.
- Nenhum dos 11 diffs rastreados desse worktree deve ser incorporado como está: o fluxo de release é uma alternativa não publicada, o lockfile antigo contém cinco vulnerabilidades, `vitest.config.ts` omite `scripts/**/*.test.ts` e o plano mestre reintroduz TOTP contra a decisão vigente.
- Os cinco arquivos auxiliares não rastreados eram cópias exatas de `origin/staging`; o relatório de 2026-09-01 era uma versão antiga que ainda tratava MFA como gate e foi descartado junto com o snapshot.
- A árvore antiga passou `bun run typecheck`, `bun run test` (351 arquivos/2.414 testes) e `bun run build` com ambiente sintético; `bun run check` não ficou verde por CRLF nos arquivos auxiliares restaurados e `bun audit --production` encontrou cinco vulnerabilidades do snapshot antigo.
- A revisão encontrou risco no workflow de Sentry: `workflow_dispatch` podia selecionar uma referência e usar secrets de Production. A PR #194 corrigiu o fluxo em `staging` com execução somente em `main`, checkout explícito de `main` e policy `main` no Environment `vercel-production`; `main` ainda depende do workflow oficial de release para receber essa correção.
- `codex/recover-stash-panel` também não tem commits exclusivos em relação à árvore atual, não possui PR nem remoto e substitui o `PanelLayout` atual por uma versão antiga; o logout recuperado altera Admin e Student, não tem spec nem teste próprio e não deve ser incorporado.
- Decisão executada: os dois snapshots foram removidos após confirmação/autorização; nenhum deles foi incorporado.

## 7. Sprint 3 — limpeza remota e governança de branches

**Objetivo:** deixar o GitHub sem refs obsoletas e evitar que o acúmulo volte a ocorrer.

**Arquivos/configurações:** regras do repositório GitHub, configurações de branches, PRs e workflows existentes em `.github/workflows/`.

### Tarefa 3.1 — fechar PRs supersedidas com rastreabilidade

- [x] Para cada PR classificada como descarte, registrar comentário curto com o motivo, o substituto ou a razão de recriação futura e a confirmação de que nenhum código de aplicação foi alterado no descarte.
- [x] Fechar as PRs #158, #192, #68, #69, #70 e #6 antes de remover suas branches head; a PR #196 também foi fechada porque a promoção `staging -> main` deve usar o workflow de release.
- [x] Não foi feito merge de correção ainda não reaproveitada; a hipótese de assinatura `Content-Type` da #158 ficou registrada como futura PR focalizada.

### Tarefa 3.2 — remover somente branches comprovadamente descartáveis

- [x] Antes de cada remoção, executar a validação literal de branch, worktree e PR; todos os alvos removidos estavam merged/closed e sem trabalho ativo.

  ```powershell
  git branch -vv
  git worktree list --porcelain
  git ls-remote --heads origin codex/production-normalization
  gh pr list --state all --head codex/production-normalization --limit 20 --json number,state,mergedAt,closedAt
  ```

  Para outra branch, substituir `codex/production-normalization` pelo nome literal já classificado em Tarefa 1, como `fix/lesson-resource-upload-resilience-20260830` ou uma das cinco branches Dependabot listadas no inventário. Não usar wildcard.

- [x] Remover as branches remotas e locais somente depois de confirmar o estado closed/merged e a preservação do conteúdo necessário.
- [x] Nunca remover as branches protegidas `main` e `staging`.
- [x] Após o lote, executar:

  ```powershell
  git remote prune origin
  git remote prune origin --dry-run
  ```

- [x] Critério de saída: a segunda execução de `git remote prune origin --dry-run` não lista refs stale.

### Tarefa 3.3 — impedir exclusão automática acidental das branches permanentes

- [x] Conferir no ruleset `protect-release-branches` que `main` e `staging` continuam protegidas, sem deleção e sem non-fast-forward.
- [x] Conferir no ruleset de PR de `staging` que mudanças continuam entrando por PR.
- [x] Habilitar `delete_branch_on_merge=true` depois de confirmar que a política não remove `main`/`staging`.
- [x] Registrar a configuração final no runbook de desenvolvimento compartilhado; as regras de bypass não foram alteradas.
- [x] Critério de saída: futuras branches de PR merged sejam eliminadas automaticamente, enquanto branches permanentes continuem protegidas.

## 8. Sprint 4 — artifacts, environments, secrets e automações

**Objetivo:** reduzir lixo operacional sem apagar credenciais ou evidências necessárias.

### Tarefa 4.1 — definir retenção para artifacts de CI

- [x] Confirmar que o artifact em `.github/workflows/ci.yml:131` contém somente relatório Playwright, `test-results` e log de servidor.
- [x] Adicionar ao bloco `with` do upload de relatório:

  ```yaml
  retention-days: 14
  ```

- [x] Manter evidências de release/backup fora desse artifact; nenhum manifesto ou prova de recuperação recebeu a retenção de 14 dias.
- [x] Validar o workflow com `bun run check` e CI antes de remover artifacts antigos; PR #194 passou CI completa.
- [x] Não remover artifacts antigos em massa; a política foi aplicada primeiro e a evidência histórica continua preservada.
- [x] Critério de saída: novas execuções têm retenção explícita e o volume de artifacts deixa de crescer sem limite.

### Tarefa 4.2 — revisar GitHub Environments

- [x] Inventariar somente nomes, URLs e datas de uso:

  ```powershell
  gh api repos/juniordinizm/hub/environments --paginate --jq ".environments[] | [.name,.updated_at] | @tsv"
  Get-ChildItem -LiteralPath '.github/workflows' -Filter '*.yml' | ForEach-Object { Select-String -LiteralPath $_.FullName -Pattern 'environment:' }
  ```

- [x] Preservar `neon-development`, `production-backup`, `vercel-production` e `vercel-staging`; seus workflows, secrets ou variables foram confirmados.
- [x] Investigar `Production`, `staging` e `vercel-preview`; eles continuam preservados porque possuem histórico de deployments e/ou secrets, embora não sejam usados pelo fluxo atual.
- [x] Não apagar secrets para “limpar nomes”; remoção de secret continua separada da remoção de Environment.
- [ ] Critério de saída: cada Environment restante tem finalidade e workflow proprietário documentados; os três legados ainda exigem decisão de retenção histórica.

### Tarefa 4.3 — revisar secrets e variables por nome

- [x] Obter somente nomes:

  ```powershell
  gh secret list
  gh variable list
  Get-ChildItem -LiteralPath '.github/workflows' -Filter '*.yml' -Recurse | ForEach-Object { Select-String -LiteralPath $_.FullName -Pattern 'secrets\.|vars\.' }
  ```

- [x] Preservar `NEON_API_KEY`, secrets de Environment usados pelos workflows e qualquer variável referenciada por integração externa.
- [x] Investigar os candidatos sem referência direta nos workflows; nenhum foi removido sem confirmação de provider ou automação externa.
- [x] Conferir automações externas, Vercel, Neon e scripts locais somente por nomes e referências, sem exibir valores.
- [x] Nunca imprimir valores e nunca rotacionar secret apenas por causa de limpeza nominal.
- [ ] Critério de saída: cada secret/variable restante tem consumidor identificado e documentação de escopo; os candidatos nominais aguardam confirmação fora do GitHub.

### Tarefa 4.4 — normalizar Dependabot sem apagar atualizações válidas

- [x] Manter o fluxo Dependabot direcionado a `staging`, porque o projeto usa `staging -> main`.
- [x] Fechar as PRs antigas incompatíveis sem alterar dependências; futuras atualizações devem nascer da base atual e não juntar majors sem testes próprios.
- [x] Confirmar que os grupos e limites em `.github/dependabot.yml` continuam refletindo a política real; nenhuma mudança desnecessária foi feita.
- [x] Critério de saída: nenhuma PR Dependabot antiga fica aberta sem decisão.

## 9. Sprint 5 — documentação canônica e referências quebradas

**Objetivo:** fazer a documentação dizer o mesmo que o código, o GitHub e os providers.

**Arquivos:** `README.md`, `docs/README.md`, `docs/operations/release-state.md`, `docs/operations/dmarc-rollout.md`, `docs/operations/shared-development-and-release-guide.md`, `plans/README.md`.

### Tarefa 5.1 — atualizar o índice e o plano de manutenção

- [x] Manter este plano listado em `docs/README.md` na árvore remota; PR #197 foi aprovada pelo CI e mergeada em `staging` no commit `cc31c6daba08a10fa2523e562a540e8476a52dd8`.
- [x] Atualizar `last_verified_commit` dos documentos alterados somente para commits existentes que contenham as afirmações verificadas.
- [x] Não marcar sprint como concluído apenas por marcar checkbox; o plano registra commits, comandos e resultados.
- [x] Executar:

  ```powershell
  bun run docs:check
  ```

- [x] Critério de saída: `docs:check` aceita front matter, commits e referências; o plano está publicado na árvore remota e o índice aponta para ele.

### Tarefa 5.2 — corrigir o estado atual do projeto

- [x] Atualizar em `README.md` a frase que apresentava Asaas como “em preparação para o corte de produção”.
- [x] Remover a frase que afirmava que a CI do commit estava pendente e substituí-la por uma regra verificável.
- [x] Reescrever o checkpoint atual de `docs/operations/release-state.md` com o deployment e SHA verificados, sem apagar checkpoints históricos.
- [x] Manter DMARC somente como observação; nenhuma mudança de política DNS foi feita.
- [ ] Corrigir a referência ausente a `plans/011-assessments-and-learning-evidence.md` em `plans/README.md`: criar o documento somente se o plano for aprovado, ou remover a referência se a decisão for não manter esse plano.
- [x] Não apagar em lote `docs/reviews/`, `plans/`, `research/` ou snapshots históricos; idade do arquivo não prova obsolescência.
- [x] Rodar `bun run docs:check` e revisão manual dos links após a alteração.

### Tarefa 5.3 — registrar o resultado da limpeza

- [x] Acrescentar a este plano checkpoints com data, contagem de branches, PRs, worktrees, artifacts e refs stale.
- [x] Registrar os descartes com motivo e os itens preservados com razão operacional.
- [x] Critério de saída: um estagiário consegue entender o estado do repositório sem consultar o histórico inteiro do Git; o plano publicado reúne decisões, evidências, itens preservados e pendências.

## 10. Sprint 6 — caches locais e manutenção do object store

**Objetivo:** recuperar espaço local e remover objetos Git não mais necessários somente depois do período de segurança.

### Tarefa 6.1 — limpar caches regeneráveis sem atingir secrets

- [x] Verificar se havia processos ativos antes de remover caches:

  ```powershell
  Get-Process -Name node,bun -ErrorAction SilentlyContinue
  Get-ChildItem -Force -LiteralPath '.next','node_modules','playwright-report','test-results','tsconfig.tsbuildinfo' -ErrorAction SilentlyContinue
  ```

- [x] Como nenhum processo apontava para o checkout principal, remover somente os caminhos regeneráveis e exatos `.next`, `node_modules`, `playwright-report`, `test-results` e `tsconfig.tsbuildinfo`.
- [x] Não usar `git clean`; arquivos ignorados fora dos alvos foram preservados.
- [x] Nunca remover `.env.local`, `.env.*` com credenciais ou arquivos de backup fora desses caminhos; `.env.local` foi confirmado presente.
- [x] Reinstalar dependências somente nos worktrees temporários que exigiram validação; o checkout principal não foi refeito.
- [x] Critério de saída: espaço recuperado sem alteração em arquivos rastreados ou secrets.

### Tarefa 6.2 — aguardar a janela de recuperação antes do GC

- [x] Manter os objetos `dangling` enquanto as decisões das PRs e branches ainda estiverem em revisão.
- [ ] Após todos os descartes e uma janela mínima de recuperação de 7 dias, executar primeiro:

  ```powershell
  git fsck --full --strict --connectivity-only
  git count-objects -vH
  git reflog --all --date=iso
  ```

- [ ] Confirmar que não há commit necessário apenas em reflog ou objeto dangling.
- [ ] Somente com autorização explícita para a manutenção final, executar `git gc --prune=30.days`; nunca usar `--prune=now`.
- [ ] Repetir `git fsck --full --strict --connectivity-only` e `git count-objects -vH` após o GC.
- [ ] Critério de saída: object store íntegro e sem lixo antigo necessário para recuperação.

## 11. Sprint 7 — verificação final e política permanente

**Objetivo:** provar que a limpeza terminou e impedir o retorno do acúmulo.

### Tarefa 7.1 — executar os gates locais

- [x] Rodar na branch de integração aprovada por meio das CIs completas das PRs #194 e #195:

  ```powershell
  bun run verify:quick
  bun run check
  bun run docs:check
  bun run verify
  ```

- [x] Os gates remotos passaram: CI completa, PostgreSQL, E2E, build, Knip, Ultracite e documentação.

### Tarefa 7.2 — validar o inventário remoto e local

- [x] Executar:

  ```powershell
  git status --short --branch
  git branch -vv
  git ls-remote --heads origin
  gh pr list --state open --limit 50 --json number,title,headRefName,baseRefName,mergeStateStatus
  git worktree list --porcelain
  git remote prune origin --dry-run
  git worktree prune --dry-run -v
  git fsck --full --strict --connectivity-only
  ```

- [x] Resultado: `main` e `staging` são as únicas branches, não há PR aberta, não há worktree abandonado, não há prune pendente e não há erro de integridade.
- [x] Confirmar que o único estado externo de readiness pendente continua sendo DMARC em observação; não repetir R2/restore, Resend ou Sentry.

### Tarefa 7.3 — publicar a política de manutenção

- [x] Documentar no guia de desenvolvimento compartilhado:
  - branch de trabalho nasce de `staging`;
  - PR merged tem branch apagada após validação;
  - `main` e `staging` nunca são apagadas;
  - worktree sujo precisa ser resolvido antes de remoção;
  - artifacts têm retenção explícita;
  - secrets são auditados por nome e nunca publicados;
  - branches históricas só são mantidas quando há valor de recuperação identificado.
- [x] Criar um checklist curto para a próxima limpeza trimestral com os comandos de inventário e os critérios deste plano:
  1. Registrar `git status --short --branch`, `git branch -vv`, `git worktree list --porcelain` e `git ls-remote --heads origin`.
  2. Listar PRs abertas e comparar cada branch com `staging`; nenhuma remoção ocorre antes de classificar commits, arquivos não rastreados, worktrees e dependências externas.
  3. Executar `git remote prune origin --dry-run` e `git worktree prune --dry-run -v`; só então remover refs comprovadamente obsoletas.
  4. Auditar workflows, environments, variables e secrets apenas por nomes; nunca imprimir valores nem remover integração sem consumidor identificado.
  5. Rodar `bun run verify:quick`, `bun run check`, `bun run docs:check` e os gates da CI antes de declarar a limpeza concluída.
  6. Manter artifacts e objetos Git durante a janela de recuperação; depois repetir `git fsck`, revisar reflogs e pedir autorização explícita para manutenção do object store.
- [x] Critério de saída documental: a organização pode ser verificada em uma execução dos gates e do inventário; a única manutenção deliberadamente futura é o GC após a janela de recuperação, e environments/artifacts históricos foram retidos por segurança operacional.

## 12. Checkpoint pós-publicação — 2026-09-03

- PR #197 publicou este plano em `staging`; a atualização desta seção documenta o estado depois da remoção do branch e do worktree temporários usados para a publicação.
- Estado esperado após o descarte dos temporários: branches locais e remotas somente `main` e `staging`, nenhuma PR aberta, somente o worktree principal, `git remote prune origin --dry-run` limpo e `git worktree prune --dry-run -v` limpo.
- `.env.local`, `.agents` e histórico Git foram preservados. Caches regeneráveis foram removidos; artifacts históricos do GitHub Actions não foram apagados em lote.
- Environments legados com histórico ou secrets continuam retidos até decisão específica sobre a integração Vercel; o ambiente de produção e o de staging já têm policies de branch aplicadas.
- Pendências reais: DMARC em observação; manutenção do object store somente depois da janela mínima de recuperação e revisão de reflogs; a referência pedagógica ausente em `plans/README.md` depende de decisão de produto.

## 13. Critérios de encerramento do plano

O plano só pode ser marcado como `accepted`/concluído quando todos os itens forem verdadeiros:

- cada sprint possui evidência de comando, PR ou commit;
- nenhuma branch ou worktree foi apagada sem classificação individual;
- nenhuma alteração não revisada foi perdida;
- `main` e `staging` continuam protegidas;
- não há PR aberta abandonada;
- a documentação atual não contradiz deployment, CI ou DMARC;
- nenhum secret foi exposto, removido por engano ou rotacionado sem motivo;
- os gates locais e remotos estão verdes;
- o object store foi mantido até o fim da janela de recuperação e só então recebeu manutenção autorizada.
