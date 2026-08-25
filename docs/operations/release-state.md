---
status: runbook
owner: engineering
last_verified_commit: 1e60557bc39956e74c1150880ca0d573129bcf34
deployed_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
deployed_environment: production
verified_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
verified_environment: production
documented_commit: 9f2b8f177e7531f1c19242099f403c55b3820d08
documented_environment: production
---

# Estado de release

Este documento separa três fatos que não podem ser tratados como sinônimos:

- `deployed_*`: último commit conhecido como publicado no ambiente indicado;
- `verified_*`: último commit que passou os gates locais/remotos conhecidos;
- `documented_*`: commit contra o qual esta documentação foi conferida.

O snapshot externo de 23 de agosto de 2026 registra
`9f2b8f177e7531f1c19242099f403c55b3820d08` como o deployment de Production em
estado `READY`, servindo `app.neurocapacitar.com.br` em `gru1` com Node.js 24. O
catálogo Neon observado estava em PostgreSQL 18.6, com 65 entradas no journal e
topo `0064_certificates_preview_sha256`.

O worktree de remediação contém as candidatas locais `0065_gray_siren`,
`0066_gifted_retro_girl` e `0067_sparkling_ghost_rider`, já ensaiadas em branches
Neon descartáveis e removidas. Elas não foram implantadas em Development,
Staging ou Production; portanto não alteram os campos `deployed_*`,
`verified_*` ou `documented_*` deste registro.

Esse checkpoint confirma deployment e schema, não Production Readiness. A
[auditoria da mesma data](../reviews/2026-08-23-production-readiness-audit.md)
permanece `NO-GO`: recuperação, autorização de `support` e gates operacionais
ainda precisam ser encerrados pelo plano mestre.

Nenhuma linha deste documento autoriza migration, deploy, rollback ou alteração
de dados. O [guia de Production](production-release-guide.md) continua sendo o
procedimento operacional; este arquivo é somente o registro verificável do estado.

## Candidato de remediação não implantado

O commit `1e60557bc39956e74c1150880ca0d573129bcf34`, na branch
`codex/production-readiness-remediation`, passou a CI `32834478030`: quality,
45 testes PostgreSQL, 41 jornadas Playwright sem retry, build e Knip. As duas
branches Neon efêmeras foram excluídas. Esse resultado não altera os seis campos
de Production no frontmatter: o candidato não foi mesclado, implantado,
promovido nem verificado em Production, e a requalificação permanece `NO-GO`.

Uma auditoria Sentry posterior encontrou referências circulares derrubando o
sanitizador de telemetria durante uma verificação local classificada como
Production. O commit corretivo `801a1cedf0b495c13ac576317d5773fd152202c4`
passou o teste focado 11/11, TypeScript e Ultracite. Ele ainda precisa da matriz
integral de CI; até essa repetição, `last_verified_commit` permanece no SHA
anterior e nenhum novo SHA é candidato a deploy.

O descendente documental `92ec261ab3b7c4f0789cfd90830866803754b4d9`
também passou localmente 2.286 testes, build Next.js, Knip e audit de produção,
com zero source map público. Esse resultado continua deliberadamente separado
da CI integrada, que criaria branches Neon efêmeras e não foi autorizada no
checkpoint somente leitura.

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
