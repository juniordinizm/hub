---
status: accepted
owner: engineering
last_verified_commit: 1281924625070c4ca2c7a5ff3fb0bc170149e3ec
---

# Asaas Automatic Installment Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada Curso ofereca Pix e cartao em 1x-12x, com opcao de a Vendedora absorver todo o custo ou repassar automaticamente apenas o custo incremental do parcelamento, sem tabela manual de taxas e sem trafegar dados de cartao pelo Hub.

**Architecture:** O link publico estavel continua em `/comprar/[slug]`, mas passa a apresentar uma etapa minima de identidade e escolha de pagamento. O Hub consulta as taxas da conta, usa o simulador Asaas como oraculo de centavos, persiste uma cotacao imutavel e cria uma cobranca direta com quantidade e total fixos; a Fatura hospedada pelo Asaas coleta somente os dados do cartao ou conclui o Pix. Webhook, conciliacao, reembolso e acesso continuam subordinados a evidencia financeira autoritativa.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Drizzle schema/migrations, Vitest, Asaas API v3 (`myAccount/fees`, `payments/simulate`, `customers`, `payments` e Fatura hospedada).

---

## Decisoes incorporadas

- O Asaas nao oferece repasse de taxas por API, Checkout v3 ou Link de Pagamento criado por API. O recurso do painel nao sera tratado como dependencia da integracao.
- `maxInstallmentCount` limita a quantidade; nao recalcula o total conforme a escolha.
- O calculo sera automatico no Hub. Admin nao informa percentuais nem precisa atualiza-los quando a tabela comercial mudar.
- Politica padrao de novos Cursos: `buyer_pays_incremental_installment_cost`, Pix + cartao, ate 3x.
- Cursos existentes recebem `seller_absorbs_all` na migration para nao alterar silenciosamente ofertas ja publicadas; Admin pode ativar o repasse por Curso.
- Em 1x, a Vendedora absorve a taxa normal. Em 2x-12x, o total minimo deve preservar o liquido simulado de 1x.
- Antecipacao nao entra no calculo.
- Limite interno: cobranca minima de R$ 10 e parcela minima de R$ 10; teto absoluto de 12x.
- A API Asaas recebe apenas o total final. `value`, `installmentValue` e `totalValue` nao registram separadamente preco-base e acrescimo. Esses valores pertencem ao Pedido do Hub.
- A etapa de identidade coleta nome, e-mail e CPF/CNPJ antes da cobranca. CPF/CNPJ nao sera persistido em claro nem registrado em logs.
- Dados de cartao permanecem exclusivamente na Fatura Asaas.
- Reembolso integral devolve o total efetivamente pago, inclusive acrescimo.
- Cotacao expirada ou divergente nunca e atualizada silenciosamente depois da confirmacao da Compradora.
- O fluxo antigo de Checkout permanece legivel para Pedidos historicos; novas compras usam `provider_flow='invoice'`.

## Invariantes financeiros

```ts
type CourseCardPricingPolicy =
  | "seller_absorbs_all"
  | "buyer_pays_incremental_installment_cost";

type InstallmentQuote = {
  count: number;
  feeAmountInCents: number;
  feePercentageBasisPoints: number;
  grossAmountInCents: number;
  installmentAmountInCents: number;
  lastInstallmentAmountInCents: number;
  netAmountInCents: number;
  operationFeeInCents: number;
  surchargeAmountInCents: number;
};
```

- `orders.amount_in_cents` continua sendo o bruto final contratado e comparado com o provedor.
- `orders.base_amount_in_cents` preserva o preco do Curso antes do acrescimo.
- `orders.surcharge_amount_in_cents = amount_in_cents - base_amount_in_cents`.
- Para politica incremental e `count > 1`, `quoted_net_amount_in_cents >= target_net_amount_in_cents`, escolhendo o menor bruto que satisfaz a desigualdade.
- Para 1x, Pix ou `seller_absorbs_all`, `amount_in_cents = base_amount_in_cents` e `surcharge_amount_in_cents = 0`.
- O valor exibido, aceito e persistido nao muda se a taxa mudar depois. A diferenca posterior pertence ao resultado contabil da Vendedora.

## Task 0: Fechar os contratos Sandbox antes de alterar produto

**Files:**
- Modify: `docs/reviews/2026-08-03-asaas-automated-economic-pass-through-research.md`
- Modify: `docs/integrations/asaas.md`

- [ ] **Step 1: Confirmar a interface da Fatura parcelada**

Abrir no Sandbox a Fatura pendente criada com `installmentCount=3` e `totalValue=100.48`. Registrar que ela cobra o agregado em 3x e nao oferece 1x, 2x ou outro total.

- [ ] **Step 2: Confirmar liquidacao e eventos**

Pagar com cartao Sandbox aprovado e verificar:

```text
installment.value = 10048 centavos
installment.netValue = 9652 centavos
installment.installmentCount = 3
sum(payments.value) = 10048 centavos
externalReference = referencia opaca do Pedido
eventos correlacionam payment + installment sem checkoutSession
```

- [ ] **Step 3: Confirmar o piso**

Criar e pagar uma cobranca limite cuja parcela seja exatamente R$ 10,00. Repetir com R$ 9,99 e registrar a rejeicao do Asaas. Nenhum valor abaixo do piso deve virar fixture permanente.

- [ ] **Step 4: Confirmar vencimento da Fatura**

