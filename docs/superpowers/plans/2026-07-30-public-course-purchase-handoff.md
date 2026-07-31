# Public Course Purchase Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o link estável `/comprar/[slug]`, iniciar Checkout Asaas sem formulário local e conceder acesso somente depois de resolver com segurança a identidade coletada pelo provider.

**Architecture:** Uma página Server Component resolve Curso, sessão e impedimentos sem efeito financeiro; um Client Component faz um único `POST` same-origin usando UUID persistido em `sessionStorage`. O webhook passa a ter preparação fora da transação para consultar o cliente Asaas, seguida de CAS e efeitos financeiros transacionais. Identidade inválida, Conta de equipe, bloqueio geral ou Matrícula revogada produz Revisão sem acesso e só pode terminar por reembolso integral.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, PostgreSQL/Drizzle, Better Auth, Vitest, Testing Library/jsdom, Playwright e API REST Asaas v3.

---

## Restrições de execução

- Trabalhar somente no worktree `asaas-migration`.
- Não executar commit, push, merge, deploy ou mutação em banco compartilhado/Production.
- Os passos de checkpoint atualizam este arquivo e `docs/Plano de migracao.md`; commits dependem de autorização futura explícita.
- Antes de cada alteração Next.js, reler os guias locais `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`, `route.md` e `01-app/01-getting-started/05-server-and-client-components.md`.
- Escrever primeiro o teste que prova comportamento observável; confirmar falha pelo motivo esperado; implementar; confirmar passagem.

## Estrutura de arquivos

### Novos arquivos

- `src/features/payments/purchase-handoff.ts`: projeção server-only da elegibilidade do link e da sessão.
- `src/features/payments/purchase-handoff.test.ts`: regras de Curso, sessão, bloqueio, revogação e acesso ativo.
- `src/features/payments/checkout-api.ts`: body e resposta HTTP compartilhados sem importar Route Handler no client.
- `src/features/payments/checkout-api.test.ts`: rejeição de PII e chaves extras no body.
- `src/features/payments/asaas-customer-enrichment.ts`: preparação do webhook fora da transação.
- `src/features/payments/asaas-customer-enrichment.test.ts`: correlação, classificação de erro e minimização de PII.
- `src/app/comprar/[slug]/page.tsx`: handoff público, sem mutação no `GET`.
- `src/app/comprar/[slug]/page.test.tsx`: renderização por estado da projeção.
- `src/app/comprar/[slug]/purchase-handoff-client.tsx`: UUID, `POST`, redirect e fallback manual.
- `src/app/comprar/[slug]/purchase-handoff-client.test.tsx`: efeitos, idempotência e acessibilidade.
- `src/app/comprar/[slug]/checkout-navigation.ts`: validação do destino Asaas antes da navegação.
- `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.tsx`: cópia acessível do link.
- `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx`: Clipboard API e fallback.
- `src/features/payments/course-purchase-link.ts`: derivação pura da URL e indisponibilidade.
- `src/features/payments/course-purchase-link.test.ts`: matriz de disponibilidade.
- `scripts/e2e-asaas.ts`: servidor HTTP local do contrato mínimo de Checkout/cliente.
- `tests/e2e/payment-helpers.ts`: envio de webhook, execução do worker e leitura SQL do banco E2E.
- `src/db/migrations/0052_public_buyer_identity.sql` e metadata gerada pelo Drizzle: status de identidade e tipo de Revisão.

### Arquivos modificados

- `src/db/schema.ts`, `src/db/asaas-schema-contract.test.ts`, `src/db/migration-state.ts`: contrato persistente e topo compatível.
- `src/features/payments/buyer-identity.ts` e novo teste: normalização e validação única de nome/e-mail.
- `src/features/payments/checkout.ts`/teste: `provider_pending`, PII nula, publicação, revogação e callbacks por tentativa.
- `src/features/payments/public-checkout.ts`/teste: entrada sem nome/e-mail.
- `src/app/api/checkouts/course/route.ts`/teste: body estrito, sessão opcional e respostas discriminadas.
- `src/features/payments/actions.ts`/teste: papel Student e impedimentos autenticados.
- `src/features/payments/asaas.ts`, `asaas-client.ts` e testes/fake: `getCustomer` minimizado.
- `src/features/payments/asaas-webhook-worker.ts`/testes: fase de preparação antes de `begin`.
- `src/features/payments/asaas-webhook-processor.ts`/testes: CAS de identidade, Revisão e grant fail-closed.
- `src/features/payments/order-identity.ts`/teste: papel, bloqueio e revogação.
- `src/features/payments/payment-reviews.ts`/teste: proibir aprovação de `buyer_identity`.
- `src/features/payments/refunds.ts` e/ou processor/testes: encerramento automático após reembolso confirmado.
- `src/features/admin/server.ts`/testes: publicação e novo tipo de Revisão.
- `src/app/(admin)/admin/cursos/[courseId]/page.tsx`: seção “Link de compra”.
- `src/app/(admin)/admin/financeiro/financial-operations.tsx`/testes: Revisão sem aprovação e ação de reembolso.
- `src/app/checkout/cancelado/page.tsx`, `expirado/page.tsx` e testes: retorno ao link do Curso, nunca `/`.
- `tests/e2e/critical-journeys.spec.ts`, `scripts/seed-e2e.ts`: jornada fake completa.
- `playwright.config.ts`: ambiente Asaas fake e terceiro `webServer` local.
- Documentos canônicos listados na Task 12.

### Task 1: Centralizar validação da identidade do pagador

**Files:**
- Modify: `src/features/payments/buyer-identity.ts`
- Create: `src/features/payments/buyer-identity.test.ts`
- Modify: `src/features/payments/checkout.ts`
- Test: `src/features/payments/checkout.test.ts`

- [x] **Step 1: Escrever testes falhos para normalização e validação sem coerção**

Cobrir nome Unicode aparado, e-mail normalizado, e-mail inválido, local-part acima de 64,
total acima de 254, nome vazio/acima de 120 e valores não-string:

```ts
expect(parseBuyerIdentity({ email: " BUYER@Example.com ", name: "  Ana  " })).toEqual({
  email: "buyer@example.com",
  name: "Ana",
});
expect(parseBuyerIdentity({ email: "invalid", name: "Ana" })).toBeNull();
expect(parseBuyerIdentity({ email: 1, name: "Ana" })).toBeNull();
expect(parseBuyerIdentity({ email: "ana@example.com", name: "   " })).toBeNull();
```

- [x] **Step 2: Confirmar a falha focal**

Run: `bun test src/features/payments/buyer-identity.test.ts`

Expected: FAIL porque `parseBuyerIdentity` não existe.

- [x] **Step 3: Implementar o único parser sem PII em mensagens de erro**

