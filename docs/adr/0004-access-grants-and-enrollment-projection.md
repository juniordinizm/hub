---
status: proposed
owner: product
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# ADR-0004 Concessão como fonte e Matrícula como projeção

## Contexto

Uma Conta pode adquirir o mesmo Curso mais de uma vez. Reembolso, disputa, renovação e ajuste pertencem à origem individual; a experiência da Aluna precisa de um único acesso atual.

## Proposta

Tratar `enrollment_grants` como ledger de direitos por fonte e `enrollments` como projeção Conta + Curso. Toda mutação financeira altera a Concessão e chama `rebuildEnrollmentProjection`. Não criar Matrícula diretamente.

## Alternativas

- Matrícula como fonte única: simples, mas perde origem e combina mal múltiplas compras.
- uma Matrícula por Pedido: preserva origem, mas complica autorização e UI.

## Consequências

- reconciliação pode reconstruir a projeção;
- regras de precedência entre múltiplas Concessões precisam ser formais;
- seeds e ferramentas devem criar fonte antes da projeção;
- mais tabelas e eventos, em troca de rastreabilidade.

## Estado

Implementado no código, aguardando ratificação de produto. `db:seed:student` respeita a proposta:
cria uma Concessão `manual` idempotente, identificada por `manual_reference`, e recompõe a
Matrícula pela projeção oficial. As migrations `0021` e `0022` foram promovidas para produção
em 2026-07-20.