Criar uma cobranca com vencimento no dia seguinte, observar a Fatura antes e depois da virada de data e confirmar o evento/status resultante sem pagamento. O contrato do Hub sera: a cotacao expira antes da criacao; depois da cobranca, o bruto fica congelado e a Fatura pode ser paga ate o vencimento.

- [ ] **Step 5: Confirmar retorno por dominio**

Cadastrar `preview.neurocapacitar.com.br` nas Informacoes da conta Sandbox e repetir `callback.successUrl`. Validar redirecionamento somente depois de sucesso; webhook continua sendo a autoridade financeira.

- [ ] **Step 6: Atualizar a evidencia documental**

Marcar cada prova no relatorio, incluindo IDs tecnicos sem API key, CPF/CNPJ, e-mail ou URL publica de Fatura.

- [ ] **Step 7: Verificar documentacao**

Run: `bun run docs:check`

Expected: `Documentacao valida` e zero erro.

## Task 1: Modelar a politica e o calculo em centavos

**Files:**
- Create: `src/features/payments/installment-pricing.ts`
- Create: `src/features/payments/installment-pricing.test.ts`
- Modify: `src/features/payments/course-payment-offer.ts`
- Modify: `src/features/payments/course-payment-offer.test.ts`

- [ ] **Step 1: Escrever testes RED da politica**

```ts
it("preserves the 1x net when the buyer pays incremental installment cost", () => {
  expect(
    chooseMinimumGrossAmount({
      candidates: [10_047, 10_048, 10_049],
      netByGrossAmount: new Map([
        [10_047, 9651],
        [10_048, 9652],
        [10_049, 9653],
      ]),
      targetNetAmountInCents: 9652,
    })
  ).toBe(10_048);
});

it("never adds a surcharge to 1x or seller-absorbed installments", () => {
  expect(resolveContractedAmount({ baseAmountInCents: 10_000, count: 1,
    policy: "buyer_pays_incremental_installment_cost", quotedGrossAmountInCents: 10_410 })).toBe(10_000);
  expect(resolveContractedAmount({ baseAmountInCents: 10_000, count: 6,
    policy: "seller_absorbs_all", quotedGrossAmountInCents: 10_410 })).toBe(10_000);
});
```

- [ ] **Step 2: Executar o teste e observar a falha esperada**

Run: `bun test src/features/payments/installment-pricing.test.ts`

Expected: FAIL por exports ausentes.

- [ ] **Step 3: Implementar tipos e invariantes puros**

```ts
export const COURSE_CARD_PRICING_POLICIES = [
  "seller_absorbs_all",
  "buyer_pays_incremental_installment_cost",
] as const;
export type CourseCardPricingPolicy =
  (typeof COURSE_CARD_PRICING_POLICIES)[number];

export const resolveSurchargeAmount = (
  baseAmountInCents: number,
  grossAmountInCents: number
): number => Math.max(0, grossAmountInCents - baseAmountInCents);
```

Implementar `chooseMinimumGrossAmount`, validacao de centavos inteiros, monotonicidade e piso por parcela. Nao implementar formula financeira em `number` decimal; converter respostas do Asaas para centavos na borda.

- [ ] **Step 4: Estender a oferta do Curso**

```ts
export interface CoursePaymentOffer {
  allowCreditCard: boolean;
  allowPix: boolean;
  cardPricingPolicy: CourseCardPricingPolicy;
  maxInstallmentCount: number;
}

export const DEFAULT_COURSE_PAYMENT_OFFER = {
  allowCreditCard: true,
  allowPix: true,
  cardPricingPolicy: "buyer_pays_incremental_installment_cost",
  maxInstallmentCount: 3,
} satisfies CoursePaymentOffer;
```

Substituir o uso universal de `getEffectiveMaxInstallmentCount` por candidatos de 1 ate o teto configurado. Para `seller_absorbs_all`, filtrar pelo preco-base; para a politica incremental, filtrar somente depois de conhecer o total e a distribuicao final da cotacao.

- [ ] **Step 5: Executar testes focados**

Run: `bun test src/features/payments/installment-pricing.test.ts src/features/payments/course-payment-offer.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit da unidade pura**

Run somente quando a execucao com commits estiver autorizada:

```bash
git add src/features/payments/installment-pricing.ts src/features/payments/installment-pricing.test.ts src/features/payments/course-payment-offer.ts src/features/payments/course-payment-offer.test.ts
git commit -m "feat(payments): model installment pricing policy"
```

## Task 2: Ampliar o adapter Asaas sem vazar DTOs

**Files:**
- Modify: `src/features/payments/asaas.ts`
- Modify: `src/features/payments/asaas-client.ts`
- Modify: `src/features/payments/asaas-client.test.ts`
- Modify: `src/features/payments/fake-asaas-gateway.ts`
- Modify: `src/features/payments/fake-asaas-gateway.test.ts`

- [ ] **Step 1: Escrever testes RED de taxas, simulacao, cliente e cobranca**

Cobrir resposta valida, campos ausentes, valores nao finitos, 400 rejeitado, timeout desconhecido, `invoiceUrl` invalida e conversao decimal-centavos.

```ts
await gateway.simulatePayment({
  billingType: "CREDIT_CARD",
  installmentCount: 3,
  valueInCents: 10_048,
});
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining("/v3/payments/simulate"),
  expect.objectContaining({ method: "POST" })
);
```

- [ ] **Step 2: Executar o teste e confirmar falha de contrato ausente**

Run: `bun test src/features/payments/asaas-client.test.ts src/features/payments/fake-asaas-gateway.test.ts`

Expected: FAIL por metodos ausentes.

- [ ] **Step 3: Definir portas estreitas**

```ts
export interface AsaasPaymentSimulation {
  feePercentageBasisPoints: number;
  installmentAmountInCents: number;
  netAmountInCents: number;
  operationFeeInCents: number;
}