```ts
export interface BuyerIdentity {
  email: string;
  name: string;
}

const BUYER_EMAIL_MAX_LENGTH = 254;
const BUYER_EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const BUYER_NAME_MAX_LENGTH = 120;
const BUYER_EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export const normalizeBuyerEmail = (email: string): string =>
  email.trim().toLowerCase();

export const parseBuyerIdentity = (value: unknown): BuyerIdentity | null => {
  if (!(value && typeof value === "object")) return null;
  const emailValue = Reflect.get(value, "email");
  const nameValue = Reflect.get(value, "name");
  if (typeof emailValue !== "string" || typeof nameValue !== "string") return null;
  const email = normalizeBuyerEmail(emailValue);
  const name = nameValue.trim();
  const localPart = email.split("@", 1)[0] ?? "";
  if (
    email.length > BUYER_EMAIL_MAX_LENGTH ||
    localPart.length > BUYER_EMAIL_LOCAL_PART_MAX_LENGTH ||
    !BUYER_EMAIL_PATTERN.test(email) ||
    !name ||
    Array.from(name).length > BUYER_NAME_MAX_LENGTH
  ) return null;
  return { email, name };
};
```

Substituir as constantes e validação duplicadas de `checkout.ts` por esse parser.

- [x] **Step 4: Confirmar parser e regressão do checkout**

Run: `bun test src/features/payments/buyer-identity.test.ts src/features/payments/checkout.test.ts`

Expected: PASS.

- [x] **Step 5: Registrar checkpoint sem commit**

Marcar a Task 1 concluída neste arquivo e registrar em `docs/Plano de migracao.md`:
`Identidade: parser único implementado; enriquecimento ainda pendente.`

### Task 2: Persistir o estado explícito da identidade

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/asaas-schema-contract.test.ts`
- Modify: `src/db/migration-state.ts`
- Create: `src/db/migrations/0052_public_buyer_identity.sql`
- Modify: `src/db/migrations/meta/_journal.json`
- Create: `src/db/migrations/meta/0052_snapshot.json`

- [x] **Step 1: Escrever o contrato de schema falho**

```ts
expect(buyerIdentityStatusEnum.enumValues).toEqual([
  "pending",
  "resolved",
  "review_required",
]);
expect(paymentReviewTypeEnum.enumValues).toContain("buyer_identity");
expect(columnNames(orders)).toContain("buyer_identity_status");
expect(orders.buyerIdentityStatus.notNull).toBe(true);
```

- [x] **Step 2: Confirmar a falha focal**

Run: `bun test src/db/asaas-schema-contract.test.ts`

Expected: FAIL por enum/coluna ausentes.

- [x] **Step 3: Alterar somente o schema Drizzle**

```ts
export const buyerIdentityStatusEnum = pgEnum("buyer_identity_status", [
  "pending",
  "resolved",
  "review_required",
]);

export const paymentReviewTypeEnum = pgEnum("payment_review_type", [
  "amount_mismatch",
  "terminal_conflict",
  "event_anomaly",
  "partial_refund",
  "uncertain_result",
  "buyer_identity",
]);

// orders
buyerIdentityStatus: buyerIdentityStatusEnum("buyer_identity_status").notNull(),
```

- [x] **Step 4: Gerar a migration oficialmente e revisar o SQL**

Run: `bun run db:generate -- --name public_buyer_identity`

Expected: exatamente `0052_public_buyer_identity.sql`, journal e snapshot gerados. Antes
de qualquer aplicação, substituir a instrução insegura de coluna `NOT NULL` pelo bloco SQL
abaixo; editar somente o SQL ainda não aplicado, nunca journal/snapshot:

```sql
ALTER TABLE "orders" ADD COLUMN "buyer_identity_status" "buyer_identity_status";
UPDATE "orders"
SET "buyer_identity_status" = CASE
  WHEN "user_id" IS NOT NULL THEN 'resolved'::"buyer_identity_status"
  ELSE 'pending'::"buyer_identity_status"
END;
ALTER TABLE "orders" ALTER COLUMN "buyer_identity_status" SET NOT NULL;
```

- [x] **Step 5: Atualizar o marcador de readiness pelo timestamp gerado**

Ler a última entrada de `_journal.json`, confirmar
`tag === "0052_public_buyer_identity"` e copiar seu campo numérico `when` para
`LATEST_COMPATIBLE_MIGRATION_TIMESTAMP`. O teste de migrations deve comparar os dois
valores, impedindo número inventado ou divergente.

- [x] **Step 6: Validar schema e cadeia sem aplicar banco remoto**

Run: `bun test src/db/asaas-schema-contract.test.ts && bun run db:migrations:check`

Expected: PASS; topo `0052`; nenhuma conexão mutável compartilhada.

- [x] **Step 7: Registrar checkpoint sem commit**

Atualizar `docs/Plano de migracao.md` com nome/timestamp reais da migration e estado
`gerada, não aplicada a ambiente persistente`.

### Task 3: Criar Pedidos anônimos sem PII e bloquear venda inelegível

**Files:**
- Modify: `src/features/payments/checkout.ts`
- Test: `src/features/payments/checkout.test.ts`
- Modify: `src/features/payments/public-checkout.ts`
- Test: `src/features/payments/public-checkout.test.ts`
- Modify: `src/features/payments/actions.ts`
- Test: `src/features/payments/actions.test.ts`

- [x] **Step 1: Escrever testes falhos para `provider_pending`**

Provar o `insert into orders` com PII nula e status correto:

```ts
await createAsaasCheckoutIntent({
  attemptId: ATTEMPT_ID,
  buyer: { kind: "provider_pending" },
  callbacks,
  courseSlug: "curso",
  gateway,
});
expect(insertValues).toEqual(expect.arrayContaining([null, null, "pending"]));
expect(gateway.createCheckout).toHaveBeenCalledWith(
  expect.not.objectContaining({ customer: expect.anything(), customerData: expect.anything() })
);
```

Adicionar casos para Curso sem publicação `published`, Matrícula `revoked`, acesso ativo,
Admin/Suporte e Conta bloqueada.

- [x] **Step 2: Confirmar falhas focais**

Run: `bun test src/features/payments/checkout.test.ts src/features/payments/public-checkout.test.ts src/features/payments/actions.test.ts`

Expected: FAIL por tipo público atual exigir nome/e-mail e por falta das novas guardas.

- [x] **Step 3: Alterar o tipo discriminado e a idempotência**

```ts
type CheckoutBuyer =
  | { email: string; kind: "authenticated"; name: string; userId: string }
  | { kind: "provider_pending" };

const isSameBuyer = ({ buyer, order }: {
  buyer: CheckoutBuyer;
  order: CheckoutOrder;
}): boolean =>
  buyer.kind === "authenticated"
    ? order.user_id === buyer.userId && order.buyer_identity_status === "resolved"
    : order.user_id === null && order.buyer_identity_status === "pending";
