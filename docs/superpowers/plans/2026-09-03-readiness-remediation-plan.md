---
status: accepted
owner: engineering
last_verified_commit: e121349ad0a625857037617a71259c7f4e22b1ce
---

# Readiness and Operational Hygiene Remediation Implementation Plan

> For agentic workers: Use TDD for behavior changes, preserve DMARC as observation-only, and stop before any unclassified destructive action.

Goal: Corrigir as lacunas técnicas, documentais e operacionais que impedem tratar o Hub como uma base plenamente confiável para novas features, sem alterar DMARC.

Architecture: A remediação será dividida em fatias independentes: verificação local, contratos documentais, higiene segura de Git, registro de evidências externas e requalificação. vercel.json, código/testes e decisões aprovadas permanecem as autoridades respectivas.

Tech Stack: Bun 1.3.11, Knip 6, Vitest, TypeScript, Next.js 16 App Router, GitHub Actions, Vercel, Neon, R2, Resend e Sentry.

---

## Regras de execução

- Não alterar DNS ou registros DMARC.
- Não imprimir nem copiar secrets, URLs de banco, URLs assinadas, payloads ou PII.
- Não usar git reset --hard, git checkout --, git clean ou git gc --prune=now.
- Não remover branch, worktree, artifact ou objeto Git antes de verificar o alvo literal e sua recuperabilidade.
- Não executar deploy, migration, seed, cobrança, restore ou envio de e-mail para testar uma hipótese já coberta por evidência.
- Toda alteração comportamental segue RED, GREEN, refactor e verificação.
- Commits e push ficaram fora do escopo inicial; após autorização explícita, a
  branch foi publicada e o PR #199 foi mergeado em `staging` no commit
  `5f9665c9d5356814381959d9ba1b543de0a441ee`.
- O checkpoint documental seguinte foi publicado no PR #200 e mergeado em
  `staging` no merge commit `35e838c21f2ad94fefe2aec187db5068f2726c0e`; o workflow
  pós-merge validou o alvo e aplicou as migrations de Staging com sucesso.

## Sprint 0 — baseline protegido

### Task 0.1: congelar o estado local

Files:

- Read: AGENTS.md, README.md, PRODUCT.md, CONTEXT.md, docs/README.md.
- Read: docs/superpowers/specs/2026-09-03-readiness-remediation-design.md.

- [x] Confirmar worktree vinculado, branch, HEAD, origin/main, origin/staging e status.
- [x] Confirmar que bun.lock possui o mesmo hash no HEAD, índice e worktree antes de qualquer instalação.
- [x] Ler os 133 Markdown de projeto e classificar canonical, accepted, runbook, proposed e histórico.
- [x] Registrar CI, backup, Sentry, Resend e Staging somente por IDs e estados sanitizados.

Verificação: nenhum arquivo rastreado além do bun.lock preexistente aparece modificado antes desta remediação.

### Task 0.2: testar a baseline sem mutação externa

Commands:

~~~powershell
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun x ultracite check
bun run test
bun audit --production
~~~

Aceite: registrar o exit code de cada comando. Falha de ambiente não pode ser convertida em sucesso.

## Sprint 1 — verificação local reproduzível

### Task 1.1: provar o contrato do Knip

Files:

- Create: src/tooling/knip-contract.test.ts.
- Modify: knip.jsonc.

- [x] Escrever um teste que leia knip.jsonc como texto e exija que lefthook apareça em ignoreDependencies, mantendo ignoreBinaries e o script prepare presentes.
- [x] Rodar npx -y bun@1.3.11 run test -- src/tooling/knip-contract.test.ts e observar RED porque o pacote é invocado dinamicamente e ainda não está na lista de dependências ignoradas.
- [x] Adicionar somente lefthook a ignoreDependencies. A exceção cobre dependência dinâmica deliberada; não ignorar arquivos, exports ou todos os devDependencies.
- [x] Rodar o teste focal e npx -y bun@1.3.11 run knip sem CI=true; o resultado esperado é exit 0 com apenas os 14 configuration hints já conhecidos.
- [x] Rodar npx -y bun@1.3.11 run verify sem CI=true e confirmar que o perfil completo passa.

Rollback: remover apenas a entrada de ignoreDependencies e o teste se o script de hooks puder ser reescrito para uma referência estática detectável sem perder segurança.

### Task 1.2: preservar o contrato de CI

Files:

- Test: src/tooling/release-workflows.test.ts.
- Test: src/vercel-deployment-contract.test.ts.
- Verify: .github/workflows/ci.yml.