export interface CreateAsaasPayment {
  billingType: "PIX" | "CREDIT_CARD";
  callback?: { autoRedirect: boolean; successUrl: string };
  customerId: string;
  description: string;
  dueDate: string;
  externalReference: string;
  installmentCount: number;
  totalAmountInCents: number;
}

export interface CreatedAsaasPayment {
  id: string;
  installmentId: string | null;
  invoiceUrl: string;
  status: string;
}
```

Adicionar ao `AsaasGateway`: `getAccountFees`, `simulatePayment`, `listCustomers`, `createCustomer` e `createPayment`. Cartao, endereco e CVV nao pertencem a essas interfaces.

- [ ] **Step 4: Implementar payload de cobranca**

Para 1x/Pix, enviar somente `value`. Para `installmentCount >= 2`, omitir `value` e enviar
`installmentCount` + `totalValue` com o bruto final. Nunca usar `interest`, pois esse campo
representa juros de mora.

- [ ] **Step 5: Validar URL hospedada**

Aceitar HTTPS somente nos hosts exatos `sandbox.asaas.com`, `www.asaas.com` ou `asaas.com`. Reusar a politica existente de navegacao e rejeitar credenciais, porta ou host semelhante.

- [ ] **Step 6: Executar testes**

Run: `bun test src/features/payments/asaas-client.test.ts src/features/payments/fake-asaas-gateway.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit do adapter**

```bash
git add src/features/payments/asaas.ts src/features/payments/asaas-client.ts src/features/payments/asaas-client.test.ts src/features/payments/fake-asaas-gateway.ts src/features/payments/fake-asaas-gateway.test.ts
git commit -m "feat(payments): add Asaas pricing and invoice contracts"
```

## Task 3: Persistir politica, cotacao e snapshots financeiros

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0056_asaas_installment_pricing.sql`
- Modify: `src/db/migrations/meta/_journal.json`
- Create: `src/db/migrations/meta/0056_snapshot.json`
- Modify: schema and migration tests matched by `src/db/**/*.test.ts`

- [ ] **Step 1: Escrever teste RED do contrato de schema**

Provar checks, defaults e indices:

```text
courses.payment_card_pricing_policy default buyer_pays_incremental_installment_cost
orders.base_amount_in_cents >= 0
orders.surcharge_amount_in_cents >= 0
orders.amount_in_cents = base_amount_in_cents + surcharge_amount_in_cents
orders.installment_count between 1 and 12
course_payment_quotes expires_at > created_at
asaas_customer_mappings unique(provider, identity_fingerprint, normalized_email)
```

- [ ] **Step 2: Executar teste e confirmar falha**

Run: `bun test src/db`

Expected: FAIL por colunas/tabelas ausentes.

- [ ] **Step 3: Adicionar schema**

```ts
export const courseCardPricingPolicyEnum = pgEnum(
  "course_card_pricing_policy",
  ["seller_absorbs_all", "buyer_pays_incremental_installment_cost"]
);

export const providerPurchaseFlowEnum = pgEnum("provider_purchase_flow", [
  "checkout",
  "invoice",
]);
```

Adicionar `paymentCardPricingPolicy` em Cursos. Adicionar ao Pedido: `providerPurchaseFlow`, `paymentQuoteId`, `baseAmountInCents`, `surchargeAmountInCents`, `installmentCount`, `cardPricingPolicy`, `targetNetAmountInCents`, `quotedNetAmountInCents`, `quotedFeeAmountInCents`, `quotedFeePercentageBasisPoints`, `quotedOperationFeeInCents` e `quotedAt`.

- [ ] **Step 4: Criar tabelas de cotacao e cliente**

`course_payment_quotes` guarda assinatura da oferta, politica, base, opcoes JSON validadas, perfil de taxas JSON, geracao e expiracao. `asaas_customer_mappings` guarda somente HMAC de identidade, e-mail normalizado, ID externo opaco, provider customer ID e estado `pending|creating|ready|uncertain|failed`; nunca CPF/CNPJ em claro.

- [ ] **Step 5: Gerar migration pelo comando oficial**

Run: `bun run db:generate`

Expected: migration `0056` e snapshot coerente, sem DDL destrutivo.

- [ ] **Step 6: Ajustar backfill seguro**

Na migration, novos Cursos usam o default incremental; Cursos existentes sao atualizados explicitamente para `seller_absorbs_all`. Pedidos existentes recebem `provider_purchase_flow='checkout'`, `base_amount_in_cents=amount_in_cents`, `surcharge_amount_in_cents=0` e `installment_count=1` quando o agregado historico nao permite inferencia segura.

- [ ] **Step 7: Validar migration**

Run: `bun run db:migrations:check`

Expected: hashes, journal e schema validos.

- [ ] **Step 8: Commit da persistencia**

```bash
git add src/db/schema.ts src/db/migrations
git commit -m "feat(payments): persist installment pricing snapshots"
```

## Task 4: Construir o servico de cotacao automatica

**Files:**
- Create: `src/features/payments/payment-quotes.ts`
- Create: `src/features/payments/payment-quotes.test.ts`
- Create: `src/features/payments/payment-quotes.integration.test.ts`

- [ ] **Step 1: Escrever testes RED do exemplo real**

```ts
it("quotes the verified Sandbox amounts for a R$100 incremental offer", async () => {
  const quote = await createCoursePaymentQuote(fixtureDependencies);
  expect(quote.cardOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ count: 1, grossAmountInCents: 10_000, surchargeAmountInCents: 0 }),
      expect.objectContaining({ count: 2, grossAmountInCents: 10_050, surchargeAmountInCents: 50 }),
      expect.objectContaining({ count: 3, grossAmountInCents: 10_048, surchargeAmountInCents: 48 }),
      expect.objectContaining({ count: 12, grossAmountInCents: 10_096, surchargeAmountInCents: 96 }),
    ])
  );
});
```

Adicionar testes de `seller_absorbs_all`, Pix, promocao expirada, resposta parcial, simulador indisponivel, piso R$ 10, teto 12x, cache por assinatura e concorrencia.

- [ ] **Step 2: Confirmar falha inicial**

Run: `bun test src/features/payments/payment-quotes.test.ts`

Expected: FAIL por servico ausente.

- [ ] **Step 3: Implementar assinatura e TTL**

```ts
type QuoteSignatureInput = {
  allowCreditCard: boolean;
  allowPix: boolean;
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  courseId: string;
  maxInstallmentCount: number;
  providerEnvironment: "sandbox" | "production";
};