```

O `insert` deve usar:

```ts
const authenticated = input.buyer.kind === "authenticated";
const customerIdentity = authenticated ? parseBuyerIdentity(input.buyer) : null;
// values: userId, customerEmail, customerName, buyerIdentityStatus
[
  authenticated ? input.buyer.userId : null,
  customerIdentity?.email ?? null,
  customerIdentity?.name ?? null,
  authenticated ? "resolved" : "pending",
]
```

Adicionar em `checkout.ts`, onde `UUID_PATTERN` já é autoridade:

```ts
export const createCheckoutCallbacks = (attemptId: string): CheckoutCallbacks => {
  if (!UUID_PATTERN.test(attemptId)) {
    throw new CheckoutIntentError("validation", "attempt_invalid");
  }
  const query = `?attemptId=${encodeURIComponent(attemptId)}`;
  return {
    cancelUrl: getApplicationUrl(`/checkout/cancelado${query}`),
    expiredUrl: getApplicationUrl(`/checkout/expirado${query}`),
    successUrl: getApplicationUrl("/checkout/sucesso"),
  };
};
```

- [x] **Step 4: Exigir publicação e impedir revogação antes do provider**

A consulta do Curso inclui:

```sql
select c.id, c.title, c.slug, c.description, c.price_in_cents,
       c.access_duration_months, c.status,
       exists (
         select 1 from course_publications cp
         where cp.course_id = c.id and cp.status = 'published'
       ) as has_published_publication
from courses c
where ($1::uuid is not null and c.id = $1::uuid)
   or ($2::text is not null and c.slug = $2::text)
limit 1
```

Para buyer autenticada, uma única consulta deve classificar `active` e `revoked`; ambos
lançam `CheckoutIntentError("conflict", ...)`, sem inserir Pedido nem chamar provider.

- [x] **Step 5: Remover PII da entrada pública e reforçar a action autenticada**

```ts
return await createAsaasCheckoutIntent({
  attemptId: checkoutAttemptId,
  authorizeNewIntent: async ({ courseId: canonicalCourseId }) =>
    await authorizePublicCheckoutIntent({ courseId: canonicalCourseId, ipAddress, secret }),
  buyer: authenticatedBuyer ?? { kind: "provider_pending" },
  callbacks: createCheckoutCallbacks(checkoutAttemptId),
  ...(courseId ? { courseId } : {}),
  ...(courseSlug ? { courseSlug } : {}),
  gateway,
});
```

`startCourseCheckoutAction` exige `session.role === "student"`; `requireSession` já recusa
Student com bloqueio geral, e o núcleo recusa Matrícula `revoked`.

- [x] **Step 6: Confirmar os testes focais**

Run: `bun test src/features/payments/checkout.test.ts src/features/payments/public-checkout.test.ts src/features/payments/actions.test.ts`

Expected: PASS; testes verificam zero chamada ao gateway em cada impedimento.

- [x] **Step 7: Registrar checkpoint sem commit**

Atualizar o status da jornada pública no plano canônico, sem marcar o handoff como pronto.

### Task 4: Tornar a API pública estrita e sensível à sessão

**Files:**
- Create: `src/features/payments/checkout-api.ts`
- Create: `src/features/payments/checkout-api.test.ts`
- Modify: `src/app/api/checkouts/course/route.ts`
- Test: `src/app/api/checkouts/course/route.test.ts`
- Modify: `src/lib/session.ts` somente se uma dependência injetável de sessão for necessária

- [x] **Step 1: Escrever a matriz HTTP falha**

Cobrir:

```ts
expect(parseCheckoutRequest({ checkoutAttemptId: ATTEMPT_ID, courseSlug: "curso" })).toEqual({
  checkoutAttemptId: ATTEMPT_ID,
  courseSlug: "curso",
});
expect(parseCheckoutRequest({ buyerEmail: "x@y.com", checkoutAttemptId: ATTEMPT_ID, courseSlug: "curso" })).toBeNull();
```

E respostas: visitante `200/202`, Student usa sessão, Admin/Suporte `403`, Student bloqueada
`403`, rate limit `429`, Curso/revogação/acesso ativo `409|422`, falha terminal do provider
`502` com `retryAllowed: true`, processamento incerto `202` com `retryAllowed: false`.

- [x] **Step 2: Confirmar a falha focal**

Run: `bun test src/features/payments/checkout-api.test.ts src/app/api/checkouts/course/route.test.ts`

Expected: FAIL porque o body ainda exige `buyerName`/`buyerEmail`.

- [x] **Step 3: Implementar body fechado e seleção de identidade server-side**

```ts
export interface PublicCheckoutBody {
  checkoutAttemptId: string;
  courseId?: string;
  courseSlug?: string;
}

const allowedKeys = new Set([
  "checkoutAttemptId",
  courseId ? "courseId" : "courseSlug",
]);
```

Esse código vive em `checkout-api.ts` como `parseCheckoutRequest(value: unknown)`; o mesmo
arquivo exporta o union `CheckoutApiResponse` usado pela rota e pelo Client Component.

```ts
const session = await getCurrentSession();
if (session?.role !== undefined && session.role !== "student") {
  return errorResponse("Compra indisponivel para esta conta.", 403);
}
if (session?.platformBlockedAt) {
  return errorResponse("Entre em contato com o suporte.", 403);
}
const authenticatedBuyer = session
  ? {
      email: session.user.email,
      kind: "authenticated" as const,
      name: session.user.name,
      userId: session.user.id,
    }
  : undefined;
const checkout = await createPublicCourseCheckout({
  ...body,
  authenticatedBuyer,
  ipAddress,
});
```

A função autenticada reutiliza `createAsaasCheckoutIntent`; não aceita identidade do body.

- [x] **Step 4: Retornar resultado discriminado sem vazar erro interno**

```ts
type CheckoutApiResponse =
  | { orderId: string; redirectUrl: string; retryAllowed: false; status: "ready" }
  | { orderId: string; retryAllowed: false; status: "processing" }
  | { orderId: string; retryAllowed: true; status: "failed" }
  | { error: string; retryAllowed: false; status: "unavailable" };
```

Chaves desconhecidas, PII, preço, callback ou método do cliente retornam `400` antes de DB.

- [x] **Step 5: Confirmar a matriz HTTP**

Run: `bun test src/features/payments/checkout-api.test.ts src/app/api/checkouts/course/route.test.ts`

Expected: PASS.

- [x] **Step 6: Registrar checkpoint sem commit**

Registrar no plano canônico: `API sem PII concluída; página de handoff pendente.`

### Task 5: Implementar a projeção e a página `/comprar/[slug]`

**Files:**
- Create: `src/features/payments/purchase-handoff.ts`
- Create: `src/features/payments/purchase-handoff.test.ts`
- Create: `src/app/comprar/[slug]/page.tsx`
- Create: `src/app/comprar/[slug]/page.test.tsx`
- Create: `src/app/comprar/[slug]/purchase-handoff-client.tsx`
- Create: `src/app/comprar/[slug]/purchase-handoff-client.test.tsx`

- [x] **Step 1: Escrever testes falhos da projeção server-only**

O retorno é um union fechado:

```ts
export type PurchaseHandoffView =
  | { courseId: string; courseSlug: string; courseTitle: string; kind: "checkout" }
  | { courseId: string; courseTitle: string; href: string; kind: "access" }
  | { kind: "blocked"; reason: "account_blocked" | "course_revoked" | "team_account" }
  | { kind: "unavailable"; reason: "checkout_disabled" | "course_unavailable" };
