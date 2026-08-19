# Course Settings Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the course settings layout and align payment controls with the actual payment-offer decision flow.

**Architecture:** Keep one settings Card. Make the purchase-link component a copy-only action. Keep form state local for payment methods and installments, letting the existing FormData parser normalize an omitted installment field to `1x` when card is disabled.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Radix UI, TypeScript, Vitest, Bun.

---

### Task 1: Replace the purchase dropdown with its single valid action

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx`

- [x] **Step 1: Write the failing copy-only test.** Replace the checkout-anchor assertion with a direct trigger assertion:

```tsx
expect(button?.textContent).toContain("Link público");
expect(document.querySelector(`a[href="${publicUrl}"]`)).toBeNull();
```

- [x] **Step 2: Verify RED.** Run:

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx"
```

Expected: the dropdown implementation still exposes the checkout anchor.

- [x] **Step 3: Implement the direct copy action.** Remove DropdownMenu, `ViewIcon`, open-state logic, and checkout anchor. Keep `handleCopy`, the screen-reader-labelled fallback input, focus/select fallback, and Sonner success/error feedback on one outline Button.

- [x] **Step 4: Verify GREEN.** Re-run the focused test; expected all copy, fallback, unavailable-state, and no-anchor tests pass.

### Task 2: Lock the payment decision flow at the form seam

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx`

- [x] **Step 1: Write the card-disabled form test.** Render the form, turn card off, submit it, and assert the captured FormData has no `paymentMaxInstallmentCount` and no `paymentAllowCreditCard` value.

- [x] **Step 2: Write the restoration test.** Turn card off and on, then assert the installment input is rendered again with its original course value. Attempting to deselect the only remaining enabled method must leave it checked.

- [x] **Step 3: Verify RED.** Run:

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx"
```

Expected: card remains uncontrolled and the installment field is always shown.

### Task 3: Correct hierarchy and control state in the settings form

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`
- Test: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx`

- [x] **Step 1: Repair the identity grid.** Replace `lg:grid-cols-[240px_minmax(0,1fr)]` with a `280px` cover column. Move the description Field into the right-hand field group after title and subtitle so it shares one vertical editing column with them.

- [x] **Step 2: Compact workload into the access grid.** Render workload first and access duration second. Move status into the footer beside save. The trigger shows only the current resolved hour count and opens a dialog with automatic/manual selection; the manual field is disabled in automatic mode. Remove the standalone rounded workload summary surface.

- [x] **Step 3: Order payment inputs by dependency.** Initialize local state from `course.paymentAllowPix`, `course.paymentAllowCreditCard`, and `course.paymentMaxInstallmentCount`. Render price, then Pix/card checkboxes, then a visible `1x`–`12x` installment Select. Keep it visible but disabled when card is off, disable options above the current price-supported maximum, preserve the selected value in local state, and omit the disabled named input so the existing server fallback persists `1x`.

- [x] **Step 4: Keep existing contracts.** Preserve payment field names, `paymentOfferPresent`, max/min attributes, payment warning calculation, price confirmation snapshot, and final save action. Correct copied strings only in the touched surface.

- [x] **Step 5: Verify GREEN.** Re-run the focused form test. Expected: conditional installment behavior, price confirmation, workload behavior, and existing payment warnings all pass.

### Task 4: Reconcile page and documentation

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- Modify: `docs/superpowers/specs/2026-08-16-course-settings-layout-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-course-settings-layout.md`

- [x] **Step 1: Keep one surface with a direct copy action.** The page header continues to place `CoursePurchaseLink` next to its title, but no longer communicates a checkout-navigation action.

- [x] **Step 2: Mark implementation steps complete.** Update this plan only after successful verification; preserve the approved design contract in the companion specification.

### Task 5: Verify the completed revision

**Files:**
- Verify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`
- Verify: `src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.tsx`
- Verify: `src/app/(admin)/admin/cursos/[courseId]/course-workload-dialog.tsx`

- [x] **Step 1: Run format and lint.**

```powershell
bun x ultracite fix
bun x ultracite check
```

- [x] **Step 2: Run focused checks.**

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-workload-dialog.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/page.test.tsx"
```

- [x] **Step 3: Run repository checks.**

```powershell
bun typecheck
bun run docs:check
bun run test
git diff --check
```

- [x] **Step 4: Inspect final state.** Run `git status --short`; do not commit unless the user explicitly asks.

Result: focused checks, formatting, static validation, type checking, and documentation validation pass. The full suite passes with `bunx vitest run` (237 files, 1,572 tests). The package alias `bun test` remains incompatible with this Bun runner (`vi.hoisted` and `vi.stubEnv` unavailable) and was interrupted after those pre-existing failures.

## Refinement pass — 2026-08-16

- [x] Rename the purchase action to `Link público` and move success/fallback feedback to Sonner.
- [x] Reorder access controls, moving status beside the save action in the footer.
- [x] Add automatic/manual workload selection and keep the manual field disabled in automatic mode.
- [x] Keep the installment selector visible when card is disabled, while disabling the control.
- [x] Replace numeric installment input with a `1x`–`12x` selector and disable options above the price-supported limit, updating as the price is edited.
- [x] Extend focused tests and update the approved design contract.