const QUOTE_TTL_MS = 30 * 60 * 1000;
```

Usar assinatura deterministica e cache PostgreSQL compartilhado entre Functions. Limitar a expiracao ao menor valor entre TTL e `discountExpiration`. Coordenar regeneracao por lock transacional curto; nenhuma chamada Asaas dentro do lock.

- [ ] **Step 4: Implementar cotacao incremental**

Simular preco-base em 1x para obter `targetNet`. Usar taxas atuais apenas como seed do gross-up, simular cada quantidade permitida e ajustar centavos ate encontrar o menor bruto com `net >= targetNet`. Calcular a distribuicao documentada pelo Asaas, com diferenca de centavos na ultima parcela, e aceitar somente opcoes em que todas as parcelas sejam de pelo menos 1000 centavos.

- [ ] **Step 5: Implementar degradacao segura**

Se taxas/simulador falharem, retornar Pix e cartao 1x pelo preco-base quando permitidos, com `installmentsTemporarilyUnavailable=true`. Nao reutilizar cotacao expirada silenciosamente e nao inventar percentual.

- [ ] **Step 6: Implementar revalidacao da escolha**

`revalidateSelectedQuote` simula somente a opcao escolhida. Se o menor bruto mudou, retornar `stale` e gerar nova cotacao; nao criar Pedido nem cobrar com valor diferente do exibido.

- [ ] **Step 7: Executar testes unitarios e PostgreSQL**

Run: `bun test src/features/payments/payment-quotes.test.ts`

Run: `bun test --config vitest.integration.config.ts src/features/payments/payment-quotes.integration.test.ts`

Expected: PASS; duas regeneracoes concorrentes publicam uma unica cotacao ativa.

- [ ] **Step 8: Commit do motor de cotacao**

```bash
git add src/features/payments/payment-quotes.ts src/features/payments/payment-quotes.test.ts src/features/payments/payment-quotes.integration.test.ts
git commit -m "feat(payments): quote automatic installment pricing"
```

## Task 5: Expor a politica na configuracao do Curso

**Files:**
- Modify: `src/features/admin/authoring.ts`
- Modify: authoring tests under `src/features/admin/`
- Modify: `src/features/admin/server.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx`

- [ ] **Step 1: Escrever testes RED do formulario e parser**

Provar que Admin salva apenas valores conhecidos; Curso sem cartao normaliza politica para `seller_absorbs_all`; novos Cursos recebem incremental; maximo permanece 12.

```tsx
expect(markup).toContain('name="paymentCardPricingPolicy"');
expect(markup).toContain("Cliente paga somente o acrescimo do parcelamento");
expect(markup).toContain('max="12"');
```

- [ ] **Step 2: Rodar testes e confirmar falha**

Run: `bun test src/features/admin src/app/\(admin\)/admin/cursos/\[courseId\]/course-dialogs-client.test.tsx`

Expected: FAIL por campo ausente.

- [ ] **Step 3: Implementar parser e persistencia**

Aceitar somente `seller_absorbs_all` e `buyer_pays_incremental_installment_cost`. Atualizar inserts, updates, retorno administrativo e fixtures.

- [ ] **Step 4: Implementar linguagem correta na UI**

Usar “parcelamento sem acrescimo” e “cliente paga somente o acrescimo das parcelas”. Nao usar “juros de mora”, “taxa Asaas exata” ou prometer valor antes da cotacao. Explicar que 1x permanece sem acrescimo e que as taxas sao lidas automaticamente.

- [ ] **Step 5: Executar testes focados**

Run: `bun test src/features/admin src/app/\(admin\)/admin/cursos/\[courseId\]/course-dialogs-client.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit da configuracao**

```bash
git add src/features/admin src/app/\(admin\)/admin/cursos/\[courseId\]/course-dialogs-client.tsx src/app/\(admin\)/admin/cursos/\[courseId\]/course-dialogs-client.test.tsx
git commit -m "feat(admin): configure card pricing per course"
```

## Task 6: Criar contrato publico de cotacao e identidade

