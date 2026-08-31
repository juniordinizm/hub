---
status: canonical
owner: engineering
last_verified_commit: d3943758755a49f09e4e3118044a17a91b2e6794
---

# Fluxo de release do Hub

Este é o procedimento vigente para levar alterações até
`https://app.neurocapacitar.com.br`.

## Regra das branches

`main` é a branch padrão do GitHub e representa o último candidato de
Production. `staging` é a branch permanente de homologação online.

Branches de trabalho nascem de `staging`:

```text
feature/*, fix/*, chore/* → staging → main → Production
```

Um PR normal deve ter `staging` como base. O merge em `staging` publica o
mesmo SHA no Custom Environment `staging` da Vercel, disponível em
`https://preview.neurocapacitar.com.br`.

Como `main` é a branch padrão do GitHub, a CI também roda PRs direcionados a
ela, mas falha deliberadamente para PRs normais e orienta a trocar a base para
`staging`. A exceção exige simultaneamente uma branch `hotfix/*` e o label
`hotfix`.

Depois de uma release normal, `main` e `staging` apontam para o mesmo commit.
A promoção de `staging` para `main` usa fast-forward; não se deve criar um
segundo PR de release, fazer squash da promoção ou criar uma branch de
reconciliação quando as branches já estiverem alinhadas.

## Hotfix

Um hotfix pode entrar diretamente em `main` quando o tempo de recuperação for
mais importante que a homologação de Staging. Esse estado é permitido:

```text
main → Production + hotfix
staging → Production anterior + alterações acumuladas
```

Novos PRs ainda podem entrar em `staging`. Antes da próxima release, execute
`Prepare Production release`. Se houver commits exclusivos de `main`, o
workflow cria uma branch `sync/production-into-staging-*`, incorpora `main`,
dispara a CI e abre um PR para `staging`. Resolva conflitos somente nessa PR,
homologue a árvore combinada e só então execute `Deploy Vercel production`.

Quando o merge automático encontra conflitos, o workflow preserva `staging`,
publica uma variante da branch de sincronização baseada em `main` e abre o PR
já com a divergência visível. A resolução continua restrita ao PR; não se
editam branches persistentes diretamente.

Hotfixes não podem conter migrations. Uma alteração de banco segue o fluxo
normal de Staging, backup e promoção.

Em uma indisponibilidade, o primeiro recurso é rollback para o deployment
Production anterior compatível. O forward-fix só começa depois que o rollback
for descartado ou insuficiente.

## CI

A CI completa executa uma vez por PR para `staging` ou `main`. Ela usa
PostgreSQL 18 local no runner, com bancos separados para integração e E2E.
Não cria branches Neon, não usa dados Production e não executa em todo push.

O merge em `staging` tem uma operação pequena e separada que aplica migrations
no banco persistente de Staging. Essa operação não faz deployment Vercel e não
repete a CI.

## Release normal

1. Homologue o deployment atual de Staging.
2. Execute `Deploy Vercel production` com `mode=release-staging`.
3. O workflow confirma que `main` é ancestral de `staging`.
4. `main` avança por fast-forward para o SHA homologado.
5. O workflow cria uma build Production sem domínio.
6. Sem migration, não há branch Neon de release nem migration de banco.
7. Com migration, o workflow exige backup independente recente, cria branch de
   recuperação sem compute, aplica a migration e audita o journal.
8. Readiness, R2 e smoke público precisam passar antes da promoção.
9. A promoção usa o mesmo deployment validado, sem rebuild.

O domínio Production permanece apontando para a versão anterior até a etapa de
promoção. Falha de build, migration ou smoke não deve alterar o tráfego público.

## Vercel

O Git Integration publica `staging` e também cria a build Production quando o
workflow avança `main`. Feature branches não geram previews automáticos porque
o `ignoreCommand` encerra essas builds. O domínio Production não é
autoatribuído durante a build; o workflow aguarda a build do SHA exato, executa
os gates e promove o mesmo deployment.

Não execute `vercel deploy` manualmente para corrigir uma variável de ambiente
ou repetir uma release. Atualize a variável no ambiente correto e use o
workflow; deploys manuais quebram a rastreabilidade do SHA e podem criar builds
duplicadas.

## Cron e workers

O cron JMVStream permanece ativo em Production a cada 15 minutos. Ele busca
vídeos em `processing`, atualiza player e thumbnail, reconcilia a pasta do
curso e expira uploads abandonados.

Em Staging, os workers são executados somente pela operação manual
`Run Staging jobs`. O schedule de cinco minutos do GitHub Actions foi removido.

As inboxes Asaas/Resend, leases, retries, dead-letter e outbox são mantidos.
Qualquer redução adicional de frequência exige evidência de que o processamento
imediato e a recuperação continuam funcionando.

## Backups e Neon

O backup PostgreSQL Production continua a cada seis horas, criptografado e
publicado no bucket privado de backups. Branch Neon de recuperação só é criada
quando a release contém migration.

Production não deve compartilhar cota com CI. A CI usa PostgreSQL local. O
plano de separação futura mantém Production e Non-production em projetos Neon
distintos, ambos com limite de compute conservador e scale-to-zero quando
aplicável.

## Checklist de segurança

Antes de promover:

- CI verde para o candidato;
- deployment Staging e domínio estável saudáveis;
- `main` e `staging` reconciliadas;
- backup recente quando houver migration;
- nenhum segredo impresso em log ou commit;
- readiness e R2 verdes;
- smoke de `/`, `/entrar`, `/admin`, checkout e webhook;
- Sentry e logs Vercel sem erro novo relevante;
- rollback compatível identificado.

Toda alteração em branch, workflow, environment, migration, cron ou backup
deve atualizar este documento e o guia operacional específico. Rode
`bun run docs:check` antes de abrir o PR.
