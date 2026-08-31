---
status: canonical
owner: engineering
last_verified_commit: 36019cf0a609a7283046d71c694f16d8afd6fec3
---

# Comércio e acesso

## Escopo

Une checkout, Pedido, webhook, revisão, reembolso, Concessão, Matrícula, expiração e bloqueio por curso.

## Estados

O processor Asaas aplica estes estados sobre o Pedido bloqueado:

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
`0044` a `0051` foram promovidas a Production em 2026-07-31; o journal de
Production acompanhou todas as promoções seguintes até `0064`.

Quando a criação retorna `processing`, a página pública consulta a mesma tentativa por
UUID opaco e slug, sem criar outro Checkout automaticamente. O navegador compartilha esse
UUID sem PII entre abas por até 60 minutos, aplica polling limitado em 1, 2, 4, 8 e 16
segundos e então oferece somente verificação manual. A leitura exige a dupla exata, não
aceita `orderId` enumerável separado, responde com `Cache-Control: no-store` e retorna
apenas estado seguro e URL quando o Pedido correspondente já está `active`.

**Falha:** preço abaixo de `1000` centavos, Curso indisponível, limite público ou provider
sem configuração impedem checkout.

### REG-COM-002 Webhook é autenticado e idempotente

Para Asaas, `POST /api/webhooks/asaas` compara somente o header `asaas-access-token` com
o segredo server-only, limita o corpo antes de JSON e persiste eventos estruturalmente
válidos antes de responder `200`. Duplicata também responde `200`; falha de banco não.
O worker genérico separado possui claim, posse, stale-lock recovery, retry e conclusão
CAS. A rota cron está agendada a cada quinze minutos em `vercel.json`, sob kill switch, lease e
deadline; está ativa em Production desde 2026-08-21.
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

**Implementação atual:** `decideAsaasFinancialEvent` produz a decisão pura para webhook
e `decideQueriedAsaasPayment` adapta a consulta da conciliação para a mesma matriz.
`applyConfirmedPaymentAccess` converge identidade autenticada ou pública, estado pago,
Concessão, Matrícula e outbox sob o lock do Pedido. Valor divergente, anomalia,
reembolso parcial e conflito terminal criam uma Revisão; identificadores ambíguos não
escolhem Pedido nem produzem efeito. PIX `CONFIRMED` consultado não libera; PIX
`RECEIVED` e cartão `CONFIRMED`/`RECEIVED` podem recuperar o acesso, respeitando risco,
estado terminal e Revisão pendente.

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

`extendEnrollmentExpiration` e `setEnrollmentExpiration` alteram a janela efetiva, registram `enrollment_expiration_adjustments` e eventos.