**Files:**
- Create: `src/features/payments/public-purchase-api.ts`
- Create: `src/features/payments/public-purchase-api.test.ts`
- Create: `src/app/api/purchases/course/quote/route.ts`
- Create: `src/app/api/purchases/course/quote/route.test.ts`
- Modify: `src/features/payments/buyer-identity.ts`
- Modify: `src/features/payments/buyer-identity.test.ts`

- [ ] **Step 1: Escrever testes RED do input estrito**

```ts
type PublicPurchaseBody = {
  courseSlug: string;
  cpfCnpj: string;
  email: string;
  installmentCount: number;
  name: string;
  paymentMethod: "pix" | "credit_card";
  purchaseAttemptId: string;
  quoteId: string;
};
```

Rejeitar chaves extras, prototipos anormais, CPF/CNPJ invalido, e-mail invalido, parcela decimal, Pix com parcela diferente de 1 e escolha fora da cotacao.

- [ ] **Step 2: Confirmar falha inicial**

Run: `bun test src/features/payments/public-purchase-api.test.ts src/app/api/purchases/course/quote/route.test.ts`

Expected: FAIL por parser/route ausentes.

- [ ] **Step 3: Implementar endpoint de cotacao**

`GET /api/purchases/course/quote?courseSlug=...` retorna somente preco, metodos, opcoes, expiracao e `quoteId`; nunca taxas internas completas, PII ou resposta bruta do Asaas. Aplicar `Cache-Control: no-store`, limite por IP/Curso e observabilidade sem cardinalidade de comprador.

- [ ] **Step 4: Implementar validacao de identidade**

Normalizar nome/e-mail e validar digitos verificadores de CPF/CNPJ. A funcao retorna o documento apenas em memoria. Criar `identityFingerprint = HMAC(BETTER_AUTH_SECRET, "asaas-customer:v1:" + digits + ":" + normalizedEmail)` com separacao de dominio e nunca logar input, hash cru ou payload Asaas.

- [ ] **Step 5: Executar testes**

Run: `bun test src/features/payments/public-purchase-api.test.ts src/app/api/purchases/course/quote/route.test.ts src/features/payments/buyer-identity.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit do contrato publico**

```bash
git add src/features/payments/public-purchase-api.ts src/features/payments/public-purchase-api.test.ts src/features/payments/buyer-identity.ts src/features/payments/buyer-identity.test.ts src/app/api/purchases/course/quote
git commit -m "feat(payments): expose safe public purchase quotes"
```

## Task 7: Resolver cliente Asaas de forma idempotente

**Files:**
- Create: `src/features/payments/asaas-customer-resolution.ts`
- Create: `src/features/payments/asaas-customer-resolution.test.ts`
- Create: `src/features/payments/asaas-customer-resolution.integration.test.ts`

- [ ] **Step 1: Escrever testes RED de concorrencia e timeout**

Cobrir cliente mapeado, mapeamento inexistente, duas compras concorrentes, timeout apos criacao, consulta por `externalReference`, resposta duplicada e conflito de e-mail.

```ts
expect(createdCustomer.externalReference).toMatch(/^buyer_[0-9a-f-]{36}$/);
expect(JSON.stringify(databaseWrites)).not.toContain("39052900060");
```

- [ ] **Step 2: Confirmar falha inicial**

Run: `bun test src/features/payments/asaas-customer-resolution.test.ts`

Expected: FAIL por resolvedor ausente.

- [ ] **Step 3: Implementar maquina de estado**

Reservar o mapeamento local antes da mutacao externa. Usar CAS `pending -> creating -> ready`; timeout vira `uncertain`. Antes de repetir `createCustomer`, consultar por `externalReference`. Zero resultados permite retry controlado; um resultado exato converge; mais de um falha fechado e abre sinal operacional.

- [ ] **Step 4: Bloquear identidades inelegiveis antes da cobranca**

Com o e-mail agora disponivel, recusar Admin, Suporte, Conta bloqueada e acesso revogado antes de criar cliente/cobranca. Manter a verificacao pos-pagamento para corridas e alteracoes posteriores.

- [ ] **Step 5: Executar testes unitarios e de concorrencia PostgreSQL**

Run: `bun test src/features/payments/asaas-customer-resolution.test.ts`

Run: `bun test --config vitest.integration.config.ts src/features/payments/asaas-customer-resolution.integration.test.ts`

Expected: PASS e no maximo um `createCustomer` por identidade concorrente.

- [ ] **Step 6: Commit do resolvedor**

```bash
git add src/features/payments/asaas-customer-resolution.ts src/features/payments/asaas-customer-resolution.test.ts src/features/payments/asaas-customer-resolution.integration.test.ts
git commit -m "feat(payments): resolve Asaas customers idempotently"
```

## Task 8: Criar Pedido e Fatura com recuperacao de resultado incerto

**Files:**
- Create: `src/features/payments/invoice-intent.ts`
- Create: `src/features/payments/invoice-intent.test.ts`
- Create: `src/features/payments/invoice-recovery.ts`
- Create: `src/features/payments/invoice-recovery.test.ts`
- Create: `src/app/api/purchases/course/route.ts`
- Create: `src/app/api/purchases/course/route.test.ts`

- [ ] **Step 1: Escrever testes RED do fluxo feliz e das falhas**

Provar ordem: validar -> autorizar -> revalidar cotacao -> inserir Pedido -> resolver cliente -> criar cobranca -> persistir IDs/URL. Cobrir rejeicao conhecida, timeout, sucesso com falha no update, retry da mesma tentativa e tentativa conflitante.

- [ ] **Step 2: Confirmar falha inicial**

Run: `bun test src/features/payments/invoice-intent.test.ts src/features/payments/invoice-recovery.test.ts src/app/api/purchases/course/route.test.ts`

Expected: FAIL por fluxo ausente.

- [ ] **Step 3: Implementar snapshot antes dos efeitos**

```ts
type InvoiceIntentSnapshot = {
  amountInCents: number;
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  installmentCount: number;
  paymentMethod: "pix" | "credit_card";
  quoteId: string;
  surchargeAmountInCents: number;
  targetNetAmountInCents: number | null;
};
```

Persistir nome/e-mail e snapshots; nao persistir documento. `externalReference` permanece `order_<uuid>`.

- [ ] **Step 4: Criar a cobranca fora de transacao longa**

Usar `billingType=PIX` ou `CREDIT_CARD`. Para cartao 2x+, enviar quantidade e bruto final fixos. Definir `dueDate` como o dia seguinte no calendario de `America/Sao_Paulo`, evitando cobranca criada perto da meia-noite com vencimento imediato. Incluir callback somente com `ASAAS_PAYMENT_RETURN_ENABLED=true`; o ambiente deve ter o mesmo dominio de `NEXT_PUBLIC_APP_URL` cadastrado no Asaas. Persistir `provider_payment_id`, `provider_installment_id`, `provider_customer_id` e a URL de Fatura em `checkout_url` por CAS. A documentacao passa a definir `checkout_url` como URL hospedada de pagamento do provedor; para Pedidos legados ela continua contendo o Checkout v3.

- [ ] **Step 5: Implementar recuperacao**

Em resultado desconhecido, marcar `uncertain` e consultar `listPayments({ externalReference })`. Um unico pagamento com valor, cliente, metodo e parcelamento exatos converge; zero permanece retryable; multiplos ou divergentes abrem Revisao e nunca criam nova cobranca automaticamente.

- [ ] **Step 6: Implementar leitura de recuperacao**

`GET /api/purchases/course?purchaseAttemptId=...&courseSlug=...` reutiliza o mesmo contrato opaco do fluxo antigo e retorna apenas `processing`, `ready`, `failed` ou `unavailable`; URL somente para Pedido e tentativa exatamente correspondentes. A resposta usa `Cache-Control: no-store` e nunca inclui PII, valores internos ou estado bruto do Asaas.

- [ ] **Step 7: Executar testes**

Run: `bun test src/features/payments/invoice-intent.test.ts src/features/payments/invoice-recovery.test.ts src/app/api/purchases/course/route.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit da orquestracao**

