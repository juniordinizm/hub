---
status: runbook
owner: engineering
last_verified_commit: e121349ad0a625857037617a71259c7f4e22b1ce
deployed_commit: 10c9cb8dd187482144850015841fb4485eacbd5f
deployed_environment: production
verified_commit: 10c9cb8dd187482144850015841fb4485eacbd5f
verified_environment: production
documented_commit: e121349ad0a625857037617a71259c7f4e22b1ce
documented_environment: production
---

# Estado de release

## Checkpoint operacional atual — 2026-09-03

Production está no deployment `dpl_E17vxVRp27EDVVmW5sEQgTYFpXb5`, estado
`READY`, região `gru1`, servido pelo commit
`10c9cb8dd187482144850015841fb4485eacbd5f`. O domínio canônico continua sendo
`app.neurocapacitar.com.br`.
O commit atual de `main` é `10c9cb8dd187482144850015841fb4485eacbd5f`.

O remoto mantém `main` no SHA Production `10c9cb8` e `staging` no
commit `5019411`. A CI completa do candidato passou os gates obrigatórios;
o fluxo de promoção permanece separado da homologação.

A CI `33716424503` terminou `success` nesse SHA, cobrindo verificação
estática/unitária, integração PostgreSQL local, E2E, build, Knip e audit.
O workflow `Verify Sentry Production readiness`
`33718401953` também terminou `success` no mesmo SHA.
O workflow `Backup Production database` `33778673874`
terminou `success` no mesmo SHA. O job `verify-resend-lifecycle` do
workflow `Run Staging jobs` `33718939437` terminou `success` no
mesmo SHA.

Os registros de deployment mais recentes de `vercel-production` e
`vercel-staging` no mesmo SHA têm status `success`. Uma tentativa
anterior de `vercel-production` terminou `failure` e não é tratada como
evidência de sucesso. Os Environments `vercel-production` e
`vercel-staging` permanecem restritos, respectivamente, a
`main` e `staging`.

Os itens externos 1 a 8 foram confirmados pelo responsável em 2026-09-03:
R2 restore, lock/lifecycle, restore Neon, cabeçalhos Production e rotação de
secrets Resend estão confirmados. O registro é uma confirmação operacional
sanitizada, sem valores de secrets, payloads, URLs assinadas ou PII.

O DMARC permanece em observação com política `p=none; pct=100`; nenhum registro
foi alterado nesta remediação. A progressão segue exclusivamente o
[runbook de observação DMARC](dmarc-rollout.md). MFA administrativo permanece
fora do produto e não é gate de release.

## Histórico operacional — 2026-08-31

Production está no deployment `dpl_74TPMVyUzPXw2hrzu28JVDWVx5rR`, estado
`READY`, região `gru1`, servido pelo commit
`a73d56fe599895a3a611c3ad89a8e05aab87ec8e`. Staging está no deployment
`dpl_8iuX2uxQTcpaUAKjoYCEGPCadhtM`, estado `READY`, servido pelo commit
`a95be66d7645e17d3bf83528ffa065b7ced38861` e disponível em
`preview.neurocapacitar.com.br`.

O workflow protegido `33428545203` confirmou o deployment exato de Staging,
avançou `main` por fast-forward, aguardou a build Production automática,
executou os gates sem migration, fez smoke no deployment não promovido,
promoveu o mesmo artefato e confirmou seus metadados. Depois, o PR `#185`
publicou o endurecimento em Staging; o workflow `33443124148` aplicou as
migrations sem alteração de schema. Production continua em `a73d56f` e
Staging em `a95be66` até a próxima promoção manual.

Os endpoints públicos `/api/health` de Production e Staging retornaram HTTP
200 na última verificação. A Vercel está configurada com `main` como branch de
Production, `staging` como branch de homologação e sem autoatribuição do
domínio Production durante a build. Não houve deployment manual paralelo
criado pelo workflow.

O caminho sem migration foi comprovado. O caminho com migration, a simulação
de hotfix exclusivo e a reconciliação com divergência ainda precisam de uma
validação controlada em Staging. A auditoria Sentry não foi concluída nesta
execução porque não havia credencial Sentry disponível para consulta.

O cron JMVStream permanece em quinze minutos, assim como os workers de Asaas,
outbox e Resend. O backup PostgreSQL Production permanece agendado a cada seis
horas. Nenhuma branch Neon é criada pela CI ou por um deploy comum; branches de
recuperação são criadas somente em operações explícitas, com expiração e sem
endpoint de compute.