```

Provar Curso inexistente/draft/archived/gratuito/sem publicação, modo diferente de
`public`, visitante elegível, Student ativa, Student sem acesso, revogada, bloqueada e
Admin/Suporte.

- [x] **Step 2: Confirmar falha da projeção**

Run: `bun test src/features/payments/purchase-handoff.test.ts`

Expected: FAIL porque o módulo não existe.

- [x] **Step 3: Implementar uma consulta de projeção sem efeito**

```sql
select c.id, c.slug, c.title, c.status, c.price_in_cents,
       exists (
         select 1 from course_publications cp
         where cp.course_id = c.id and cp.status = 'published'
       ) as has_published_publication,
       e.status as enrollment_status,
       e.starts_at,
       e.expires_at
from courses c
left join enrollments e on e.course_id = c.id and e.user_id = $2
where c.slug = $1
limit 1
```

`getPurchaseHandoffView({ slug, session })` usa `assertCheckoutAvailable` de forma segura,
nunca cria Pedido e nunca chama Asaas.

- [x] **Step 4: Escrever testes falhos do Client Component**

Com jsdom e `act`, provar:

```ts
expect(fetch).toHaveBeenCalledTimes(1);
expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
  checkoutAttemptId: ATTEMPT_ID,
  courseSlug: "curso",
});
expect(sessionStorage.getItem("hub:checkout-attempt:curso")).toBe(ATTEMPT_ID);
expect(locationAssign).toHaveBeenCalledWith("https://sandbox.asaas.com/c/checkout");
```

Cobrir Strict Mode/efeito duplicado, `processing`, erro de rede, terminal com retry manual,
botão acessível e ausência de segundo POST automático.

- [x] **Step 5: Confirmar falha do componente**

Run: `bun test src/app/comprar/[slug]/purchase-handoff-client.test.tsx`

Expected: FAIL porque o componente não existe.

- [x] **Step 6: Implementar início único e retry consciente**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckoutApiResponse } from "@/features/payments/checkout-api";

const ATTEMPT_PREFIX = "hub:checkout-attempt:";

type HandoffState =
  | { kind: "starting" }
  | { kind: "processing"; orderId: string }
  | { kind: "retry"; message: string; replaceAttempt: boolean }
  | { kind: "unavailable" };

export function PurchaseHandoffClient({ courseSlug }: { courseSlug: string }) {
  const started = useRef(false);
  const [state, setState] = useState<HandoffState>({ kind: "starting" });

  const start = useCallback(async ({ replaceAttempt = false } = {}) => {
    setState({ kind: "starting" });
    const key = `${ATTEMPT_PREFIX}${courseSlug}`;
    if (replaceAttempt) sessionStorage.removeItem(key);
    const attemptId = sessionStorage.getItem(key) ?? crypto.randomUUID();
    sessionStorage.setItem(key, attemptId);
    try {
      const response = await fetch("/api/checkouts/course", {
        body: JSON.stringify({ checkoutAttemptId: attemptId, courseSlug }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as CheckoutApiResponse;
      if (result.status === "ready") {
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.status === "processing") {
        setState({ kind: "processing", orderId: result.orderId });
        return;
      }
      if (result.status === "failed" && result.retryAllowed) {
        setState({
          kind: "retry",
          message: "O checkout foi recusado antes da cobrança.",
          replaceAttempt: true,
        });
        return;
      }
      setState({ kind: "unavailable" });
    } catch {
      setState({
        kind: "retry",
        message: "Não foi possível confirmar o início do checkout.",
        replaceAttempt: false,
      });
    }
  }, [courseSlug]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  if (state.kind === "processing") {
    return (
      <main aria-live="polite">
        <h1>Pagamento em processamento</h1>
        <p>Não inicie outra tentativa. Referência: {state.orderId}</p>
      </main>
    );
  }
  if (state.kind === "retry") {
    return (
      <main aria-live="polite">
        <h1>Não foi possível abrir o checkout</h1>
        <p>{state.message}</p>
        <button
          onClick={() => void start({ replaceAttempt: state.replaceAttempt })}
          type="button"
        >
          Tentar novamente
        </button>
      </main>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <main aria-live="polite">
        <h1>Checkout indisponível</h1>
        <p>Entre em contato com o suporte.</p>
      </main>
    );
  }
  return (
    <main aria-live="polite">
      <h1>Preparando checkout</h1>
      <p>Você será redirecionada para o ambiente seguro de pagamento.</p>
    </main>
  );
}
```

- [x] **Step 7: Implementar a página Server Component**

```tsx
export const dynamic = "force-dynamic";

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const view = await getPurchaseHandoffView({
    session: await getCurrentSession(),
    slug,
  });
  if (view.kind === "checkout") {
    return <PurchaseHandoffClient courseSlug={view.courseSlug} />;
  }
  if (view.kind === "access") {
    return <PurchaseAccessReady href={view.href} title={view.courseTitle} />;
  }
  return <PurchaseUnavailable reason={view.reason} />;
}
```

A página contém apenas estado técnico, não formulário, e `/` permanece intacta.

- [x] **Step 8: Confirmar projeção e UI**

Run: `bun test src/features/payments/purchase-handoff.test.ts src/app/comprar/[slug]/purchase-handoff-client.test.tsx src/app/comprar/[slug]/page.test.tsx`

Expected: PASS.

- [x] **Step 9: Registrar checkpoint sem commit**

Marcar o handoff como implementado em código, ainda não homologado em Sandbox.

### Task 6: Exibir e copiar o link na configuração do Curso

**Files:**
- Create: `src/features/payments/course-purchase-link.ts`
- Create: `src/features/payments/course-purchase-link.test.ts`
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx`
- Modify: `src/features/admin/server.ts`
- Test: `src/features/admin/server-read-projections.test.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- Create or modify: `src/app/(admin)/admin/cursos/[courseId]/page.test.tsx`

- [x] **Step 1: Escrever a matriz pura de disponibilidade**

```ts
expect(getCoursePurchaseLink({
  appUrl: "https://hub.example",
  checkoutMode: "public",
  course: { hasPublishedPublication: true, priceInCents: 1000, slug: "curso", status: "active" },
})).toEqual({ available: true, url: "https://hub.example/comprar/curso" });
```

Cada estado inelegível deve retornar `{ available: false, reason }` com razão distinta.

- [x] **Step 2: Confirmar falha da matriz**

Run: `bun test src/features/payments/course-purchase-link.test.ts`

Expected: FAIL porque o módulo não existe.

- [x] **Step 3: Implementar derivação absoluta segura**

```ts
export const getCoursePurchaseLink = (input: CoursePurchaseLinkInput): CoursePurchaseLink => {
  if (input.checkoutMode !== "public") return { available: false, reason: "checkout_disabled" };
  if (input.course.status !== "active") return { available: false, reason: "course_inactive" };
  if (!input.course.hasPublishedPublication) return { available: false, reason: "course_unpublished" };
  if (input.course.priceInCents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS) {
    return { available: false, reason: "invalid_price" };
  }
  return {
    available: true,
    url: new URL(`/comprar/${encodeURIComponent(input.course.slug)}`, input.appUrl).toString(),
  };
};
```

- [x] **Step 4: Ampliar a projeção administrativa**

`getAdminCoursePublicationState` retorna exatamente:

```ts
Promise<{ hasDraft: boolean; hasPublished: boolean }>
```

com agregação SQL por status, evitando segunda consulta na página.

- [x] **Step 5: Escrever e implementar o componente de cópia**

Testar `navigator.clipboard.writeText(url)`, feedback em `aria-live` e fallback que
seleciona um `<input readOnly value={url}>` quando Clipboard API rejeita.

```tsx
<CoursePurchaseLink
  link={getCoursePurchaseLink({
    appUrl: getServerEnv().NEXT_PUBLIC_APP_URL,
    checkoutMode: getServerEnv().PAYMENTS_CHECKOUT_MODE,
    course: {
      hasPublishedPublication: publicationState.hasPublished,
      priceInCents: course.priceInCents,
      slug: course.slug,
      status: course.status,
    },
  })}
/>
```

- [x] **Step 6: Confirmar regras e interação**

Run: `bun test src/features/payments/course-purchase-link.test.ts src/features/admin/server-read-projections.test.ts src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx src/app/(admin)/admin/cursos/[courseId]/page.test.tsx`

Expected: PASS.

- [x] **Step 7: Registrar checkpoint sem commit**

Atualizar o plano canônico com `link copiável implementado; verificação visual não usada`.

### Task 7: Consultar cliente Asaas com contrato minimizado

**Files:**
- Modify: `src/features/payments/asaas.ts`
- Modify: `src/features/payments/asaas-client.ts`
- Test: `src/features/payments/asaas-client.test.ts`
- Modify: `src/features/payments/fake-asaas-gateway.ts`
- Test: `src/features/payments/fake-asaas-gateway.test.ts`

- [x] **Step 1: Escrever testes HTTP falhos de `getCustomer`**

Provar `GET /v3/customers/cus_123`, headers existentes, timeout, path escapado, ID
divergente, campos ausentes, `401`, `404`, `429`, `5xx` e transporte. Provar minimização:

```ts
expect(await client.getCustomer("cus_123")).toEqual({
  email: "buyer@example.com",
  id: "cus_123",
  name: "Buyer",
});
expect(result).not.toHaveProperty("cpfCnpj");
expect(result).not.toHaveProperty("phone");
expect(result).not.toHaveProperty("address");
```

- [x] **Step 2: Confirmar falha do client**

Run: `bun test src/features/payments/asaas-client.test.ts src/features/payments/fake-asaas-gateway.test.ts`

Expected: FAIL porque o método não existe.

- [x] **Step 3: Adicionar o contrato mínimo**

```ts
export interface AsaasCustomer {
  email: string;
  id: string;
  name: string;
}

export interface AsaasGateway {
  getCustomer(customerId: string): Promise<AsaasCustomer>;
}
```

- [x] **Step 4: Implementar leitura com o pipeline HTTP existente**

```ts
async getCustomer(customerId: string): Promise<AsaasCustomer> {
  assertNonEmptyId(customerId, "Cliente");
  return await this.request({
    method: "GET",
    parse: (payload) => parseCustomer(payload),
    path: `/v3/customers/${encodeURIComponent(customerId)}`,
    requestKind: "read",
  });
}
```

`parseCustomer` aceita somente objeto e strings `id`, `name`, `email`; retorna somente
esses três campos. Não incluir payload/PII em erros.

- [x] **Step 5: Atualizar o fake com mapa explícito**

```ts
readonly customers = new Map<string, AsaasCustomer>();

async getCustomer(customerId: string): Promise<AsaasCustomer> {
  const customer = this.customers.get(customerId);
  if (!customer) throw createFakeNotFoundError();
  return { ...customer };
}
```

- [x] **Step 6: Confirmar contrato e sanitização**

Run: `bun test src/features/payments/asaas-client.test.ts src/features/payments/fake-asaas-gateway.test.ts`

Expected: PASS.

- [x] **Step 7: Registrar checkpoint sem commit**

Registrar `adapter getCustomer concluído; worker bifásico pendente`.

### Task 8: Preparar enriquecimento fora da transação do webhook

**Files:**
- Create: `src/features/payments/asaas-customer-enrichment.ts`
- Create: `src/features/payments/asaas-customer-enrichment.test.ts`
- Modify: `src/features/payments/asaas-webhook-worker.ts`
- Test: `src/features/payments/asaas-webhook-worker.test.ts`
- Test: `src/features/payments/asaas-webhook-worker.integration.test.ts`

- [x] **Step 1: Escrever testes falhos da classificação**

Definir e cobrir:

```ts
export type AsaasBuyerIdentityPreparation =
  | { kind: "not_required" }
  | { customerId: string; identity: BuyerIdentity; kind: "resolved"; orderId: string }
  | {
      customerId: string | null;
      kind: "review_required";
      orderId: string;
      reason: "buyer_identity_conflict" | "buyer_identity_invalid" | "buyer_identity_missing";
    };
```

Somente `PAYMENT_RECEIVED`/PIX e `PAYMENT_CONFIRMED`/CREDIT_CARD de Pedido público
`pending` consultam cliente. Pedido autenticado/resolvido, refund, checkout e evento sem
efeito de grant retornam `not_required`.

- [x] **Step 2: Confirmar falha da preparação**

Run: `bun test src/features/payments/asaas-customer-enrichment.test.ts`

Expected: FAIL porque o módulo não existe.

- [x] **Step 3: Implementar correlação somente leitura e política de erros**

```ts
try {
  const customer = await gateway.getCustomer(customerId);
  if (customer.id !== customerId) return review("buyer_identity_conflict");
  const identity = parseBuyerIdentity(customer);
  return identity
    ? { customerId, identity, kind: "resolved", orderId }
    : review("buyer_identity_invalid");
} catch (error) {
  if (error instanceof AsaasGatewayError && error.kind === "not_found") {
    return review("buyer_identity_missing");
  }
  if (error instanceof AsaasGatewayError && error.kind === "invalid_response") {
    return review("buyer_identity_invalid");
  }
  throw new AsaasWebhookProcessingError(`asaas_customer_${safeKind}`, {
    retryable: error instanceof AsaasGatewayError && error.retryable,
  });
}
```

A correlação externa retorna um único `orderId`; zero/múltiplos candidatos não chama
Asaas e deixa o processor transacional aplicar a política existente de alerta.

- [x] **Step 4: Escrever teste falho provando ausência de transação durante fetch**

```ts
expect(callOrder).toEqual([
  "prepare",
  "provider:getCustomer",
  "pool:connect",
  "begin",
  "processor",
  "commit",
]);
```

Falha retryable em `prepare` deve marcar inbox `retryable` sem executar `begin`.

- [x] **Step 5: Converter o processor em contrato bifásico**

```ts
export interface AsaasWebhookProcessor {
  prepare(event: ClaimedAsaasWebhookEvent): Promise<AsaasBuyerIdentityPreparation>;
  process(
    event: ClaimedAsaasWebhookEvent,
    context: AsaasWebhookProcessingContext,
    preparation: AsaasBuyerIdentityPreparation
  ): Promise<AsaasWebhookProcessorOutcome>;
}
```

`createAsaasWebhookProcessor` recebe dependências explícitas e testáveis:

```ts
interface ProcessorDependencies {
  applyPaidAccess: typeof applyPaidWebhookAccess;
  applyRevocation: typeof applyPaymentRevocation;
  enqueueMessage: typeof enqueueOutboxMessage;
  gateway: AsaasGateway;
  now: () => Date;
  prepareIdentity: typeof prepareAsaasCustomerIdentity;
  resolveIdentity: typeof resolveLocalOrderIdentity;
}

const prepare = async (
  event: ClaimedAsaasWebhookEvent
): Promise<AsaasBuyerIdentityPreparation> =>
  await dependencies.prepareIdentity({
    event,
    gateway: dependencies.gateway,
    query: getPool(),
  });
```

O callback transacional que hoje é retornado diretamente passa a se chamar `process`, com
o terceiro argumento `preparation`; a factory retorna `{ prepare, process }`. Não alterar
a matriz financeira nessa movimentação mecânica; as mudanças de identidade entram na
Task 9 com testes próprios.

`processClaimedAsaasWebhookEvent` chama `prepare` antes de `pool.connect()`/`begin`; em
falha usa `markProcessingFailure` com o próprio `Pool`, cujo contrato é somente `query`.

- [x] **Step 6: Confirmar worker unitário e PostgreSQL**

Run: `bun test src/features/payments/asaas-customer-enrichment.test.ts src/features/payments/asaas-webhook-worker.test.ts`

Se `CERTIFICATE_CONCURRENCY_DATABASE_URL` apontar para banco descartável local migrado,
run: `bun run test:certificates:integration -- src/features/payments/asaas-webhook-worker.integration.test.ts`

Expected: unitários PASS; integração PASS ou bloqueio explícito por ausência de Postgres
local, sem usar Neon compartilhado.

- [x] **Step 7: Registrar checkpoint sem commit**

Registrar evidência de que nenhuma chamada externa ocorre dentro da transação.

### Task 9: Resolver identidade e concessão de forma transacional e fail-closed

**Files:**
- Modify: `src/features/payments/order-identity.ts`
- Test: `src/features/payments/order-identity.test.ts`
- Modify: `src/features/payments/asaas-webhook-processor.ts`
- Test: `src/features/payments/asaas-webhook-processor.test.ts`
- Test: `src/features/payments/asaas-webhook-worker.integration.test.ts`

- [x] **Step 1: Escrever testes falhos das colisões locais**

Cobrir Conta Student válida, Conta nova, Admin, Suporte, `platform_blocked_at`, Matrícula
`revoked` no mesmo Curso, revogação em outro Curso e corrida de e-mail.

```ts
await expect(resolveLocalOrderIdentity(inputFor("admin"))).rejects.toMatchObject({
  code: "buyer_identity_team_account",
});
await expect(resolveLocalOrderIdentity(inputForBlockedStudent)).rejects.toMatchObject({
  code: "buyer_identity_platform_blocked",
});
await expect(resolveLocalOrderIdentity(inputForRevokedCourse)).rejects.toMatchObject({
  code: "buyer_identity_course_revoked",
});
```

- [x] **Step 2: Confirmar falhas da resolução**

Run: `bun test src/features/payments/order-identity.test.ts`

Expected: FAIL porque a consulta atual lê apenas `users.id`.

- [x] **Step 3: Consultar Perfil e revogação sem sobrescrever Conta**

```sql
select u.id, p.role, p.platform_blocked_at,
       exists (
         select 1 from enrollments e
         where e.user_id = u.id and e.course_id = $2 and e.status = 'revoked'
       ) as course_revoked
from users u
left join profiles p on p.user_id = u.id
where lower(u.email) = $1
limit 1
```

`LockedOrderIdentity` passa a incluir `courseId`. Qualquer papel ausente/não-Student,
bloqueio ou revogação lança código seguro específico antes de vincular Pedido.

- [x] **Step 4: Escrever testes falhos do CAS de preparação**

Provar:

- `pending + resolved` grava `provider_customer_id`, nome/e-mail uma vez;
- retry idêntico relê sem sobrescrever;
- customer ID ou identidade divergente marca `review_required`;
- preparação para outro Pedido é rejeitada;
- `review_required` nunca chama `applyPaidAccess`;
- sucesso vincula Conta e muda status para `resolved` na mesma transação.

- [x] **Step 5: Aplicar preparação antes do efeito de grant**

```sql
update orders
set provider_customer_id = $2,
    customer_name = $3,
    customer_email = $4,
    updated_at = now()
where id = $1
  and user_id is null
  and buyer_identity_status = 'pending'
  and provider_customer_id is null
  and customer_name is null
  and customer_email is null
returning id
```

Dentro de `resolveLocalOrderIdentity`, vincular e resolver com o mesmo CAS:

```sql
update orders
set user_id = $2, buyer_identity_status = 'resolved', updated_at = now()
where id = $1 and user_id is null and buyer_identity_status = 'pending'
returning user_id
```

O processor não repete esse `update`; ele usa o resultado da resolução para criar
Concessão/outbox. Pedido autenticado já `resolved` apenas valida a Conta pelo `user_id`.

Falha de identidade executa:

```sql
update orders
set buyer_identity_status = 'review_required', updated_at = now()
where id = $1 and buyer_identity_status = 'pending'
```

e insere `payment_reviews.type='buyer_identity'` com uma razão segura, sem PII.

- [x] **Step 6: Bloquear grant e mapear razões**

Mapeamento fechado:

```ts
const IDENTITY_REVIEW_REASON_BY_ERROR = {
  buyer_identity_course_revoked: "buyer_identity_course_revoked",
  buyer_identity_platform_blocked: "buyer_identity_platform_blocked",
  buyer_identity_team_account: "buyer_identity_team_account",
  order_identity_conflict: "buyer_identity_conflict",
  order_identity_incomplete: "buyer_identity_invalid",
} as const;
```

`applyDecisionEffect` retorna `identity_review` e o processor não cria Concessão,
Matrícula nem outbox. O Pedido preserva `paid` e evidência financeira.

- [x] **Step 7: Confirmar processor e concorrência**

Run: `bun test src/features/payments/order-identity.test.ts src/features/payments/asaas-webhook-processor.test.ts src/features/payments/asaas-webhook-worker.test.ts`

Expected: PASS, incluindo retries e eventos fora de ordem.

- [x] **Step 8: Registrar checkpoint sem commit**

Atualizar o plano canônico com cada colisão coberta e o estado do teste PostgreSQL.

### Task 10: Tornar Revisão de identidade resolvível somente por reembolso

**Files:**
- Modify: `src/features/payments/payment-reviews.ts`
- Test: `src/features/payments/payment-reviews.test.ts`
- Modify: `src/features/payments/asaas-webhook-processor.ts`
- Test: `src/features/payments/asaas-webhook-processor.test.ts`
- Modify: `src/features/admin/server.ts`
- Test: `src/features/admin/server-read-projections.test.ts`
- Modify: `src/app/(admin)/admin/financeiro/financial-operations.tsx`
- Test: `src/app/(admin)/admin/financeiro/page.test.tsx`

- [x] **Step 1: Escrever testes falhos de autorização da decisão**