**Autorização atual:** `manageEnrollmentAccess`, concedida a Admin e `support`.
O alvo aprovado no [DEC-DISC-014](../decisions.md#dec-disc-014) mantém essa
capacidade ampla somente para Admin e cria uma capacidade restrita para `support`
ajustar validade e bloquear/restaurar a Matrícula com motivo e auditoria. A
separação ainda não está implementada.

**Invariantes:**

- motivo é obrigatório e normalizado por `validateEnrollmentAdjustmentReason`;
- extensão aceita dias/meses; definição exata registra antes/depois;
- ajuste não deve mudar carga horária ou duração pedagógica;
- manutenção expira Concessões vencidas e recompõe Matrículas.
- aviso de expiração carrega a validade exata como geração. Se validade, estado
  ou janela mudar antes do delivery, a outbox termina como `superseded` e não
  chama o adapter de e-mail; o scheduler pode criar a nova geração idempotente.

**Histórico:** existiu `reverseExpirationAdjustment`, removida por ser inalcançável e por restaurar às cegas o valor anterior, podendo sobrescrever ajustes posteriores encadeados. Se a reversão voltar a ser necessária, deve nascer com guarda de ordem, idempotência e recomputação de status. A coluna `reversed_adjustment_id` e o valor de evento `expiration_adjustment_reversed` permanecem no schema por o banco ser forward-only.

### REG-COM-007 Bloqueio manual é reversível e auditável

`blockEnrollmentAccess` cancela Concessões pagas elegíveis com motivo `manual_access_block`; `restoreEnrollmentAccess` restaura apenas Concessões canceladas por esse motivo.

Não confundir com reembolso/disputa nem bloqueio da plataforma. Ambos registram eventos.

### REG-COM-008 Reembolso exige confirmação recente e permissão

`confirmRefundPasswordAction` emite confirmação; `requestFullRefundAction`/`requestFullRefund`
reservam a intenção local, chamam o Asaas uma única vez e persistem em
`refund_requests` somente a evidência de valor integral correlacionada ao mesmo
pagamento. Todos os identificadores presentes precisam convergir e ao menos um dos
identificadores do Pedido precisa corresponder: `externalReference` exata ou
`checkoutSession` exata. Isso admite `externalReference=null` no Payment de Checkout
sem admitir referência ou sessão conflitante.

**Autorização:** `executeRefund`.

**Falhas:** ausência de ID externo, Pedido incompatível, senha não confirmada, resposta
mal correlacionada ou falha do provedor deixam rastro e não devem revogar acesso por
suposição. Rejeição definitiva vira `failed`; resultado desconhecido vira `uncertain` e
exige conciliação, sem repetição cega.

O token de confirmação e sua auditoria usam uma transação local. A reserva e sua
auditoria usam outra transação local antes da mutação externa. A persistência da
evidência ou da falha ocorre depois da resposta do provider.

Conciliação por pagamento e importação de extrato são mutações administrativas e
exigem `manageFinancialOperations`, exclusiva de Admin. Toda resolução manual de
Revisão exige `manageFinancialReviews`, também exclusiva de Admin; `viewFinancials`
autoriza somente leitura. `buyer_identity`, `event_anomaly` e `partial_refund` não
aceitam aprovação ou rejeição genérica: exigem, respectivamente, reembolso integral,
conciliação/reprocessamento ou tratamento financeiro específico. A área financeira
oculta os controles mutáveis para Suporte, mas a autorização do servidor permanece a
barreira efetiva.

### REG-COM-009 Oferta de pagamento pertence ao Curso e ao Pedido

**Decisão de produto:** cada Curso pago deve definir preço, métodos permitidos e política
de cartão. Admin poderá oferecer Pix, cartão ou ambos; cartão à vista ou parcelado; e
limite máximo próprio. A oferta efetiva precisa ser copiada para o Pedido.

**Implementação atual:** preço, Pix, cartão e o teto de 1 a 12 parcelas são configuráveis
por Curso. O padrão de novos Cursos é Pix + cartão em até 3x. A oferta é copiada para o
Pedido e convertida em `billingTypes`, `chargeTypes` e
`installment.maxInstallmentCount` somente na borda Asaas. O item possui um único preço
para Pix, cartão à vista e cartão parcelado. A Vendedora absorve as taxas descontadas pelo
Asaas do recebível; a quantidade escolhida não altera o total pago pela Compradora.

O teto efetivo respeita o piso comercial aprovado de `1000` centavos por parcela,
equivalente ao preço mínimo de um Curso pago. O Asaas permite configurar na conta o valor
mínimo da cobrança e o valor mínimo por parcela; o ambiente usado pelo projeto mantém o
piso externo abaixo ou igual ao contrato interno. O Admin continua salvando o teto
desejado; preço baixo reduz apenas o snapshot do novo Pedido e a tela explica a redução.
Assim, o padrão comercial permanece 3x e um reajuste futuro pode tornar o teto configurado
efetivo sem reescrever compras anteriores.

Para cartão parcelado, `provider_installment_id` identifica o agregado e
`provider_payment_id` preserva a primeira cobrança observada. Antes da transação local, o
processor consulta `GET /v3/installments/{id}` e usa o bruto e o líquido do agregado na
decisão derivada; o payload original permanece na inbox. ID, Checkout, quantidade e valor
total devem coincidir com o snapshot. Eventos das demais parcelas são aceitos somente
quando mantêm o mesmo agregado. Conciliação lista todas as cobranças, e reembolso integral
usa `POST /v3/installments/{id}/refund`.

**Limitação do fornecedor:** o Checkout hospedado não aceita preço diferente por método
ou quantidade de parcelas e não documenta, por sessão, quem absorve o custo do
parcelamento. O Hub não apresenta uma opção fictícia “cliente/vendedor”; no contrato de
lançamento, o preço é único e a Vendedora absorve as taxas. O campo `interest` de outras
APIs é juros por atraso e não pode ser reutilizado para essa finalidade.

Ver [DEC-DISC-011](../decisions.md#dec-disc-011) e a
[pesquisa oficial](../reviews/2026-07-30-asaas-payment-configuration-research.md).

### REG-COM-010 Disponibilidade comercial não decide acesso adquirido

Estado de entrega, visibilidade de catálogo e estado de vendas são dimensões
independentes. Matrícula efetiva continua acessível quando vendas estão pausadas,
mesmo com o Curso oculto. Rascunho e Arquivado bloqueiam entrega; somente
Arquivado representa retirada histórica.

“Em breve” é visível, não vende e aceita Interesse de venda autenticado. Abrir
vendas enfileira um aviso por Interesse; fechar vendas bloqueia novos checkouts e
enfileira cancelamento dos Checkouts Asaas ativos. Pagamento confirmado antes do
cancelamento preserva a precedência financeira e concede acesso.

Ver [ADR-0009](../adr/0009-course-availability-and-sale-interest.md).

## Evidências

- schema: `orders`, `webhookEvents`, `paymentReviews`, `refundRequests`, `enrollmentGrants`, `enrollments`, `enrollmentExpirationAdjustments`, `enrollmentEvents`;
- implementação: `src/features/payments`, `src/features/enrollments/server.ts`;
- testes: `src/features/payments/*.test.ts`, `src/features/enrollments/*.test.ts`,
  `src/features/admin/enrollment-*.test.ts` e `tests/e2e/critical-journeys.spec.ts`;
- endpoints: `src/app/api/checkouts/course/route.ts`, `src/app/api/webhooks/asaas/route.ts`, `src/app/api/cron/enrollments/route.ts`.

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
- Adapter, schema, checkout, inbox, processor, worker agendado, reembolso e conciliação
  Asaas existem em código. As migrations e os fluxos PIX, cartão, cancelamento,
  expiração, reembolso, conciliação e retry após indisponibilidade passaram em
  PostgreSQL descartável e Sandbox antes do novo handoff. O Sandbox não emitiu eventos de risco na compra de
  cartão observada; esse ramo está coberto por testes automatizados. O corte comercial de
  Production aconteceu em 2026-08-21, após o deployment `177259f`, com credencial real
  e webhook ativo. A jornada pública nova passou no servidor Asaas fake, no E2E com
  PostgreSQL e em uma compra PIX Sandbox até a criação da senha, login e abertura do
  Curso.
