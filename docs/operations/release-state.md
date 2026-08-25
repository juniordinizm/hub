---
status: runbook
owner: engineering
last_verified_commit: aceeaf830cf75667df8ce21e5b586d47155dd5ac
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

As migrations `0065_gray_siren`, `0066_gifted_retro_girl` e
`0067_sparkling_ghost_rider` foram ensaiadas em branches Neon descartáveis e
aplicadas à branch persistente de Staging pelo workflow protegido. Elas não
foram implantadas em Development ou Production; portanto não alteram os seis
campos de Production no frontmatter.

Esse checkpoint confirma deployment e schema, não Production Readiness. A
[auditoria da mesma data](../reviews/2026-08-23-production-readiness-audit.md)
permanece `NO-GO`: recuperação, autorização de `support` e gates operacionais
ainda precisam ser encerrados pelo plano mestre.

Nenhuma linha deste documento autoriza migration, deploy, rollback ou alteração
de dados. O [guia de Production](production-release-guide.md) continua sendo o
procedimento operacional; este arquivo é somente o registro verificável do estado.

## Histórico do candidato de remediação

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

## Checkpoint de Staging de 25 de agosto de 2026

Somente Production está congelada. Staging/Preview pode receber merge,
migration, configuração e deploy controlados para concluir a qualificação. Isso
não autoriza promoção para Production, alteração do alias
`app.neurocapacitar.com.br`, migration ou escrita no banco Production, DNS de
Production, mudança de provider Production ou venda real.

O merge do PR `#54` implantou em Staging o commit
`aceeaf830cf75667df8ce21e5b586d47155dd5ac`. A CI `32862430399` aprovou quality,
integração PostgreSQL, 41 jornadas Playwright e build/Knip. O workflow de deploy
`32863445174`, tentativa 2, criou o backup
`staging-release-32863445174-2`, verificou sua ancestralidade, aplicou as
migrations guardadas e publicou o deployment Vercel
`dpl_FZ3WPZfrjAgD6jQPR7s4zvneePNu`, target `staging`, estado `READY`, URL exata
`https://hub-ijsiilv7k-neuro-capacitar.vercel.app` e alias estável
`preview.neurocapacitar.com.br`.

O smoke foi executado primeiro no endereço exato e depois no alias estável. Em
ambos, raiz, `noindex`, sitemap ausente, readiness autenticada e rejeição segura
do webhook Resend passaram. O build publicou no Sentry a release de mesmo SHA e
seus source maps, removendo os mapas do artefato público.

O primeiro attempt do deploy falhou de forma fechada antes de migration por
`BRANCHES_LIMIT_EXCEEDED`. O dry-run `32863728656` preservou o backup mais
recente e propôs remover apenas dois backups antigos de release. O execute
`32863793696` removeu exatamente `br-mute-rice-acnbv19a` e
`br-sweet-paper-acwarrnk`, preservou `br-little-silence-acmi27kr` e permitiu a
tentativa 2. Nenhum branch ou dado Production entrou no cleanup.

O probe Sentry do deployment exato retornou o evento
`2a8b96ca952740ffb28a7fc04c7816d1` e a correlação
`97350600-8687-47b8-842d-f896d75bd8c5`. A inspeção somente leitura confirmou
`environment=staging`, release igual ao SHA implantado,
`readiness_probe=sentry` e frame source-mapped
`app:///src/lib/sentry-readiness.ts:42`. O gate Sentry ainda não está fechado:
`scrubIPAddresses=false` permite que a ingestão derive geolocalização de baixa
precisão do IP de transporte, e o workflow global existente não filtra ambiente
nem comprova entrega em canal institucional.

Production continua no commit
`9f2b8f177e7531f1c19242099f403c55b3820d08`, sem deploy, alias, migration,
configuração, dado, DNS ou venda alterados por este checkpoint. A decisão
histórica e atual permanece `NO-GO`.

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