- [x] Adicionar uma asserção de que o workflow executa bun run knip e não usa treat-config-hints-as-errors.
- [x] Adicionar uma asserção de que o CI usa PostgreSQL local e as URLs E2E/integração declaradas, sem Neon ou provider real.
- [x] Rodar os testes focais e bun run test -- src/tooling/knip-contract.test.ts src/tooling/release-workflows.test.ts src/vercel-deployment-contract.test.ts.

## Sprint 2 — documentação semanticamente coerente

### Task 2.1: fixar a cadência dos workers

Files:

- Create: src/tooling/operational-documentation-contract.test.ts.
- Modify: docs/architecture.md.
- Modify: docs/operations/release-flow.md.
- Modify: docs/integrations/jmvstream.md.
- Modify: docs/domain/commerce-and-access.md.
- Modify: docs/operations/release-state.md.

- [x] Escrever um teste que leia vercel.json, extraia as seis entradas crons e confirme as declarações textuais canônicas: Asaas, JMVStream, outbox e Resend a cada quinze minutos; matrículas às 10:00 UTC; maintenance às 04:00 UTC.
- [x] Rodar o teste antes da documentação e confirmar RED pelas frases divergentes de um e cinco minutos.
- [x] Atualizar os runbooks para refletir exatamente a configuração atual, sem alterar vercel.json.
- [x] Incluir Resend no inventário de rotinas da arquitetura.
- [x] Rodar o teste focal e bun run docs:check.

### Task 2.2: corrigir a matriz documental de support

Files:

- Modify: docs/domain/commerce-and-access.md.
- Verify: docs/decisions.md.
- Verify: src/lib/auth-policy.ts.

- [x] Escrever teste de contrato que confirme que o guia de comércio não contém o texto de separação ainda não implementada e referencia DEC-DISC-014.
- [x] Rodar o teste em RED.
- [x] Substituir a descrição antiga pela matriz já implementada: manageEnrollmentSupport para validade, bloqueio e restauração contextual; Admin mantém manageEnrollmentAccess amplo.
- [x] Rodar o teste focal, a suíte de RBAC e bun run docs:check.

### Task 2.3: atualizar fatos de release sem inventar estado

Files:

- Modify: README.md.
- Modify: docs/README.md.
- Modify: docs/operations/release-state.md.
- Modify: docs/reviews/2026-09-01-production-readiness-requalification.md.
- Modify: docs/operations/production-backup-restore.md.
- Modify: docs/integrations/resend.md.

- [x] Escrever teste que exige que o README não declare a CI do main atual como pendente e que o estado de release tenha o SHA atual nos campos de checkpoint quando a evidência correspondente estiver registrada.
- [x] Rodar o teste em RED contra o checkpoint antigo.
- [x] Registrar os fatos remotos confirmados: CI 33716424503, Sentry 33718401953, backup 33778673874, lifecycle Staging 33718939437 e DMARC sem alteração.
- [x] Fechar documentalmente Sentry, backup, Resend, R2/restore, lock/lifecycle, cabeçalhos Production e rotação de secrets com a confirmação operacional recebida; manter DMARC explicitamente em observação.
- [x] Preservar todos os checkpoints históricos como histórico, sem reescrever decisões antigas.
- [x] Rodar bun run docs:check e bun run db:migrations:check.

### Task 2.4: reparar links e estados de planos

Files:

- Modify: plans/README.md.
- Modify: docs/README.md.
- Modify: docs/superpowers/plans/2026-08-31-lesson-authoring-validation-errors.md.
- Modify: docs/superpowers/plans/2026-08-31-release-flow-hardening-plan.md.

- [x] Remover as referências a planos 011 e 013 inexistentes de plans/README.md até que sejam aprovados; nesta remediação, remover as referências é a opção escolhida.
- [x] Adicionar este spec e plano ao índice na categoria correta.
- [x] Atualizar o plano de lesson authoring com a evidência do commit df4902e e dos testes efetivamente executados, marcando somente tarefas comprovadas.
- [x] Atualizar o plano de release-flow com as tarefas já executadas e manter pendências externas separadas.
- [x] Rodar um verificador de links relativos nos 133 Markdown e bun run docs:check; links históricos codificados devem ser corrigidos apenas se o alvo local puder ser representado sem ambiguidade.

## Sprint 3 — hygiene segura de Git

### Task 3.1: classificar o worktree local antigo

Files:

- Read-only: worktree vinculado da branch local staging, fora da raiz atual.
- Verify: git worktree list --porcelain, git branch -vv, git fsck --full --strict --connectivity-only.

- [x] Confirmar status e untracked do worktree vinculado de staging sem modificar arquivos.
- [x] Comparar sua branch staging com origin/staging por commits e diff.
- [x] Preservar qualquer alteração não classificada; não remover o worktree automaticamente.
- [x] Registrar que git remote prune origin --dry-run e git worktree prune --dry-run -v estão limpos, se continuarem limpos.
- [x] Contabilizar objetos dangling e manter todos durante sete dias após a última decisão de descarte.

### Task 3.2: normalizar a base futura

Files:

- Modify only if needed: docs/operations/shared-development-and-release-guide.md.
- Modify only if needed: docs/operations/release-flow.md.

- [x] Documentar origin/staging como base de novas branches.
- [x] Não alterar a branch local staging enquanto o worktree vinculado possuir estado não classificado.
- [x] Não executar git gc nesta sprint.

## Sprint 4 — evidência operacional não-DMARC

### Task 4.1: verificar apenas provas já disponíveis

Files:

- Verify: .github/workflows/verify-production-sentry.yml.
- Verify: .github/workflows/backup-production-database.yml.
- Verify: .github/workflows/run-staging-jobs.yml.
- Verify: docs/operations/external-readiness-checklist.md.

- [x] Confirmar por GitHub que os runs citados continuam success e pertencem aos SHAs declarados.
- [x] Confirmar que nenhum workflow de verificação lê ou imprime o valor de um secret.
- [x] Não disparar novo evento Sentry, e-mail, restore ou cobrança quando houver evidência recente equivalente.
- [x] Se uma credencial read-only não puder ser distinguida por nome/escopo, registrar a limitação; não substituir por uma secret desconhecida.
- [x] Manter DMARC no TXT atual e no runbook de observação.

### Task 4.2: fechar o contrato de release

Files:

- Test: src/tooling/release-workflows.test.ts.
- Test: src/vercel-deployment-contract.test.ts.
- Verify: .github/workflows/deploy-vercel.yml.

- [x] Confirmar que workflow manual fixa checkout em main, que Environments restringem branches e que não existem bypasses emergenciais.
- [x] Confirmar que o caminho com migration exige backup independente antes da migration e que o caminho sem migration não fabrica uma verificação de backup.
- [x] Confirmar que staging não publica Production automaticamente e que a promoção usa o mesmo deployment validado.
- [x] Rodar os testes focais e documentar qualquer falha real antes de corrigir.

## Sprint 5 — requalificação final

### Task 5.1: executar os gates

Commands:

~~~powershell
Set-Item Env:CI true
npx -y bun@1.3.11 run verify
npx -y bun@1.3.11 run test:certificates:integration
npx -y bun@1.3.11 run test:e2e
npx -y bun@1.3.11 audit --production
~~~

- [x] Usar PostgreSQL descartável apenas para integração e E2E; se as URLs não estiverem configuradas, registrar o bloqueio exato sem usar banco remoto compartilhado.
- [x] Conferir que verify passa sem falhas e que a saída não contém segredo ou PII.
- [x] Rodar git diff --check e git status --short --branch.

Nota de execução: os comandos locais de integração e E2E foram tentados
separadamente e terminaram antes da execução por falta de
CERTIFICATE_CONCURRENCY_DATABASE_URL e E2E_DATABASE_URL. Docker e psql não estão
instalados neste ambiente. O CI remoto 33716424503 comprovou esses gates usando
PostgreSQL local descartável no runner; nenhum banco compartilhado foi usado.

### Task 5.2: revisão independente

Files:

- All files changed by this plan.

- [x] Solicitar revisão contra 10c9cb8 depois das alterações, sem confiar apenas em relatório de implementação.
- [x] Corrigir issues importantes antes da decisão final.
- [x] Atualizar o spec e plano com os comandos e resultados finais.
- [x] Publicar nova requalificação aceita com GO ou NO-GO, mantendo DMARC como observação explícita.

## Definition of Done

- verificação local normal passa;
- CI remoto do SHA candidato passa integração, E2E, build, Knip e audit;
- documentação canônica e runtime concordam sobre cron, support e release;
- links indexados existem;
- branches, worktrees e objects estão classificados sem perda;
- provas externas não-DMARC têm registro atual e sanitizado;
- nenhuma alteração DMARC foi feita;
- revisão independente foi concluída;
- nenhuma promoção Production é declarada sem requalificação aceita.