```bash
git add src/features/payments/invoice-intent.ts src/features/payments/invoice-intent.test.ts src/features/payments/invoice-recovery.ts src/features/payments/invoice-recovery.test.ts src/app/api/purchases/course
git commit -m "feat(payments): create fixed-price Asaas invoices"
```

## Task 9: Substituir o handoff automatico por uma etapa minima acessivel

**Files:**
- Modify: `src/app/comprar/[slug]/page.tsx`
- Create: `src/app/comprar/[slug]/purchase-form-client.tsx`
- Create: `src/app/comprar/[slug]/purchase-form-client.test.tsx`
- Modify: `src/app/comprar/[slug]/page.test.tsx`
- Reuse: `src/app/comprar/[slug]/checkout-navigation.ts`
- Modify: `src/app/(student)/app/(dashboard)/page.tsx`
- Modify: matching dashboard page tests
- Modify: `src/features/payments/actions.ts`
- Modify: `src/features/payments/actions.test.ts`

- [ ] **Step 1: Escrever testes RED da jornada**

Provar rotulos, erros associados, navegacao por teclado, selecao Pix/cartao, parcelas, total, acrescimo, expiracao de cotacao, submit unico e ausencia de campos de cartao.

```tsx
expect(markup).toContain('name="cpfCnpj"');
expect(markup).toContain("2 parcelas de R$ 33,49 e a ultima de R$ 33,50");
expect(markup).toContain("Total R$ 100,48");
expect(markup).not.toContain('name="cardNumber"');
```

- [ ] **Step 2: Confirmar falha inicial**

Run: `bun test src/app/comprar/\[slug\]/purchase-form-client.test.tsx src/app/comprar/\[slug\]/page.test.tsx`

Expected: FAIL por componente ausente.

- [ ] **Step 3: Implementar a pagina unica**

O CTA externo continua apontando diretamente para `/comprar/[slug]`; nao criar outra landing ou pagina intermediaria. A mesma pagina carrega cotacao e solicita nome, e-mail, CPF/CNPJ, metodo e parcelas de visitantes. Para Conta Student, usar nome/e-mail imutaveis da sessao e solicitar apenas o documento ausente e a escolha financeira; gifting permanece fora do escopo.

- [ ] **Step 4: Exibir preco de forma transparente**

Para cada opcao, mostrar quantidade, parcelas regulares, eventual diferenca da ultima parcela, `total R$ Y` e `acrescimo R$ Z` quando houver. Por exemplo: `2 parcelas de R$ 33,49 e a ultima de R$ 33,50; total R$ 100,48`. Em 1x mostrar `sem acrescimo`. Nunca esconder que totais podem variar por quantidade.

- [ ] **Step 5: Preservar idempotencia no navegador**

Armazenar `purchaseAttemptId` opaco por Curso, desabilitar submit enquanto pendente, recuperar estado `processing` por GET e nunca substituir tentativa automaticamente depois de timeout.

- [ ] **Step 6: Unificar a entrada autenticada**

