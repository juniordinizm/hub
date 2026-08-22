---
status: runbook
owner: engineering
last_verified_commit: bbf89ad
deployed_commit: bbf89ad
deployed_environment: production
verified_commit: bbf89ad
verified_environment: production
documented_commit: bbf89ad
documented_environment: production
---

# Estado de release

Este documento separa três fatos que não podem ser tratados como sinônimos:

- `deployed_*`: último commit conhecido como publicado no ambiente indicado;
- `verified_*`: último commit que passou os gates locais/remotos conhecidos;
- `documented_*`: commit contra o qual esta documentação foi conferida.

O estado atual registra `bbf89ad` ("Merge pull request #47", promovendo o
`85e58a8`) como o deployment de Production publicado em 2026-08-22 pelo workflow
protegido, servindo `app.neurocapacitar.com.br`. A janela de manutenção desse
release aplicou a migration `0063_support_requests`, promoveu o deployment
verificado e devolveu o ambiente ao estado comercial aberto por redeploy do
mesmo SHA, com smokes públicos e de readiness verdes.

Nenhuma linha deste documento autoriza migration, deploy, rollback ou alteração
de dados. O [guia de Production](production-release-guide.md) continua sendo o
procedimento operacional; este arquivo é somente o registro verificável do estado.

## Atualização

Atualize os seis campos de estado na mesma mudança que altera o procedimento de
release. Não substitua `deployed_commit` por `verified_commit` enquanto o deployment
não tiver passado pelo smoke test do ambiente correspondente.

## Higiene de branches e providers

`main` e `staging` são branches persistentes. O fluxo aprovado é
`staging → main → Deploy Vercel production`; não habilite exclusão automática
de `staging` após merge. Branches de feature mescladas devem ser removidas
depois da confirmação do merge; worktrees abandonados devem ser removidos
somente após conferir seu branch e status. Stashes permanecem até que cada
patch seja classificado como recuperável ou explicitamente obsoleto.

No projeto Neon, preserve sempre `production`, `staging`, `development`,
`vercel-preview` e `asaas-cutover-backup-*`. Backups de release usam apenas os
prefixos `staging-release-*` e `production-release-*`; preserve o mais recente
de cada ambiente e remova superseded somente pelo cleanup separado, após
dry-run, confirmação `cleanup-release-backups`, conferência de projeto/parent
e nova leitura do inventário.

Estado operacional de Production verificado em 2026-08-21: manutenção `off`,
`PAYMENTS_CHECKOUT_MODE=public`, `ASAAS_WEBHOOK_ENABLED=true` e
`SCHEDULED_JOBS_ENABLED=true`. A chave Sandbox foi removida e a credencial
Asaas real está configurada; Staging continua na conta Sandbox. As sondas
públicas confirmaram checkout habilitado (GET `/api/checkouts/course` sem
parâmetros => `400`) e webhook ativo com token (POST sem token =>
`401`). Nenhuma venda real havia ocorrido até essa data; a primeira venda
supervisionada permanece pendente. Resend, Neon, Vercel, R2, JMVStream, Auth e
Asaas usam rotação manual por fingerprints; nenhum valor de secret pertence a
este documento.
