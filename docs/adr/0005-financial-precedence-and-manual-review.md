---
status: accepted
owner: product
last_verified_commit: ba883f14af8d8587b5eb0aec75e3969fa937ffcd
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
Revisões `buyer_identity`, `event_anomaly` e `partial_refund` não admitem encerramento
genérico porque a resolução precisa comprovar e aplicar o efeito financeiro específico.
Ela resolve a exceção registrada; não apaga o evento externo nem reescreve o histórico.

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
