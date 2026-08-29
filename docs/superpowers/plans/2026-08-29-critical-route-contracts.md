---
status: accepted
execution_status: active
owner: engineering
last_verified_commit: 5af01837acc26581d2ca165a67514308d49d6c4a
---

# Plano de cobertura das rotas críticas

## Objetivo

Fechar a parte restante do Sprint 3 da auditoria de saúde: provar, em testes
de contrato isolados, que as rotas de manutenção agendada e a exportação de
analytics respeitam os guards existentes, não executam trabalho quando um job
está desligado ou sem lease, encaminham o contexto correto ao worker e
registram falhas com códigos operacionais sem expor o erro bruto na resposta.

## Escopo

- `src/app/api/cron/enrollments/route.ts`;
- `src/app/api/cron/jmvstream/route.ts`;
- `src/app/api/cron/maintenance/route.ts`;
- `src/app/api/admin/learning-analytics/export/route.ts`.

Não alterar Production, banco, providers ou a lógica dos workers. Os testes
mockam as dependências de I/O e validam somente o contrato HTTP/lease/observação
da rota.

## Critérios de aceite

- [x] Cada rota agendada retorna imediatamente a resposta do guard, incluindo
  não autorizado e jobs desligados, sem adquirir lease.
- [x] Cada rota agendada cobre lease ocupado, sucesso e falha encaminhada ao
  `observeOperation` com `failureErrorCode` e provider/operation corretos.
- [x] A exportação cobre CSV, escaping, headers `no-store`/download e a
  propagação de uma negativa de autorização sem gerar arquivo.
- [ ] `bun run test` completo, typecheck, Ultracite, docs e migrations passam.

## Execução

1. Criar os testes em branch derivada de `origin/staging`.
2. Executar os testes focados antes de qualquer ajuste de implementação.
3. Corrigir apenas divergências comprovadas pelo teste.
4. Rodar os gates locais completos e abrir PR somente para `staging`.
5. Depois do merge, validar CI/deploy protegido de Staging e remover o
   worktree temporário.