Permanecem pendentes a substituição do token temporário da Vercel, o inventário
das branches Neon, o ajuste dos computes e a separação de Production e
Non-production em projetos Neon distintos. Esses itens não impedem o estado
atual, mas devem ser concluídos antes de considerar a migração operacional
encerrada.

## Atualização de escopo — MFA administrativo

MFA administrativo não faz parte do produto atual. A implementação ativa foi
removida na árvore candidata, e o login de `admin` e `support` usa sessão Better
Auth, RBAC, bloqueio de Conta e as confirmações próprias de cada operação. As
estruturas históricas da migration `0065` permanecem no schema e no histórico
para evitar uma remoção destrutiva; não são registradas no adaptador nem lidas
pelo runtime. Esta alteração ainda não foi publicada em Production.

O workflow manual `Verify Sentry Production readiness` e o
[checklist de pendências externas](external-readiness-checklist.md) documentam
as provas de Sentry, e-mail/DMARC, R2 e CI que ainda dependem de acesso humano a
providers. A ausência de MFA não é um gate de release.

## Histórico operacional — 2026-08-26

O deployment Production observado continua `dpl_8TdrhAsLdPF6BCDSuw5ArE8VCkFb`,
`READY`, `target=production`, região `gru1`, com o commit
`1c0202f935934285901f90e2b8c68f887f00222e`. O endereço canônico
`https://app.neurocapacitar.com.br` resolve por CNAME para a infraestrutura DNS da
Vercel e responde normalmente. O projeto Vercel é `hub`; a resposta do endpoint
de deployment lista o alias `hub-neuro-capacitar.vercel.app`, enquanto o domínio
customizado é comprovado pelo endpoint de domínios do projeto. O checker foi
corrigido para usar as duas fontes e exigir `verified=true` e o `projectId` esperado.

O checkout público foi exercitado em Production e houve uma venda real confirmada
pela operadora. Isso é evidência pós-deploy do caminho comercial, não substitui a
requalificação completa nem prova, por si só, o e-mail entregue, a Concessão,
Matrícula, acesso ao Curso e eventual reembolso. Não repetir cobrança para obter
essa prova.

Os workers Production estão ativos: Asaas a cada minuto; JMVStream, outbox e
webhook Resend a cada cinco minutos; matrícula e manutenção diariamente. As
consultas recentes retornaram HTTP 200 nos quatro workers; os poucos HTTP 500 do
último dia pertencem ao deployment anterior e foram causados pelo segredo ausente
do webhook Resend.

Uma leitura agregada somente leitura da Production em `2026-08-28T16:34:23Z`
encontrou dois pedidos pagos nas últimas 24 horas; ambos possuíam Concessão e
Matrícula correspondentes. No mesmo intervalo, dois efeitos da outbox e três
mensagens de e-mail terminaram `delivered`; não houve checkout falho nem bounce
novo. Isso comprova a projeção persistida do fluxo, mas não substitui a
confirmação na caixa do comprador nem a evidência de reembolso.

O `main` atual inclui as correções de fallback de upload R2 e do checker de domínio,
mas ainda não foi promovido por um release protegido novo. O backup Production
passou em duas execuções manuais consecutivas (`33023906420` e `33026369149`),
com manifestos válidos e checker de frescor verde. O restore R2 também foi
comprovado no backup `e0b48105-1496-4837-b81e-af30f0063781`: RTO de 105 segundos,
46 tabelas, 537 constraints e quatro índices críticos em target descartável,
removido após a confirmação. O PITR em `production` foi criado, validado por
parent/timestamp e smoke, e removido; o RPO sintético foi de aproximadamente
11m49s. Três execuções agendadas (`33060433027`, `33121852706` e
`33167077717`) terminaram `success` no SHA atual, embora com atrasos de até
aproximadamente 5h08. A promoção continua dependente do checker protegido com as
secrets R2 read-only e dos demais gates externos; o estado decisório permanece
`NO-GO` para uma nova promoção.

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

## Registro histórico: checkpoint de Staging de 25 de agosto de 2026

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

Até esse checkpoint, Production permanecia no commit
`9f2b8f177e7531f1c19242099f403c55b3820d08`, sem deploy, alias, migration,
configuração, dado, DNS ou venda alterados. O checkpoint operacional atual no
início deste documento supersede essa fotografia; a decisão de prontidão ainda
permanece `NO-GO`.

### Atualização Resend/Sentry em Staging

