---
status: index
owner: product-and-engineering
last_verified_commit: edad1eb
---

# Planos de aconselhamento

Este diretório contém auditorias e planos específicos que não fazem parte do
roadmap mestre em `plans/`. Cada plano é somente uma proposta até que uma
pessoa responsável autorize sua execução.

## Ordem recomendada

| Plano | Escopo | Status | Dependência |
|---|---|---|---|
| [Sentry somente em Production](sentry-production-only-observability-2026-09-11.md) | Sentry, alertas, readiness, privacidade e volume | in-progress | ajustes externos e janela de observação |
| [Padronização do Admin](admin-surface-standardization-2026-09-09.md) | Superfícies administrativas | complete | — |
| [Auditoria final do Financeiro](financial-final-ui-audit-2026-09-09.md) | `/admin/financeiro` | implemented | — |
| [Auditoria profunda do Admin](admin-dashboard-review-2026-09-08.md) | Operação administrativa | review | — |
| [Implementação do Admin](admin-dashboard-implementation-plan-2026-09-08.md) | Reorganização do Admin | implemented | auditoria do Admin |
| [Pesquisa externa do Admin](admin-dashboard-external-research-2026-09-08.md) | Referências e operadores | research | — |

Ao executar ou encerrar um plano, atualize seu `status` e esta tabela. O
roadmap integrado do produto permanece em `plans/README.md`.