```ts
await expect(resolvePaymentReview({
  actorUserId: ADMIN_ID,
  canResolveTerminalConflicts: true,
  decision: "approved",
  decisionReason: "manual",
  reviewId: BUYER_REVIEW_ID,
})).rejects.toThrow("Revisao de identidade exige reembolso integral.");
```

Rejeição manual também deve falhar: o encerramento vem somente da confirmação financeira.

- [x] **Step 2: Confirmar falhas focal e de UI**

Run: `bun test src/features/payments/payment-reviews.test.ts src/app/(admin)/admin/financeiro/page.test.tsx`

Expected: FAIL por tipo/label/ação ausentes.

- [x] **Step 3: Proibir toda decisão genérica para `buyer_identity`**

Adicionar o tipo na projeção e, imediatamente após o lock:

```ts
if (review.type === "buyer_identity") {
  throw new Error("Revisao de identidade exige reembolso integral.");
}
```

- [x] **Step 4: Renderizar instrução e reembolso, nunca aprovação**

```tsx
if (review.type === "buyer_identity" && review.status === "pending") {
  return (
    <article>
      <p>Identidade da compra requer suporte</p>
      <p>Não libere ou transfira o acesso. Execute o reembolso integral.</p>
      <RefundOperation orderId={review.orderId} />
    </article>
  );
}
```

O teste deve consultar a árvore renderizada e provar ausência das opções “Aprovar” e
“Rejeitar”, não procurar texto no source.

- [x] **Step 5: Encerrar automaticamente somente com reembolso integral confirmado**

Na mesma transação que confirma `refund_requests`/Pedido:

```sql
update payment_reviews
set status = 'rejected',
    decision_reason = 'buyer_identity_refunded',
    resolved_by_user_id = null,
    resolved_at = coalesce(resolved_at, $2),
    updated_at = now()
where order_id = $1 and type = 'buyer_identity' and status = 'pending'
```

Reembolso parcial, incerto ou pedido apenas criado não encerra a Revisão.

- [x] **Step 6: Confirmar domínio, UI e reembolso**

Run: `bun test src/features/payments/payment-reviews.test.ts src/features/payments/asaas-webhook-processor.test.ts src/app/(admin)/admin/financeiro/page.test.tsx`

Expected: PASS.

- [x] **Step 7: Registrar checkpoint sem commit**

Registrar `Revisão buyer_identity: somente reembolso integral confirmado`.

### Task 11: Corrigir callbacks e permitir nova tentativa segura

**Files:**
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/checkout.ts`
- Test: `src/features/payments/checkout.test.ts`
- Modify: `src/app/checkout/cancelado/page.tsx`
- Create or modify: `src/app/checkout/cancelado/page.test.tsx`
- Modify: `src/app/checkout/expirado/page.tsx`
- Create or modify: `src/app/checkout/expirado/page.test.tsx`
- Verify: `src/app/checkout/sucesso/page.tsx`

- [x] **Step 1: Escrever testes falhos dos callbacks por tentativa**

```ts
expect(createCheckoutCallbacks(ATTEMPT_ID)).toEqual({
  cancelUrl: `https://hub.example/checkout/cancelado?attemptId=${ATTEMPT_ID}`,
  expiredUrl: `https://hub.example/checkout/expirado?attemptId=${ATTEMPT_ID}`,
  successUrl: "https://hub.example/checkout/sucesso",
});
```

Provar que valor não UUID não gera consulta e que Pedido inexistente renderiza suporte,
nunca link para `/`.

- [x] **Step 2: Confirmar falhas**

Run: `bun test src/features/payments/checkout.test.ts src/app/checkout/cancelado/page.test.tsx src/app/checkout/expirado/page.test.tsx`

Expected: FAIL por callbacks atuais não carregarem tentativa e páginas apontarem `/`.

- [x] **Step 3: Derivar callbacks sem aceitar URL do navegador**

```ts
export const createCheckoutCallbacks = (attemptId: string): CheckoutCallbacks => {
  if (!UUID_PATTERN.test(attemptId)) throw new Error("Invalid checkout attempt.");
  const query = `?attemptId=${encodeURIComponent(attemptId)}`;
  return {
    cancelUrl: getApplicationUrl(`/checkout/cancelado${query}`),
    expiredUrl: getApplicationUrl(`/checkout/expirado${query}`),
    successUrl: getApplicationUrl("/checkout/sucesso"),
  };
};
```

- [x] **Step 4: Resolver somente o snapshot do slug no retorno**

As páginas validam `searchParams: Promise<{ attemptId?: string }>` e consultam:

```sql
select checkout_course_slug
from orders
where id = $1 and provider = 'asaas'
limit 1
```

O CTA é `/comprar/${encodeURIComponent(slug)}`. Sem referência válida, mostrar contato
com Suporte ou login; não navegar para `/` e não criar tentativa automaticamente.

- [x] **Step 5: Confirmar retornos e regressão de sucesso**

Run: `bun test src/features/payments/checkout.test.ts src/app/checkout/cancelado/page.test.tsx src/app/checkout/expirado/page.test.tsx src/features/payments/checkout-ui-contract.test.ts`

Expected: PASS.

- [x] **Step 6: Registrar checkpoint sem commit**

Registrar `callbacks cancelado/expirado retornam ao link estável`.

### Task 12: Provar a jornada, atualizar documentação e executar gates

**Files:**
- Modify: `tests/e2e/critical-journeys.spec.ts`
- Modify: `scripts/seed-e2e.ts`
- Create: `scripts/e2e-asaas.ts`
- Create: `tests/e2e/payment-helpers.ts`
- Modify: `playwright.config.ts`
- Modify: `docs/Plano de migracao.md`
- Modify: `PRODUCT.md`
- Modify: `docs/decisions.md`
- Modify: `docs/domain/identity-and-authorization.md`
- Modify: `docs/domain/commerce-and-access.md`
- Modify: `docs/integrations/asaas.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `docs/reviews/2026-07-30-asaas-sprint-review.md`
- Modify: `docs/superpowers/specs/2026-07-30-public-course-purchase-handoff-design.md`

- [x] **Step 1: Escrever o E2E fake antes do ajuste de seed**

```ts
test("landing CTA handoff creates one checkout and activation", async ({ page, request }) => {
  const fixture = await readFixture();
  await page.goto(`/comprar/${fixture.course.slug}`);
  await expect(page.getByText("Preparando checkout")).toBeVisible();
  await page.waitForURL("http://127.0.0.1:4570/checkout/**");
  const checkoutId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const attemptId = checkoutId.replace(/^chk_/, "");
  expect(attemptId).toMatch(UUID_PATTERN);
  await sendPaidWebhook({ attemptId: String(attemptId), request });
  await runAsaasWorker(request);
  await expect.poll(() => readOrderOutcome(String(attemptId))).toEqual({
    activationCount: 1,
    buyerIdentityStatus: "resolved",
    grantCount: 1,
    status: "paid",
  });
});
```

Adicionar casos de dupla hidratação, acesso ativo, revogada, Conta bloqueada, equipe,
cancelamento/expiração e retry do mesmo evento.

