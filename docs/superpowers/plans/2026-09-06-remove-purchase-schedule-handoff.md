# Remover cronograma visual do handoff de compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar o handoff de compra como redirecionamento automático, sem exibir o cronograma de liberação, preservando o snapshot e a validação server-side do checkout.

**Architecture:** O Server Component continuará calculando o snapshot e o digest da publicação vigente. O Client Component receberá somente o digest invisível, iniciará o POST automaticamente e continuará usando o fluxo existente de tentativa, polling, retry e redirect seguro. O retorno `schedule_changed` será tratado como indisponibilidade genérica para não exibir informações do cronograma.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, jsdom, Bun.

---

### Task 1: Atualizar os testes do handoff para o comportamento automático

**Files:**
- Modify: `src/app/comprar/[slug]/purchase-handoff-client.test.tsx`

- [ ] **Step 1: Substituir o helper de renderização para passar apenas o digest**

Remover o import de `ContentReleaseScheduleSnapshot`, remover `RELEASE_SCHEDULE`, remover o parâmetro `releaseSchedule` de `renderHandoff` e renderizar o componente somente com:

```tsx
<PurchaseHandoffClient
  courseSlug="curso-publico"
  courseTitle="Curso publico"
  releaseScheduleDigest={releaseScheduleDigest}
/>
```

- [ ] **Step 2: Executar o teste focado para observar as falhas esperadas**

Run:

```powershell
bun run test -- "src/app/comprar/[slug]/purchase-handoff-client.test.tsx"
```

Expected: FAIL because the current component still requires `releaseSchedule` and the current delayed-schedule tests expect the removed review UI.

- [ ] **Step 3: Reescrever o teste de cronograma atrasado para exigir POST automático**

Substituir o teste `shows a delayed schedule and waits for explicit payment confirmation` por um teste que configure apenas um digest, responda `ready`, renderize o componente e confirme:

```tsx
expect(fetchMock).toHaveBeenCalledOnce();
expect(container.textContent).not.toContain("Cronograma de liberação");
expect(container.textContent).not.toContain("Continuar para pagamento");
expect(
  JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
).toMatchObject({
  expectedContentReleaseScheduleDigest: releaseScheduleDigest,
});
```

Também confirmar o redirect para a URL retornada.

- [ ] **Step 4: Substituir o teste de `schedule_changed` por erro genérico**

Renderizar o componente com o digest, responder `{ retryAllowed: false, status: "schedule_changed" }` no POST automático e confirmar:

```tsx
expect(container.textContent).toContain("Checkout indisponivel");
expect(container.textContent).not.toContain("cronograma");
expect(container.querySelector("button")).toBeNull();
```

- [ ] **Step 5: Atualizar asserções dos testes existentes**

Nos testes que verificam o body do POST, remover somente o campo `releaseSchedule` do helper; manter a asserção de `expectedContentReleaseScheduleDigest`. Nenhum teste de polling, retry, Strict Mode, storage ou redirect seguro deve perder sua cobertura.

- [ ] **Step 6: Rodar novamente o teste focado**

Run:

```powershell
bun run test -- "src/app/comprar/[slug]/purchase-handoff-client.test.tsx"
```

Expected: FAIL only because the component implementation still has the old props/state. The failure must be about the component contract or delayed-review expectation, not test setup.

### Task 2: Remover a apresentação e restaurar o disparo automático

**Files:**
- Modify: `src/app/comprar/[slug]/purchase-handoff-client.tsx`
- Modify: `src/app/comprar/[slug]/page.tsx`

- [ ] **Step 1: Reduzir o contrato do Client Component ao digest**

Remover o import de `ContentReleaseScheduleSnapshot` e `hasDelayedModules`. Alterar as props para:

```tsx
export function PurchaseHandoffClient({
  courseSlug,
  courseTitle,
  releaseScheduleDigest,
}: {
  courseSlug: string;
  courseTitle: string;
  releaseScheduleDigest: string;
}): React.JSX.Element {
```

- [ ] **Step 2: Remover o estado de revisão e manter o estado de erro genérico**

Remover `{ kind: "review" }` de `HandoffState`, remover o caso `schedule_changed` de `CheckoutResponse` somente se ele puder ser convertido diretamente em indisponibilidade no parser; caso contrário, manter o tipo interno e fazer `getCheckoutOutcome` retornar `{ kind: "unavailable" }` para esse status.

O resultado público não deve conter texto ou ação específica sobre cronograma.

- [ ] **Step 3: Enviar o digest sem condicionar o início do checkout**

Manter no body do POST:

```tsx
body: JSON.stringify({
  checkoutAttemptId,
  courseSlug,
  expectedContentReleaseScheduleDigest: releaseScheduleDigest,
}),
```

Remover a inicialização condicional com `hasDelayedModules(releaseSchedule)` e fazer o `useEffect` sempre chamar `startCheckout(false)`, como no comportamento anterior.

- [ ] **Step 4: Remover o bloco visual do cronograma**

No JSX, manter somente o título do Curso e os estados operacionais já existentes: inicialização, processamento, retry e indisponibilidade. Remover a seção com `aria-labelledby="purchase-release-schedule-heading"`, o texto de liberação progressiva, a lista de módulos, o estado `review` e o botão `Continuar para pagamento`.

- [ ] **Step 5: Ajustar a página Server Component**

Em `src/app/comprar/[slug]/page.tsx`, continuar obtendo `view.releaseScheduleDigest`, mas passar somente:

```tsx
<PurchaseHandoffClient
  courseSlug={view.courseSlug}
  courseTitle={view.courseTitle}
  releaseScheduleDigest={view.releaseScheduleDigest}
/>
```

Não remover `releaseSchedule` nem `releaseScheduleDigest` do `PurchaseHandoffView`, do snapshot do Pedido ou do serviço server-side.

- [ ] **Step 6: Executar o teste focado e verificar GREEN**

Run:

```powershell
bun run test -- "src/app/comprar/[slug]/purchase-handoff-client.test.tsx"
```

Expected: PASS, incluindo o teste com D+N disparando o POST automaticamente e o teste de mudança de digest sem revelar o cronograma.

### Task 3: Verificação de escopo e qualidade

**Files:**
- Verify: `src/app/comprar/[slug]/purchase-handoff-client.tsx`
- Verify: `src/app/comprar/[slug]/page.tsx`
- Verify: `src/app/comprar/[slug]/purchase-handoff-client.test.tsx`

- [ ] **Step 1: Confirmar que o backend do checkout permaneceu intacto**

Run:

```powershell
git diff -- src/features/payments src/db src/app/api/checkouts
```

Expected: no output. O snapshot, digest, validação de igualdade e persistência do Pedido não devem ser alterados.

- [ ] **Step 2: Rodar o teste de handoff e as verificações estáticas focadas**

Run:

```powershell
bun run test -- "src/app/comprar/[slug]/purchase-handoff-client.test.tsx" "src/app/comprar/[slug]/page.test.tsx" src/features/payments/purchase-handoff.test.ts
bun typecheck
bun x ultracite check
```

Expected: all commands pass without warnings introduced by this change.

- [ ] **Step 3: Confirmar o diff final**

Run:

```powershell
git diff --check
git diff --stat
git status --short
```

Expected: only the approved handoff component, page/test updates, and the uncommitted specification/plan files are present; no migration, API contract or unrelated file is changed.