Substituir o formulario que chama `startCourseCheckoutAction` no dashboard por link para `/comprar/[slug]`. A pagina reconhece a sessao Student e usa a mesma cotacao/Fatura; depois de confirmar ausencia de referencias, remover a action de criacao de Checkout, preservando somente actions financeiras ainda usadas.

- [ ] **Step 7: Executar testes de UI**

Run: `bun test src/app/comprar/\[slug\]`

Expected: PASS.

- [ ] **Step 8: Commit da jornada**

```bash
git add src/app/comprar/\[slug\]
git commit -m "feat(payments): collect purchase choice before Asaas invoice"
```

## Task 10: Adaptar webhook, conciliacao, identidade e reembolso

**Files:**
- Modify: `src/features/payments/asaas-webhook-processor.ts`
- Modify: `src/features/payments/asaas-webhook-processor.test.ts`
- Modify: `src/features/payments/reconciliation.ts`
- Modify: `src/features/payments/reconciliation.test.ts`
- Modify: `src/features/payments/apply-authoritative-financial-evidence.ts`
- Modify: `src/features/payments/apply-authoritative-financial-evidence.test.ts`
- Modify: `src/features/payments/refunds.ts`
- Modify: `src/features/payments/refunds.test.ts`
- Modify: `src/features/payments/asaas-customer-enrichment.ts`
- Modify: `src/features/payments/asaas-customer-enrichment.test.ts`

- [ ] **Step 1: Escrever caracterizacao e novos testes RED**

Manter todos os cenarios de Checkout historico. Adicionar Fatura Pix, Fatura cartao 1x, agregado parcelado, evento antes de persistir resposta, valor com acrescimo, reembolso integral e identidade local pre-coletada.

- [ ] **Step 2: Confirmar falha somente nos cenarios novos**

Run: `bun test src/features/payments/asaas-webhook-processor.test.ts src/features/payments/reconciliation.test.ts src/features/payments/apply-authoritative-financial-evidence.test.ts src/features/payments/refunds.test.ts`

Expected: historicos PASS; novos FAIL.

- [ ] **Step 3: Correlacionar por fluxo**

Para `provider_purchase_flow='invoice'`, exigir `externalReference`, IDs do payment/installment, cliente e bruto final. `checkoutSession` pode ser nulo. Para legado `checkout`, manter a matriz atual sem afrouxar correlacao.

- [ ] **Step 4: Preservar semantica financeira**

Comparar o agregado Asaas com `orders.amount_in_cents`, nao com preco-base. Persistir líquido/taxa reais separadamente dos valores cotados. Divergencia abre `amount_mismatch` sem acesso.

- [ ] **Step 5: Resolver identidade sem confiar no retorno de navegacao**

Usar nome/e-mail write-once do Pedido e confirmar o `provider_customer_id`. Colisao Admin/Suporte/bloqueio/revogacao continua sem acesso e segue para reembolso, mesmo que a verificacao pre-cobranca tenha sofrido corrida.

- [ ] **Step 6: Reembolsar o total bruto**

Cartao parcelado usa refund do `installment`; Pix/1x usa refund do payment. Evidencia deve somar exatamente `amount_in_cents`, incluindo `surcharge_amount_in_cents`.

- [ ] **Step 7: Executar suite financeira**

Run: `bun test src/features/payments`

Expected: PASS para legado e Fatura.

- [ ] **Step 8: Commit da convergencia financeira**

```bash
git add src/features/payments
git commit -m "feat(payments): reconcile invoice-based course purchases"
```

## Task 11: Observabilidade, Admin financeiro e privacidade

