---
status: proposed
owner: product
last_verified_commit: 888ad2f8addddef9dec4f11bacad8580ffb7181b
---

# ADR-0005 Precedência financeira e revisão manual

## Contexto

Webhooks podem repetir, atrasar ou chegar fora de ordem. Eventos terminais conflitantes e valor inesperado tornam perigoso liberar ou revogar acesso automaticamente.

## Proposta

Aplicar uma matriz explícita de transições. Quando a transição terminal conflitar ou o valor divergir do snapshot, preservar o estado seguro e criar `payment_reviews`. Somente decisão autorizada resolve a revisão.

## Alternativas

- último evento vence: simples, vulnerável a atraso e retry;
- sempre confiar no provedor: não resolve divergência entre eventos do próprio provedor;
- bloquear todo evento terminal para revisão: seguro, mas aumenta carga operacional.

## Consequências

- exceções não desaparecem em logs;
- operação precisa de fila e SLA;
- aprovação/rejeição deve ser auditada;
- matriz e efeito sobre Concessão precisam de ratificação.

## Estado

Parcialmente implementado por `resolveAbacatePayOrderStatus`, `getPaymentReviewRequired` e `resolvePaymentReview`. Ratificação pendente em DEC-DISC-002/003.
