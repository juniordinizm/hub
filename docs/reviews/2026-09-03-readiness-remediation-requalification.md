---
status: accepted
owner: engineering
last_verified_commit: 10c9cb8dd187482144850015841fb4485eacbd5f
audit_date: 2026-09-03
---

# Requalificação de prontidão e higiene operacional — 2026-09-03

## Decisão

**GO para receber novas features e para novas promoções Production no escopo solicitado.**
O código, os contratos de CI, a documentação canônica e o fluxo de branches
estão consistentes no SHA `10c9cb8dd187482144850015841fb4485eacbd5f`. A CI remota do mesmo
SHA passou integração PostgreSQL, E2E, build, Knip, audit e os gates
estáticos/unitários.

O responsável confirmou a conclusão dos itens externos 1 a 8, incluindo R2,
restore Neon, lock/lifecycle, cabeçalhos Production e rotação de secrets
Resend. DMARC está explicitamente fora do escopo desta remediação e permanece
em observação até 2026-09-12, sem alteração.

Esta decisão não promove, migra, restaura, cobra, envia e-mail ou altera DNS.

## Evidência remota

Todos os runs abaixo pertencem ao SHA
`10c9cb8dd187482144850015841fb4485eacbd5f` e terminaram `success`:

- CI: `33716424503`;
- Verify Sentry Production readiness: `33718401953`;
- Backup Production database: `33778673874`;
- job `verify-resend-lifecycle` de Run Staging jobs:
  `33718939437`.

Os registros mais recentes de deployment do GitHub para `vercel-production` e
`vercel-staging` no mesmo SHA terminaram `success`. Uma tentativa
anterior de `vercel-production` terminou `failure` e não foi usada como
prova positiva. Nenhum valor de secret foi lido ou registrado.

## Resultado por sprint

### Sprint 0 — baseline protegido

- worktree atual isolado na branch de revisão da remediação;
- `origin/main` e o SHA candidato confirmados;
- o worktree antigo vinculado à branch local de staging foi preservado porque
  contém alteração local não classificada em `skills-lock.json`;
- `remote prune` e `worktree prune` em dry-run não encontraram alvos;
- `git fsck --full --strict --connectivity-only` encontrou zero erros e
  236 objetos dangling, mantidos pela janela de recuperação.

### Sprint 1 — verificação local reproduzível

O script de hooks resolve `lefthook` dinamicamente. A dependência foi
incluída somente em `ignoreDependencies` do Knip e o contrato
`src/tooling/knip-contract.test.ts` protege essa exceção. O gate
`npx -y bun@1.3.11 run verify` passou sem `CI=true`; o Knip
permanece com somente 14 configuration hints não bloqueantes.

### Sprint 2 — documentação coerente

- as seis entradas de `vercel.json` estão refletidas na arquitetura e no
  fluxo de release;
- `manageEnrollmentSupport` está documentado como capacidade restrita de
  `support`, enquanto `manageEnrollmentAccess` permanece
  exclusiva de Admin;
- README, estado de release, backup, Sentry e Resend registram os runs atuais;
- os links locais para os planos inexistentes 011 e 013 foram removidos;
- os planos executados registram evidência e mantêm rollout/manual gates separados.

O contrato `src/tooling/operational-documentation-contract.test.ts` passou
5 testes.

### Sprint 3 — higiene segura de Git

Nenhum branch, worktree, secret ou objeto foi removido. A branch local
`staging` continua intocada enquanto o worktree antigo possui
`skills-lock.json` não classificado. Novas branches devem nascer de
`origin/staging`.

### Sprint 4 — provas operacionais não-DMARC

Sentry, backup, lifecycle automatizado do Resend, R2/restore, cabeçalhos
Production e rotação de secrets foram confirmados pelo responsável. Os
workflows usam nomes de secrets sem imprimir seus valores, e os Environments
restringem `vercel-production` a `main` e
`vercel-staging` a `staging`. O fluxo não possui
bypass emergencial.

### Sprint 5 — requalificação

O gate local normal passou. Os testes de integração e E2E locais não foram
forçados: este ambiente não possui Docker, `psql` ou URLs descartáveis.
Os comandos falharam antes de executar testes com as mensagens sanitizadas
`CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests` e
`E2E_DATABASE_URL is required for the disposable E2E database`. O CI
remoto do mesmo SHA comprovou esses caminhos com PostgreSQL local do runner.

## Acompanhamento residual

1. DMARC continua em `p=none; pct=100`, em observação até 2026-09-12
   conforme [Progressão DMARC](../operations/dmarc-rollout.md). Não agir nesta
   remediação.
2. O worktree antigo e os objetos dangling permanecem preservados até a
   classificação explícita e a janela de recuperação; isso é higiene de
   desenvolvimento, não bloqueio de release.

As novas promoções continuam obrigadas a usar `origin/staging`, CI e
o fluxo protegido. A confirmação externa não autoriza um deploy automático.

## Verificações

- `npx -y bun@1.3.11 run verify`: exit 0; 367 arquivos de teste e
  2.457 testes passaram; build e Knip passaram;
- contrato de documentação: exit 0; 5 testes passaram;
- authoring: exit 0; 5 arquivos e 35 testes passaram;
- contratos de workflow/deploy: exit 0; 3 arquivos e 19 testes passaram;
- `bun run docs:check`: exit 0;
- `bun run db:migrations:check`: exit 0;
- `git diff --check`: exit 0;
- DMARC: nenhum registro alterado.
