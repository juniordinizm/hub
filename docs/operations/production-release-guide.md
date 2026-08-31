---
status: runbook
owner: engineering
last_verified_commit: d3943758755a49f09e4e3118044a17a91b2e6794
---

# Guia de Production

O procedimento diário vigente está em [Fluxo canônico de
release](release-flow.md). Este caminho foi mantido para preservar links
antigos do repositório; não duplique instruções de branch, migration ou
deploy aqui.

## Resumo operacional

1. PR normal: `feature/*` ou `fix/*` baseado em `staging`, com destino
   `staging`.
2. Homologação: aguarde o deployment automático em
   `https://preview.neurocapacitar.com.br`.
3. Release: execute `Deploy Vercel production` em modo `release-staging`.
4. Hotfix: use `hotfix/*` diretamente em `main` somente quando necessário;
   depois prepare a reconciliação `main → staging` antes da próxima release.
5. Em qualquer incidente, tente rollback antes de uma alteração corretiva.

O workflow mantém Production no deployment anterior até readiness, migrations
quando aplicáveis e smoke público passarem. Não digite SHA manualmente, não use
deploy Vercel avulso e não execute migrations diretamente no banco Production.

Consulte o guia canônico para o checklist completo, critérios de fast-forward,
cron JMVStream, backups, Neon, Vercel e validação pós-deploy.
