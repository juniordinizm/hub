---
status: canonical
owner: engineering
last_verified_commit: ba883f14af8d8587b5eb0aec75e3969fa937ffcd
---

# Comércio e acesso

## Escopo

Une checkout, Pedido, webhook, revisão, reembolso, Concessão, Matrícula, expiração e bloqueio por curso.

## Estados

O processor Asaas aplica estes estados sobre o Pedido bloqueado; o fluxo legado
AbacatePay permanece durante a migração:

- Pedido: `pending`, `paid`, `refunded`, `disputed`, `cancelled`.
- Webhook: `received`, `processing`, `retryable`, `processed`, `ignored`, `failed`.
- Revisão: `pending`, `approved`, `rejected`; tipos `amount_mismatch`,
  `terminal_conflict`, `event_anomaly`, `partial_refund` e `uncertain_result`.
- Reembolso: `requested`, `processing`, `uncertain`, `failed`, `confirmed`.
- Concessão: `active`, `expired`, `refunded`, `disputed`, `cancelled`.
- Matrícula: `active`, `expired`, `revoked`.

### REG-COM-001 Pedido preserva o contrato vendido

Ao criar checkout, o Pedido captura preço, duração de acesso, Curso e identidade da compra. Alterar o Curso depois não altera o Pedido histórico.

**Contrato aprovado:** Curso pago custa no mínimo `1000` centavos, equivalentes a
R$ 10. A autoria valida o preço ao criar ou editar o Curso, e o checkout repete a
validação antes de criar o Pedido ou chamar o provider. Dados de teste abaixo desse
mínimo devem ser ajustados ou removidos.

**Implementação atual:** a autoria persiste `price_in_cents` localmente ao criar ou
editar Curso, aceita zero para Curso gratuito e rejeita Curso pago abaixo de `1000`
centavos sem depender de gateway ou produto remoto. O núcleo Asaas em
`src/features/payments/checkout.ts` repete o mínimo, persiste o Pedido antes do efeito
externo e usa exclusivamente os snapshots obrigatórios de nome, descrição, valor e
duração. As entradas autenticada e pública usam esse mesmo núcleo. O limite público é
coordenado no PostgreSQL por HMAC de IP e ID canônico do Curso, com cinco novas intenções
por dez minutos; uma tentativa já persistida não consome novamente o limite. As migrations
`0046`, `0047` e `0048` ainda não foram aplicadas.

**Falha:** preço abaixo de `1000` centavos, Curso indisponível, limite público ou provider
sem configuração impedem checkout.

### REG-COM-002 Webhook é autenticado e idempotente

`verifyAbacatePayWebhookSecret`/`verifyAbacatePaySignature` validam origem. `getAbacatePayEventKey` e `webhook_events` impedem reaplicar a mesma entrega.

Para Asaas, `POST /api/webhooks/asaas` compara somente o header `asaas-access-token` com
o segredo server-only, limita o corpo antes de JSON e persiste eventos estruturalmente
válidos antes de responder `200`. Duplicata também responde `200`; falha de banco não.
O worker genérico separado possui claim, posse, stale-lock recovery, retry e conclusão
CAS. O processor financeiro existe, mas o worker não está agendado; schedule permanece
uma unidade separada da Etapa 7.
Payload vencido nunca volta ao worker: a manutenção sanitiza a evidência bruta e
terminaliza qualquer evento não concluído com código seguro.

**Invariantes:**

- responder sucesso só após persistir o desfecho;
- uma repetição não duplica Pedido, Concessão ou efeito;
- evento desconhecido pode ser ignorado sem abrir acesso;
- payload externo é tolerante a campos adicionais.

**Concorrência:** o processor correlaciona identificadores exatos, bloqueia o Pedido antes
de ler seu snapshot e associa o Webhook por CAS. Para Conta com credencial, o acesso
liberado grava `email.access-released`; sem credencial, grava
`auth.account-activation`. Ambas as intenções entram na outbox antes do commit e usam
chave idempotente por Pedido.

### REG-COM-003 Estado terminal não é sobrescrito silenciosamente

**Contrato aprovado para Asaas:**

- `CHECKOUT_PAID` não libera acesso;
- PIX libera em `PAYMENT_RECEIVED`;
- cartão libera em `PAYMENT_CONFIRMED` quando não há `provider_risk_status`
  `AWAITING_RISK_ANALYSIS` ou `REPROVED_BY_RISK_ANALYSIS`; aprovação de risco posterior
  pode destravar uma confirmação já armazenada;
- o valor bruto `value` deve corresponder exatamente ao snapshot do Pedido em centavos,
  com tolerância zero;
- divergência não libera e abre revisão;
- Revisão pendente criada pelo evento atual ou anterior mantém o Pedido pendente,
  preservando somente evidência segura do provider e bloqueando Concessão/outbox;
- reembolso confirmado, disputa e chargeback prevalecem e revogam;
- Revisão bloqueia concessão, não a revogação de um evento adverso autoritativo; sem
  Conta ou Concessão paga `active`/`expired`, a revogação é no-op; Pedido já adverso ou
  conflito terminal não impede revogar uma Concessão ainda efetiva; a transição da
  Concessão filtra seu estado no `UPDATE` atômico e só então gera evento/projeção;