- [x] **Step 2: Criar o servidor Asaas local determinístico**

`scripts/e2e-asaas.ts` usa `Bun.serve({ hostname: "127.0.0.1", port: 4570 })` e atende
somente estes contratos:

```ts
if (request.method === "POST" && url.pathname === "/v3/checkouts") {
  const body = (await request.json()) as { externalReference?: string };
  const reference = body.externalReference;
  if (!reference?.startsWith("order_")) return Response.json({}, { status: 422 });
  const id = `chk_${reference.slice("order_".length)}`;
  return Response.json({
    id,
    link: `http://127.0.0.1:4570/checkout/${encodeURIComponent(id)}`,
    status: "ACTIVE",
  });
}
if (request.method === "GET" && url.pathname === "/v3/customers/cus_e2e") {
  return Response.json({ email: "buyer-e2e@example.test", id: "cus_e2e", name: "Buyer E2E" });
}
if (request.method === "GET" && url.pathname.startsWith("/checkout/")) {
  return new Response("<!doctype html><title>Asaas E2E</title><h1>Checkout Asaas E2E</h1>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
return Response.json({}, { status: 404 });
```

O script não imprime body, token, nome ou e-mail.

- [x] **Step 3: Configurar Playwright e helpers financeiros**

Adicionar ao ambiente da aplicação E2E:

```ts
ASAAS_API_BASE_URL: "http://127.0.0.1:4570",
ASAAS_API_KEY: "e2e-asaas-access-token",
ASAAS_USER_AGENT: "hub-e2e/1.0",
ASAAS_WEBHOOK_ENABLED: "true",
ASAAS_WEBHOOK_TOKEN: "e2e-webhook-token-with-at-least-32-characters",
CRON_SECRET: "e2e-cron-secret",
PAYMENTS_CHECKOUT_MODE: "public",
SCHEDULED_JOBS_ENABLED: "true",
```

Adicionar `scripts/e2e-asaas.ts` como `webServer` em `http://127.0.0.1:4570`.
`sendPaidWebhook` envia exatamente:

```ts
await request.post("/api/webhooks/asaas", {
  data: {
    event: "PAYMENT_RECEIVED",
    id: `evt_${attemptId}`,
    payment: {
      billingType: "PIX",
      checkoutSession: `chk_${attemptId}`,
      customer: "cus_e2e",
      externalReference: `order_${attemptId}`,
      id: `pay_${attemptId}`,
      netValue: 10,
      status: "RECEIVED",
      value: 10,
    },
  },
  headers: { "asaas-access-token": "e2e-webhook-token-with-at-least-32-characters" },
});
```

`runAsaasWorker` chama `GET /api/cron/asaas-webhooks` com
`Authorization: Bearer e2e-cron-secret`. `readOrderOutcome` usa `pg.Pool` apontado
exclusivamente por `E2E_DATABASE_URL`, seleciona status/contagens por Pedido e fecha o pool
no teardown; falha se a variável não estiver presente.

- [x] **Step 4: Ajustar seed sem PII nos logs**

O Curso fixture deve estar `active`, preço `1000`, possuir publicação `published` e slug
estável. O seed retorna IDs no arquivo temporário já usado pela suíte e nunca imprime
nome/e-mail.

- [x] **Step 5: Rodar os testes focais completos**

Run:

```powershell
bun test src/features/payments/buyer-identity.test.ts src/db/asaas-schema-contract.test.ts src/features/payments/checkout.test.ts src/features/payments/public-checkout.test.ts src/app/api/checkouts/course/route.test.ts src/features/payments/purchase-handoff.test.ts 'src/app/comprar/[slug]/purchase-handoff-client.test.tsx' 'src/app/comprar/[slug]/page.test.tsx' src/features/payments/course-purchase-link.test.ts 'src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx' src/features/payments/asaas-client.test.ts src/features/payments/asaas-customer-enrichment.test.ts src/features/payments/asaas-webhook-worker.test.ts src/features/payments/asaas-webhook-processor.test.ts src/features/payments/order-identity.test.ts src/features/payments/payment-reviews.test.ts 'src/app/(admin)/admin/financeiro/page.test.tsx'
```

Expected: PASS.

- [x] **Step 6: Rodar E2E fake quando o servidor local estiver disponível**

Run: `bun run test:e2e -- --grep "landing CTA handoff"`

Expected: PASS. Não abrir URL local como apoio visual; a evidência é Playwright.

- [x] **Step 7: Atualizar contratos canônicos com fatos implementados**

Alterar linguagem `implementação pendente` para `implementado em código` somente onde os
testes correspondentes passaram. Em `docs/Plano de migracao.md`, registrar por etapa:

```md
- [x] Link estável e handoff sem formulário — testes unitários/E2E fake aprovados.
- [x] Identidade Asaas pós-evento — unitários e processor aprovados.
- [x] Conta de equipe/bloqueada/revogada — Revisão sem acesso aprovada.
- [ ] Homologação Sandbox real pós-mudança — aguarda ambiente alcançável sem deploy antecipado.
```

- [x] **Step 8: Executar gates locais amplos**

Run, nesta ordem:

```powershell
bun test
bun run typecheck
bun x ultracite check
bun run docs:check
bun run db:migrations:check
git diff --check
```

Expected: todos exit `0`. Se Ultracite indicar correção determinística, executar
`bun x ultracite fix`, revisar somente os arquivos tocados e repetir os gates.

- [x] **Step 9: Auditar cobertura requisito por requisito**

Conferir cada objetivo, decisão, seção de segurança, teste e critério de aceite da
especificação contra arquivo/teste/saída atual. Item sem evidência permanece aberto; não
usar ausência de falha como prova.

- [x] **Step 10: Parar antes de Sandbox/deploy e pedir autorização**

Sandbox real da nova implementação exige ambiente alcançável pelo Asaas. Como o usuário
proibiu merge/deploy antecipado para evitar custo, registrar o gate como pendente e pedir
autorização específica para o mecanismo de exposição escolhido. Não executar push, deploy,
webhook remoto ou banco persistente por conta própria.

- [x] **Step 11: Registrar checkpoint final sem commit**

Entregar arquivos alterados, comandos/saídas decisivas e riscos restantes. Nenhum commit é
feito até autorização explícita.

## Matriz de cobertura da especificação

- Link estável, GET sem mutação e POST automático: Tasks 4–6.
- Pedido/snapshots antes do provider, sem PII: Tasks 2–5.
- Student ativa, sem acesso, bloqueada/revogada e equipe: Tasks 3–5 e 9.
- `getCustomer`, minimização e classificação: Tasks 7–9.
- Transação sem I/O externo: Task 8.
- CAS, concorrência, Conta nova/não verificada e outbox: Task 9.
- Revisão sem aprovação, reembolso único e fechamento: Task 10.
- Cancelamento/expiração sem `/`: Task 11.
- Administração/cópia: Task 6.
- Unitários, HTTP, PostgreSQL, E2E, Sandbox e gates: Task 12.
- Nenhum formulário Hub, alteração de `/`, gifting, transferência ou PII adicional: Tasks
  3–5, 9 e auditoria da Task 12.
