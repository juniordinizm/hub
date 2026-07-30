---
status: canonical
owner: engineering
last_verified_commit: 4b3c9b8a80b3bf3628b53c983dfd56d7ebec5b8d
---

# AbacatePay

## Responsabilidade

Criar produto/checkout de Curso, receber eventos financeiros e solicitar reembolso. O Hub é a fonte de autorização da experiência; AbacatePay é a fonte do evento financeiro externo.

Contrato oficial consultado: [Webhooks v2](https://docs.abacatepay.com/pages/webhooks), [referência de webhooks](https://docs.abacatepay.com/pages/webhooks/reference) e [listagem de produtos](https://docs.abacatepay.com/pages/products/list). Em 2026-07-27, a credencial configurada respondeu 200 a uma listagem de um produto, sem mutação. O endpoint Production recusou uma entrega sem segredo/assinatura com 401. O cadastro da URL no painel do provedor e uma entrega assinada ainda exigem conferência funcional.

## Configuração

- `ABACATE_PAY_API_KEY`: nome canônico da chave.
- `ABACATEPAY_API_KEY`: alias legado aceito; não configurar valores diferentes.
- `ABACATEPAY_API_BASE_URL`: default `https://api.abacatepay.com/v2`.
- `ABACATEPAY_WEBHOOK_SECRET`: segredo de webhook.
- `ABACATEPAY_WEBHOOK_ENABLED`: kill switch obrigatório em Production; aceita
  somente `true` ou `false`.
- `PAYMENTS_CHECKOUT_MODE`: controla checkout legado com `disabled`,
  `authenticated` ou `public`.
- `NEXT_PUBLIC_APP_URL`: URLs de retorno.

`createAbacatePayClient` resolve a chave; `AbacatePayClient` envia Bearer token somente no servidor.

### Development

Development usa uma API key devMode. O endpoint permanece
`https://api.abacatepay.com/v2`; o ambiente é determinado pela key. Para
webhooks locais, prefira a CLI oficial:

```powershell
abacatepay -l login
abacatepay -l listen --forward-to http://localhost:3000/api/webhooks/abacatepay
abacatepay -l trigger billing.paid
```

Não reutilize a key Production. O preflight local exige
`DEVELOPMENT_ABACATEPAY_DEV_MODE=true` como confirmação operacional, mas essa
flag não transforma uma key Production em Development; confira a origem no
painel e na CLI.

## Checkout

1. `createPublicCourseCheckout` aplica limite e normaliza identidade.
2. `createCourseCheckout` carrega Curso ativo e snapshots.
3. `createAbacatePayCourseProduct` cria produto externo quando necessário.
4. `AbacatePayClient.createCheckout` chama `/checkouts/create`.
5. Pedido `pending` persiste ID/URL externos e contrato vendido.

`PAYMENTS_CHECKOUT_MODE=disabled` bloqueia as entradas pública e autenticada;
`authenticated` mantém somente a entrada autenticada; `public` mantém ambas.
Production exige valor explícito. Preview normaliza `disabled`; Development e
test usam `public` quando a variável está ausente.

Não liberar acesso na página de sucesso. Somente evento financeiro processado pode criar Concessão.

## Webhook

Endpoint: `POST /api/webhooks/abacatepay`.

`route.ts` consulta `ABACATEPAY_WEBHOOK_ENABLED` antes de ler o corpo, validar
segredo/assinatura ou acessar processamento e banco. Quando a flag é `false`, o
endpoint responde `204` sem corpo; o 2xx reconhece a entrega sem provocar retries
do AbacatePay. Quando é `true`, a rota lê o corpo bruto antes de parsear, aceita
segredo em `webhookSecret` ou `x-webhook-secret` e assinatura em
`x-webhook-signature` ou `abacatepay-signature`. Em Production, ausência/erro de
segredo falha fechado. `verifyAbacatePaySignature` usa comparação segura.
Production exige a flag explícita; Preview normaliza `false`; Development e test
usam `true` quando ela está ausente.

O `webhookSecret` na query não é fallback legado: a documentação oficial
atual o define como uma das duas camadas, junto do HMAC. Por isso ele não pode
ser removido na migração de hospedagem. A observabilidade não deve registrar
query strings de webhook; aplique redação antes de habilitar logs desse
endpoint. Nunca copie a URL completa para logs, alertas ou tickets.

Fluxo:

1. consultar o kill switch e, quando desligado, responder `204` sem ler o body;
2. validar segredo e HMAC;
3. parsear payload tolerante a campos novos;
4. calcular chave externa;
5. registrar/deduplicar em `webhook_events`;
6. aplicar transição ou criar revisão;
7. projetar acesso;
8. responder 2xx após persistência.

A documentação oficial recomenda HTTPS, HMAC, registro de eventos e idempotência. O endpoint cadastrado no dashboard deve ser conferido antes do deploy.

## Sequência de contenção antes da limpeza

1. Configurar Production com `PAYMENTS_CHECKOUT_MODE=disabled` e
   `ABACATEPAY_WEBHOOK_ENABLED=false`.
2. Publicar a Release A compatível com o schema `0043`, sem migration e sem
   remover módulos AbacatePay. Checkout responde indisponível e o webhook
   reconhece entregas com `204`, sem processamento.
3. Confirmar a contenção e a ausência de novos Pedidos legados.
4. Executar o cleanup aprovado enquanto o banco ainda permanece no schema
   `0043`.
5. Na Release B, remover a rota e todo código executável AbacatePay ainda
   compatível com o schema `0043`.
6. Confirmar que não restou referência executável AbacatePay; somente então
   aplicar a migration `0044`.
7. Revogar credenciais AbacatePay e remover a configuração remota do webhook
   somente depois do smoke Asaas aprovado, conforme o contrato de cutover.

## Estados e exceções

- evento reconhecido e aplicável => `processed`;
- evento válido sem efeito => `ignored`;
- erro recuperável => `failed`, disponível a `retryFailedAbacatePayWebhook`;
- valor divergente => revisão `amount_mismatch`;
- estado terminal conflitante => revisão `terminal_conflict`.

Retry exige `retryWebhook`, capacidade exclusiva de Admin no RBAC atual.

## Reembolso

`requestFullRefund` exige confirmação recente de senha e `executeRefund`. A solicitação chama `/checkouts/refund` e guarda `refundPublicId`. Revogação de acesso deve ocorrer pelo evento confirmado, não pela mera intenção.

## Idempotência e concorrência

- `webhook_events` deduplica a entrega;
- Pedido usa identificadores externos únicos;
- transição terminal é decidida por regra explícita;
- e-mail não possui outbox e pode falhar depois do commit;
- reprocessar deve consultar estado persistido, não repetir efeitos cegamente.

## Diagnóstico

1. Localize o Pedido pelo ID externo.
2. Localize `webhook_events` pela chave/evento.
3. Compare `status`, `error_message` e payload armazenado.
4. Verifique `payment_reviews` e `refund_requests`.
5. Confirme Concessão e Matrícula.
6. Só então use retry autorizado.

Nunca cole chave, segredo, CPF/CNPJ ou payload integral em issue/log público.

## Evidências e decisões

- cliente: `AbacatePayClient` em `src/features/payments/abacatepay-client.ts`;
- regras: `src/features/payments/abacatepay.ts`;
- orquestração: `processAbacatePayWebhook`, `createCourseCheckout`, `resolvePaymentReview`;
- testes: `src/features/payments/*.test.ts`;
- domínio: [Comércio e acesso](../domain/commerce-and-access.md);
- decisão: [ADR-0005](../adr/0005-financial-precedence-and-manual-review.md).