- `provider_payment_status` avança de `CONFIRMED` para `RECEIVED`, mas não regride por
  `CONFIRMED`, `OVERDUE`, `DELETED` ou `PENDING` tardio;
- pagamento tardio não reativa estado adverso;
- checkout `cancelled`/`expired` não regride para `active`; terminais divergentes preservam
  o primeiro e abrem Revisão;
- cancelamento ou expiração tardios não revogam Pedido já pago;
- evento parcial, desconhecido, regressivo ou contraditório abre revisão ou alerta;
- decisão manual exige permissão, motivo e auditoria.

**Implementação atual:** `decideAsaasFinancialEvent` produz a decisão pura e
`processAsaasWebhookEvent` a aplica sob lock na mesma transação do worker. Valor
divergente, anomalia, reembolso parcial e conflito terminal criam uma Revisão
idempotente pelo `webhook_event_id`; identificadores ambíguos não escolhem Pedido nem
produzem efeito. O fluxo AbacatePay ainda usa sua precedência legada.

### REG-COM-004 Concessão é a origem; Matrícula é a projeção

Concessão é o ledger e a fonte do direito; Matrícula é a projeção de Conta + Curso. Fluxos
financeiros alteram a Concessão e recompõem a Matrícula, sem criar Matrícula diretamente.
A origem financeira aprovada é neutra, `paid_order`.

**Implementação atual:** `applyPaidWebhookAccess` cria ou reativa a Concessão associada
ao Pedido e `rebuildEnrollmentProjection` consolida as Concessões.

**Invariantes implementados:**

- `paid_order` representa Pedido financeiro em `order_id`; `manual` representa concessão
  auditável sem Pedido em `manual_reference`, usada pelo bootstrap local;
- cada Pedido e cada referência manual possuem Concessão única;
- Concessão financeira terminal não é reativada por novo evento pago do mesmo Pedido;
- Matrícula ativa usa a janela efetiva das Concessões ativas;
- sem Concessão elegível, projeção vira `expired` ou `revoked` conforme o último estado.

O modelo de ledger e projeção foi aceito em
[ADR-0004](../adr/0004-access-grants-and-enrollment-projection.md). O schema e o módulo de
Matrículas usam `paid_order`; revogações financeiras usam razões neutras
`payment_refund` e `payment_dispute`.

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

`confirmRefundPasswordAction` emite confirmação; `requestFullRefundAction`/`requestFullRefund`
reservam a intenção local, chamam o Asaas uma única vez e persistem em
`refund_requests` somente a evidência correlacionada ao mesmo pagamento, referência
externa e valor integral.

**Autorização:** `executeRefund`.

**Falhas:** ausência de ID externo, Pedido incompatível, senha não confirmada, resposta
mal correlacionada ou falha do provedor deixam rastro e não devem revogar acesso por
suposição. Rejeição definitiva vira `failed`; resultado desconhecido vira `uncertain` e
exige conciliação, sem repetição cega.

O token de confirmação e sua auditoria usam uma transação local. A reserva e sua
auditoria usam outra transação local antes da mutação externa. A persistência da
evidência ou da falha ocorre depois da resposta do provider.

## Evidências

- schema: `orders`, `webhookEvents`, `paymentReviews`, `refundRequests`, `enrollmentGrants`, `enrollments`, `enrollmentExpirationAdjustments`, `enrollmentEvents`;
- implementação: `src/features/payments`, `src/features/enrollments/server.ts`;
- testes: `src/features/payments/*.test.ts`, `src/features/enrollments/*.test.ts`, `src/features/admin/enrollment-*.test.ts`;
- endpoints: `src/app/api/checkouts/course/route.ts`, `src/app/api/webhooks/abacatepay/route.ts`, `src/app/api/webhooks/asaas/route.ts`, `src/app/api/cron/enrollments/route.ts`.

## Decisões e bloqueios

- [ADR-0004](../adr/0004-access-grants-and-enrollment-projection.md), aceito e implementado
  com origem financeira e razões de revogação neutras.
- [ADR-0005](../adr/0005-financial-precedence-and-manual-review.md), aceito e implementado
  pela decisão pura e pelo processor transacional Asaas.
- `db:seed:student` cria Concessão `manual` e recompõe a Matrícula pela projeção oficial.
- A ativação durável guarda somente `userId` e `orderId`; o processor a enfileira no
  mesmo commit do acesso, e o delivery resolve a Conta e gera o token apenas ao chamar
  Better Auth. Veja o
  [runbook de outbox](../operations/outbox-and-transactional-effects.md).
- Infraestrutura AbacatePay e dados reais não verificados.
- Adapter, schema, checkout, inbox, processor, worker agendado, reembolso e conciliação
  Asaas existem em código. As migrations e os fluxos PIX, cartão, cancelamento,
  expiração, reembolso, conciliação e retry após indisponibilidade passaram em
  PostgreSQL descartável e Sandbox. O Sandbox não emitiu eventos de risco na compra de
  cartão observada; esse ramo está coberto por testes automatizados. O corte de produção
  permanece pendente.
