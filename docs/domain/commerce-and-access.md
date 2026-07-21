---
status: canonical
owner: engineering
last_verified_commit: 2df4996ac4875bf48f425a7e3456f3c8ac1fc3aa
---

# Comércio e acesso

## Escopo

Une checkout, Pedido, webhook, revisão, reembolso, Concessão, Matrícula, expiração e bloqueio por curso.

## Estados

- Pedido: `pending`, `paid`, `refunded`, `disputed`, `cancelled`.
- Webhook: `received`, `processed`, `ignored`, `failed`.
- Revisão: `pending`, `approved`, `rejected`; tipos `amount_mismatch` e `terminal_conflict`.
- Reembolso: `requested`, `failed`, `confirmed`.
- Concessão: `active`, `expired`, `refunded`, `disputed`, `cancelled`.
- Matrícula: `active`, `expired`, `revoked`.

### REG-COM-001 Pedido preserva o contrato vendido

Ao criar checkout, o Pedido captura preço, duração de acesso, Curso e identidade da compra. Alterar o Curso depois não altera o Pedido histórico.

**Evidência:** `buildAbacatePayProductRequest`, `buildAbacatePayCheckoutRequest`, `createCourseCheckout` e tabela `orders`.

**Falha:** preço inválido, Curso indisponível, limite público ou provedor sem configuração impedem checkout.

### REG-COM-002 Webhook é autenticado e idempotente

`verifyAbacatePayWebhookSecret`/`verifyAbacatePaySignature` validam origem. `getAbacatePayEventKey` e `webhook_events` impedem reaplicar a mesma entrega.

**Invariantes:**

- responder sucesso só após persistir o desfecho;
- uma repetição não duplica Pedido, Concessão ou efeito;
- evento desconhecido pode ser ignorado sem abrir acesso;
- payload externo é tolerante a campos adicionais.

**Concorrência:** processamento usa transação e identidade externa persistida. Para Conta com credencial,
o acesso liberado grava uma intenção na outbox antes do commit; ativação por senha permanece exceção por token secreto.

### REG-COM-003 Estado terminal não é sobrescrito silenciosamente

`resolveAbacatePayOrderStatus` e `getAbacatePayOrderTransition` aplicam a precedência implementada. Conflito terminal cria `payment_reviews` do tipo `terminal_conflict`; divergência de valor cria `amount_mismatch`.

Esse comportamento existe, mas aguarda ratificação em [DEC-DISC-002](../decisions.md#dec-disc-002) e [DEC-DISC-003](../decisions.md#dec-disc-003).

### REG-COM-004 Concessão é a origem; Matrícula é a projeção

`applyPaidWebhookAccess` cria/reativa a Concessão associada ao Pedido. `rebuildEnrollmentProjection` consolida as Concessões de Conta + Curso em uma Matrícula.

**Invariantes implementados:**

- `abacatepay_order` representa o Pedido financeiro em `order_id`; `manual` representa concessão
  auditável sem Pedido em `manual_reference`, usada pelo bootstrap local;
- cada Pedido e cada referência manual possuem Concessão única;
- Concessão financeira terminal não é reativada por novo evento pago do mesmo Pedido;
- Matrícula ativa usa a janela efetiva das Concessões ativas;
- sem Concessão elegível, projeção vira `expired` ou `revoked` conforme o último estado.

O modelo está implementado, porém o ADR permanece `proposed` porque aprovação histórica não foi localizada.

### REG-COM-005 Acesso exige Conta e Matrícula efetivas

`resolveCourseAccess` e `resolveLessonAccess` consideram papel, bloqueio de plataforma, Matrícula, expiração e disponibilidade do conteúdo. O cliente não decide acesso.

Admin pode usar preview; a mutação de experiência da Aluna continua proibida no preview.

### REG-COM-006 Expiração é calculada sobre a Concessão paga

`extendEnrollmentExpiration`, `setEnrollmentExpiration` e `reverseExpirationAdjustment` alteram a janela efetiva, registram `enrollment_expiration_adjustments` e eventos.

**Autorização:** `manageEnrollmentAccess`.

**Invariantes:**

- motivo é obrigatório e normalizado por `validateEnrollmentAdjustmentReason`;
- extensão aceita dias/meses; definição exata registra antes/depois;
- ajuste não deve mudar carga horária ou duração pedagógica;
- manutenção expira Concessões vencidas e recompõe Matrículas.

**Limitação:** reversão restaura o valor anterior do ajuste escolhido e pode sobrescrever ajustes posteriores encadeados. Não use reversão fora de ordem sem inspeção manual.

### REG-COM-007 Bloqueio manual é reversível e auditável

`blockEnrollmentAccess` cancela Concessões pagas elegíveis com motivo `manual_access_block`; `restoreEnrollmentAccess` restaura apenas Concessões canceladas por esse motivo.

Não confundir com reembolso/disputa nem bloqueio da plataforma. Ambos registram eventos.

### REG-COM-008 Reembolso exige confirmação recente e permissão

`confirmRefundPasswordAction` emite confirmação; `requestFullRefundAction`/`requestFullRefund` chamam a AbacatePay e persistem `refund_requests`.

**Autorização:** `executeRefund`.

**Falhas:** ausência de ID externo, Pedido incompatível, senha não confirmada ou falha do provedor deixam rastro e não devem revogar acesso por suposição.
O token de confirmação e sua auditoria, a reserva de reembolso e sua auditoria, e a falha do provedor e sua auditoria usam a mesma transação local.

## Evidências

- schema: `orders`, `webhookEvents`, `paymentReviews`, `refundRequests`, `enrollmentGrants`, `enrollments`, `enrollmentExpirationAdjustments`, `enrollmentEvents`;
- implementação: `src/features/payments`, `src/features/enrollments/server.ts`;
- testes: `src/features/payments/*.test.ts`, `src/features/enrollments/*.test.ts`, `src/features/admin/enrollment-*.test.ts`;
- endpoints: `src/app/api/checkouts/course/route.ts`, `src/app/api/webhooks/abacatepay/route.ts`, `src/app/api/cron/enrollments/route.ts`.

## Decisões e bloqueios

- [ADR-0004](../adr/0004-access-grants-and-enrollment-projection.md), proposto.
- [ADR-0005](../adr/0005-financial-precedence-and-manual-review.md), proposto.
- `db:seed:student` cria Concessão `manual` e recompõe a Matrícula pela projeção oficial.
- Acesso de Conta já ativada usa a outbox; ativação por senha permanece exceção porque o token não pode ser persistido. Veja o [runbook de outbox](../operations/outbox-and-transactional-effects.md).
- Infraestrutura AbacatePay e dados reais não verificados.