**Files:**
- Modify: `src/features/admin/server.ts`
- Modify: Admin financial UI/tests under `src/app/(admin)/admin/financeiro/`
- Modify: payment observability modules/tests under `src/features/payments/`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`

- [ ] **Step 1: Escrever testes RED de exibicao financeira**

Admin deve ver preco-base, acrescimo, bruto, parcelas, líquido cotado, líquido real, politica, expiracao da cotacao e flow. Suporte continua somente leitura e nao altera estado financeiro/acesso.

- [ ] **Step 2: Escrever testes RED de seguranca**

Provar que logs, observabilidade, revisoes e respostas HTTP nao contem CPF/CNPJ, API key ou payload de cliente. Provar que `ASAAS_PAYMENT_RETURN_ENABLED=true` exige URL do ambiente HTTPS.

- [ ] **Step 3: Implementar apresentacao e sinais**

Adicionar sinais para cotacao indisponivel, cotacao divergente, cliente incerto, cobranca incerta e callback desabilitado. Nao usar nome/e-mail como labels de metrica.

- [ ] **Step 4: Executar testes**

Run: `bun test src/features/admin src/app/\(admin\)/admin/financeiro src/lib/env.test.ts src/features/payments`

Expected: PASS.

- [ ] **Step 5: Commit da operacao**

```bash
git add src/features/admin src/app/\(admin\)/admin/financeiro src/lib/env.ts src/lib/env.test.ts src/features/payments
git commit -m "feat(payments): expose installment pricing operations"
```

## Task 12: Atualizar contratos canonicos e runbooks

**Files:**
- Modify: `PRODUCT.md`
- Modify: `docs/domain/commerce-and-access.md`
- Modify: `docs/decisions.md`
- Create: `docs/adr/0009-automatic-installment-pricing-and-invoice-flow.md`
- Modify: `docs/integrations/asaas.md`
- Modify: `docs/operations/observability-and-recovery.md`
- Modify: matching environment/release runbook under `docs/operations/`
- Modify: `docs/README.md`

- [ ] **Step 1: Registrar a decisao arquitetural**

ADR-0009 deve registrar alternativas rejeitadas: tabela manual, Checkout fixo com `maxInstallmentCount`, Link por quantidade e coleta direta de cartao. Explicar que “automatico” significa calculado pelo Hub a partir da conta, nao ativado nativamente no Asaas.

- [ ] **Step 2: Atualizar a regra de negocio**

Documentar as duas politicas por Curso, default incremental para novos Cursos, preservacao de legado, piso, 12x, transparencia de preco, snapshot e reembolso do bruto.

- [ ] **Step 3: Atualizar integracao e operacao**

Documentar endpoints, TTL, quota, falha segura, customer mapping, fluxo incerto, callback por dominio, Sandbox/Staging e procedimento de conciliacao.

- [ ] **Step 4: Verificar documentacao**

Run: `bun run docs:check`

Expected: todos os documentos canonicos validos e ADR indexada.

- [ ] **Step 5: Commit documental**

```bash
git add PRODUCT.md docs
git commit -m "docs(payments): define automatic installment pricing"
```

## Task 13: Homologar integralmente antes de promover

**Files:**
- Modify: `tests/e2e/critical-journeys.spec.ts`
- Modify: relevant E2E fixtures/seeds under `tests/` and `scripts/`
- Modify: this plan with evidence and completed checkboxes

- [ ] **Step 1: Criar E2E local deterministico**

Cobrir Curso seller-absorbed, incremental, Pix, 1x, 3x, 12x, parcela de R$ 10, cotacao expirada, retry idempotente, identidade bloqueada, pagamento confirmado e reembolso integral.

- [ ] **Step 2: Executar verificacao focada**

Run: `bun test src/features/payments src/app/api/purchases src/app/comprar/\[slug\] src/features/admin`

Expected: PASS.

- [ ] **Step 3: Executar gates globais**

Run: `bun x ultracite fix`

Run: `bun run verify:quick`

Run: `bun run db:migrations:check`

Run: `bun run docs:check`

Expected: formatacao limpa, typecheck, migrations e todos os testes PASS.

- [ ] **Step 4: Aplicar migration somente nos ambientes autorizados**

Aplicar primeiro em banco descartavel, depois Development e Staging. Comparar journal/hash/objetos. Production somente apos homologacao manual e autorizacao explicita.

- [ ] **Step 5: Homologar no Sandbox por Staging**

Executar compras reais de teste em Pix, cartao 1x, 3x e 12x. Confirmar total exibido, total Asaas, líquido, webhook, acesso, callback, extrato e reembolso. Verificar que nenhum fluxo solicita cartao no Hub.

- [ ] **Step 6: Auditar regressao de Pedidos historicos**

Conciliar ao menos um Pedido Checkout legado e provar que consulta, acesso e reembolso continuam funcionando com `provider_purchase_flow='checkout'`.

- [ ] **Step 7: Registrar evidencia final**

Atualizar este plano com arquivos alterados, comandos, contagens, hashes de migration, IDs Sandbox nao sensiveis e riscos residuais. Nao marcar concluido antes de toda evidencia.

## Cenarios de aceitacao obrigatorios

1. Admin escolhe por Curso entre parcelamento sem acrescimo e repasse incremental automatico.
2. Admin nunca informa percentuais de taxa.
3. Nova taxa/promocao da conta aparece apos o TTL sem deploy ou edicao manual.
4. 1x nunca recebe acrescimo na politica incremental.
5. 2x-12x preservam pelo menos o liquido simulado de 1x usando o menor bruto validado.
6. Parcela inferior a R$ 10 nunca e oferecida nem criada.
7. O valor aceito pela Compradora permanece imutavel no Pedido.
8. Preco-base, acrescimo e bruto final aparecem separadamente no Admin e na auditoria.
9. O Asaas recebe o bruto final; nenhum campo do provedor e tratado como snapshot de preco-base.
10. Nome, e-mail e CPF/CNPJ sao validados antes da cobranca; documento nao e persistido em claro.
11. Dados de cartao nunca atravessam frontend, backend, logs ou banco do Hub.
12. Timeout de cliente/cobranca converge por consulta e nunca repete mutacao cegamente.
13. Webhook e conciliacao concedem acesso somente com valor e identidade exatos.
14. Reembolso integral devolve o bruto, inclusive acrescimo.
15. Pedidos historicos de Checkout continuam conciliaveis e reembolsaveis.
16. Pix e cartao 1x continuam disponiveis quando a simulacao parcelada estiver temporariamente indisponivel.
17. A URL publica da landing continua sendo `/comprar/[slug]`; nenhuma segunda landing e criada.
18. Callback de navegacao nunca substitui webhook como evidencia financeira.

## Riscos residuais aceitos

- Nao existe transacao atomica entre simulacao, criacao da cobranca e compensacao. Mudanca posterior de taxa pode alterar marginalmente o líquido real; o cliente nunca sera recobrado.
- O Asaas nao documenta webhook de mudanca tarifaria. Atualizacao depende de TTL e revalidacao no submit.
- A cotacao usa resposta estimada do simulador. Divergencia real fica visivel como diferenca entre líquido cotado e real.
- A etapa minima de identidade aumenta friccao, mas e necessaria para criar o `customer` exigido pela Fatura e fixar quantidade/total.
- Regras fiscais sobre destaque do acrescimo e nota fiscal exigem validacao contabil antes de Production.
