---
status: accepted
owner: product
last_verified_commit: 384db5ad9bca03ff5723f6c7e2602c80d9e0755c
---

# ADR-0004 Concessão como fonte e Matrícula como projeção

## Contexto

Uma Conta pode adquirir o mesmo Curso mais de uma vez. Reembolso, disputa, renovação e ajuste pertencem à origem individual; a experiência da Aluna precisa de um único acesso atual.

## Decisão

Tratar Concessão como ledger e fonte dos direitos por origem, e Matrícula como projeção
de Conta + Curso. Toda mutação financeira altera a Concessão e recompõe a Matrícula;
nenhum fluxo financeiro cria ou altera Matrícula diretamente.

A origem financeira aprovada é neutra: `paid_order`. Nomes de providers pertencem à
integração e aos identificadores externos, não ao domínio de acesso.

## Alternativas

- Matrícula como fonte única: simples, mas perde origem e combina mal múltiplas compras.
- uma Matrícula por Pedido: preserva origem, mas complica autorização e UI.

## Consequências

- reconciliação pode reconstruir a projeção;
- regras de precedência entre múltiplas Concessões precisam ser formais;
- seeds e ferramentas devem criar fonte antes da projeção;
- mais tabelas e eventos, em troca de rastreabilidade.

## Estado

Decisão aceita. Schema, código e testes usam a origem neutra `paid_order`. Razões de
revogação do módulo de Matrículas também são neutras: `payment_refund` e
`payment_dispute`. O processor financeiro Asaas aplica a Concessão e recompõe a
Matrícula na mesma transação do evento financeiro.

O bootstrap local cria uma Concessão `manual` idempotente, identificada por
`manual_reference`, e recompõe a Matrícula. O corte de Production da migração financeira
permanece pendente.