O merge do PR `#58` produziu `2aea10a19e8c3e4267358afd52b531713b9a1e2a`. O deploy
`32879658351` publicou o mesmo SHA, backup `staging-release-32879658351-1`, e a
rota de readiness Resend com segredo Sensitive exclusivo de Staging. O primeiro
run de lifecycle `32875321220` falhou antes de criar mensagem; após a correção,
o run `32880106811` confirmou `email.sent`, `email.delivered`, estado final
`delivered` e correlação sanitizada. O workflow normal de Staging também passou a
chamar o worker Resend a cada cinco minutos.

O Sentry continua no projeto histórico `hub-development`; a prova técnica de
release/source map/evento permanece válida, mas `scrubIPAddresses=false` e o
alerta sem filtro de ambiente/canal institucional mantêm o gate aberto. Nenhum
projeto foi removido ou renomeado.

## Atualização

Atualize os seis campos de estado na mesma mudança que altera o procedimento de
release. Não substitua `deployed_commit` por `verified_commit` enquanto o deployment
não tiver passado pelo smoke test do ambiente correspondente.

## Higiene de branches e providers

`main` e `staging` são branches persistentes. O fluxo aprovado é
`feature → staging → main → Deploy Vercel production`; `main` continua sendo a
branch padrão e Production. A branch `staging` não é apagada após merge. Um
hotfix pode avançar `main` sozinho; antes da próxima release, incorpore `main`
em `staging`, teste a árvore combinada e só depois promova por fast-forward.
Branches de feature mescladas devem ser removidas
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
`401`). Uma venda real foi confirmada posteriormente pela operadora; ela é
evidência pós-deploy e não substitui a requalificação nem autoriza nova cobrança.
Resend, Neon, Vercel, R2, JMVStream, Auth e Asaas usam rotação manual por
fingerprints; nenhum valor de secret pertence a este documento.

## Checkpoint de Staging após normalização — 2026-08-29

O PR `#135` introduziu a guarda explícita do branch upstream no workflow de
Staging e o PR `#136` registrou o checkpoint operacional. Ambos foram
mesclados por squash; o topo remoto de `staging` é `83bc730`.

A CI pós-merge `33251931777` passou Quality gates, PostgreSQL integration,
Browser journeys e Build and dependency audit. O deploy manual de Staging
`33252479223` passou criação/ancestry do backup, migrations, deployment Vercel
e smoke do deployment e do alias estável.

O cleanup Neon executado pelos runs `33251220857` e `33252449906` removeu
somente backups superseded, preservando o mais recente em cada rodada. Nenhuma
branch persistente ou dado Production foi alterado. O projeto
`hub-production` continua preservado.

## Checkpoint de reconciliação staging-first — 2026-08-29

O PR `#137` foi criado a partir de `origin/staging`, incorporou `origin/main`
sem descartar os commits de Staging e foi mesclado somente em `staging`. Os
conflitos de Sentry, R2, backup, restore, workflows e documentação foram
revisados; o topo remoto atual é `28cc7d9746d7f59afec7a0464d7c625c402b0a8d`.

A CI pós-merge `33253781385` passou os quatro gates: Quality gates,
PostgreSQL integration, Browser journeys e Build and dependency audit. O deploy
`33254285118` passou backup Neon, ancestry, migrations, publicação da SHA exata
e smoke do alias estável `preview.neurocapacitar.com.br`.

A branch remota e o worktree temporários da reconciliação foram removidos após
a verificação de limpeza. O worktree `production-normalization` permanece
preservado porque ainda está associado à branch local ativa
`codex/restore-node-tls`. `main`, o deployment Production e seus dados não
foram alterados. Como o merge foi squash, a ancestralidade Git dos branches
continua divergente mesmo com a árvore de arquivos reconciliada.

## Fechamento documental do checkpoint — 2026-08-29

O PR documental `#138` foi mesclado somente em `staging`; o topo remoto atual é
`858eb5ab7df24a5adca2a23e692ec1c43138dc97`. A CI pós-merge `33255552588`
passou os quatro gates. O deploy automático `33255999615` parou antes da
publicação por `BRANCHES_LIMIT_EXCEEDED`; o cleanup controlado `33256066788`
removeu o único backup superseded identificado e preservou o mais recente.
O deploy manual protegido `33256090157` passou backup, ancestry, migrations,
publicação da SHA exata e smoke do alias estável.

Esse retry não alterou `main` nem Production. A quota Neon continua registrada
como pendência de política de retenção, não como falha do código ou do deploy.
