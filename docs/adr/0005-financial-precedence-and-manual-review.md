---
status: accepted
owner: product
last_verified_commit: b97f9594d6b4c06efe6287225e86e6d9c637f1b5
---

# ADR-0005 Precedência financeira e revisão manual

## Contexto

Webhooks podem repetir, atrasar ou chegar fora de ordem. Eventos terminais conflitantes e valor inesperado tornam perigoso liberar ou revogar acesso automaticamente.

## Decisão

Aplicar uma matriz explícita de transições e preservar o estado seguro quando um
evento for ambíguo ou conflitante.

### Matriz aprovada para Asaas

- `CHECKOUT_PAID` não libera acesso;
- PIX libera em `PAYMENT_RECEIVED`;
- cartão libera em `PAYMENT_CONFIRMED` quando `provider_risk_status` não está em
  `AWAITING_RISK_ANALYSIS` nem `REPROVED_BY_RISK_ANALYSIS`; confirmação armazenada
  enquanto o risco está pendente pode ser destravada por
  `PAYMENT_APPROVED_BY_RISK_ANALYSIS` posterior;
- o valor bruto `value`, convertido na borda, deve coincidir exatamente com o snapshot
  do Pedido em centavos; a tolerância é zero;
- divergência de valor não libera acesso e abre revisão;
- uma aprovação manual de `amount_mismatch` exige que o valor observado do Asaas
  esteja persistido na própria Revisão; o `paid_amount_in_cents` antigo do Pedido
  não substitui essa evidência. A aprovação pode completar valores líquidos e taxas
  somente quando também houver evidência correspondente;
- uma Revisão pendente do Pedido bloqueia pagamento posterior de conceder acesso ou
  marcar o Pedido como pago; o processor preserva apenas a evidência segura do provider
  até decisão manual;
- reembolso confirmado, disputa e chargeback prevalecem e revogam acesso;
- evento adverso sempre solicita revogação da Concessão ainda `active` ou `expired`,
  mesmo quando o Pedido já está adverso ou há conflito terminal; Concessão já terminal
  torna a repetição um no-op; o predicado de estado pertence ao próprio `UPDATE`
  atômico, e zero linhas alteradas não gera evento nem recompõe projeção;
- `provider_payment_status` usa precedência explícita: `CONFIRMED` pode avançar para
  `RECEIVED`, mas `RECEIVED` não regride por `CONFIRMED`, `OVERDUE`, `DELETED` ou
  `PENDING`; estado pago ou adverso também preserva a evidência autoritativa contra
  esses eventos regressivos;
- pagamento tardio não reativa Pedido em estado adverso;
- cancelamento ou expiração tardios não revogam Pedido já pago;
- evento parcial, desconhecido, regressivo ou contraditório abre revisão ou alerta,
  conforme haja ou não Pedido correlacionado e decisão operacional possível.

Uma decisão manual exige `manageFinancialReviews`, capacidade mutável exclusiva de
Admin, motivo obrigatório e trilha de auditoria. `viewFinancials` é somente leitura.
Somente `amount_mismatch` admite uma decisão genérica explícita de liberar ou manter
o bloqueio. `buyer_identity` exige reembolso integral; `event_anomaly`,
`terminal_conflict` e `uncertain_result` exigem conciliação/reprocessamento; e
`partial_refund` exige tratamento financeiro específico. Esses tipos não aceitam
aprovação ou rejeição genérica. Quando a conciliação é iniciada a partir de uma Revisão, ela pode resolver
a revisão vinculada somente se não abrir nova divergência e produzir um resultado
financeiro seguro. A decisão resolve a exceção registrada; não apaga o evento externo
nem reescreve o histórico.

### Trilha financeira

Ocorrências financeiras também são registradas em `financial_events` como uma
trilha append-only. O registro normaliza a origem, a chave idempotente, a data,
os estados antes/depois quando disponíveis, valores, identificadores externos e
vínculos seguros ao Pedido, webhook, reembolso ou Revisão. A migration inicial
faz backfill somente de snapshots marcados; ela não inventa transições que não
foram preservadas. Payloads brutos continuam sujeitos à retenção da inbox.

## Alternativas

- último evento vence: simples, vulnerável a atraso e retry;
- sempre confiar no provedor: não resolve divergência entre eventos do próprio provedor;
- bloquear todo evento terminal para revisão: seguro, mas aumenta carga operacional.

## Consequências

- exceções não desaparecem em logs;
- operação precisa de fila e SLA;
- aprovação/rejeição deve ser auditada;
- a integração precisa distinguir método de pagamento, risco e valor bruto;
- revisão e alerta precisam ser duráveis e observáveis.

## Estado

Decisão aceita e implementada para Asaas. Webhook e consulta de conciliação reutilizam
a mesma matriz de autoridade e precedência; um módulo compartilhado aplica identidade,
estado pago, Concessão e outbox. O worker possui agendamento protegido e as migrations
Asaas estão aplicadas em Staging e Production.
