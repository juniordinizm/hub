# Course Management Tabs Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Course management shell, Overview, Content builder, and responsive Certificate editor so every action is contextual, every metric is exact, and dense workflows remain usable across screen sizes.

**Architecture:** Keep the existing server-rendered Course page and pass its panels into a small client-owned Tabs shell that synchronizes `?tab=` with the native History API. Replace Overview counts derived from capped operational lists with one aggregate projection and a pure operational-state view model. Preserve the Certificate editor's desktop architecture while composing its existing inspector inside a bottom Sheet below the desktop breakpoint.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Tailwind CSS v4, Radix UI, dnd-kit, Sonner, Vitest, Bun.

---

## File responsibility map

- `src/features/admin/server.ts`: authenticated Course reads and exact aggregate Overview projection.
- `src/features/admin/presentation.ts`: pure Course operational-state and module-summary derivation.
- `src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.tsx`: URL-synchronized tab shell only.
- `src/app/(admin)/admin/cursos/[courseId]/course-overview.tsx`: Overview composition only.
- `src/app/(admin)/admin/cursos/[courseId]/course-content-panel.tsx`: curricular publication state, contextual actions, and Course builder entry point.
- `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`: Module and Lesson presentation and dialogs.
- `src/components/course-builder-dnd.tsx`: optimistic ordering, expansion state, accessible drag handles, and persistence feedback.
- `src/hooks/use-media-query.ts`: reusable, hydration-safe media query state.
- `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`: responsive placement of the existing Certificate inspector.
- `src/app/(admin)/admin/cursos/[courseId]/page.tsx`: data orchestration and panel composition, without embedded panel markup.

The existing `Settings` and `Students` panel implementations remain unchanged.

### Task 1: Replace capped Overview counts with an exact aggregate projection

**Files:**
- Modify: `src/features/admin/server.ts`
- Modify: `src/features/admin/server-read-projections.test.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.test.tsx`

- [x] **Step 1: Write the failing aggregate projection test.** Import `getAdminCourseOverviewSummary`, return one mocked row, and assert the normalized result and exact status predicates:

```ts
it("returns exact Course overview totals from one aggregate query", async () => {
  query.mockResolvedValue({
    rows: [
      {
        active_enrollment_count: 57,
        paid_order_count: 83,
        valid_certificate_count: 41,
      },
    ],
  });

  await expect(getAdminCourseOverviewSummary(courseId)).resolves.toEqual({
    activeEnrollmentCount: 57,
    paidOrderCount: 83,
    validCertificateCount: 41,
  });

  const sql = String(query.mock.calls[0]?.[0]);
  expect(sql).toContain("status = 'active'");
  expect(sql).toContain("status = 'paid'");
  expect(sql).toContain("status = 'valid'");
  expect(sql).not.toContain("limit 40");
  expect(query.mock.calls[0]?.[1]).toEqual([courseId]);
});
```

- [x] **Step 2: Run the projection test and verify RED.**

```powershell
bunx vitest run "src/features/admin/server-read-projections.test.ts"
```

Expected: import/export failure for `getAdminCourseOverviewSummary`.

- [x] **Step 3: Add the aggregate contract and query.** Define and export:

```ts
export interface AdminCourseOverviewSummary {
  activeEnrollmentCount: number;
  paidOrderCount: number;
  validCertificateCount: number;
}

export const getAdminCourseOverviewSummary = async (
  courseId: string
): Promise<AdminCourseOverviewSummary> => {
  await requireAdminReadAccess();
  const { rows } = await getPool().query<{
    active_enrollment_count: number;
    paid_order_count: number;
    valid_certificate_count: number;
  }>(
    `select
       (select count(*)::int from enrollments where course_id = $1 and status = 'active') as active_enrollment_count,
       (select count(*)::int from orders where course_id = $1 and status = 'paid') as paid_order_count,
       (select count(*)::int from certificates where course_id = $1 and status = 'valid') as valid_certificate_count`,
    [courseId]
  );
  const summary = rows[0];

  return {
    activeEnrollmentCount: summary?.active_enrollment_count ?? 0,
    paidOrderCount: summary?.paid_order_count ?? 0,
    validCertificateCount: summary?.valid_certificate_count ?? 0,
  };
};
```

- [x] **Step 4: Stop loading Orders and Certificates through Course detail.** Remove `orders` and `certificates` from `getAdminCourseDetailData`; retain `enrollments` because the excluded Students panel still consumes the full list. Update its projection test from six to four detail queries and remove list assertions that no longer belong to this read model.

- [x] **Step 5: Add the summary to the page dependency mock.** Update `page.test.tsx` so the page receives exact totals independently from the detail lists.

- [x] **Step 6: Verify GREEN.** Re-run both focused tests. Expected: projection and page tests pass without any count depending on a 40-row limit.

- [ ] **Step 7: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/features/admin/server.ts" "src/features/admin/server-read-projections.test.ts" "src/app/(admin)/admin/cursos/[courseId]/page.test.tsx"
git commit -m "fix(admin): use exact course overview metrics"
```

### Task 2: Derive one actionable Course operational state

**Files:**
- Modify: `src/features/admin/presentation.ts`
- Modify: `src/features/admin/presentation.test.ts`

- [x] **Step 1: Write the failing state-priority tests.** Cover identity, curriculum, publication, commercial availability, inactive Course, pending draft, and ready state:

```ts
const readyInput = {
  hasDescription: true,
  hasDraft: false,
  hasPublished: true,
  hasReadyLesson: true,
  hasThumbnail: true,
  moduleCount: 2,
  purchaseLink: {
    available: true as const,
    url: "https://hub.example/comprar/curso",
  },
  status: "active",
};

expect(
  getAdminCourseOperationalState({ ...readyInput, hasThumbnail: false })
).toMatchObject({ actionTab: "settings", key: "identity_incomplete" });
expect(
  getAdminCourseOperationalState({ ...readyInput, hasReadyLesson: false })
).toMatchObject({ actionTab: "content", key: "content_incomplete" });
expect(
  getAdminCourseOperationalState({ ...readyInput, hasDraft: true })
).toMatchObject({ actionTab: "content", key: "changes_pending" });
expect(getAdminCourseOperationalState(readyInput)).toMatchObject({
  actionTab: null,
  key: "ready",
});
```

- [x] **Step 2: Verify RED.**

```powershell
bunx vitest run "src/features/admin/presentation.test.ts"
```

Expected: `getAdminCourseOperationalState` is missing.

- [x] **Step 3: Implement the pure view model.** Add explicit union types and return the first blocking state in this order: identity, structure/content, published publication, invalid price, inactive Course, checkout unavailable, pending draft, ready. Use localized copy and only `settings` or `content` as action destinations.

```ts
export type AdminCourseActionTab = "content" | "settings";
export type AdminCourseOperationalStateKey =
  | "identity_incomplete"
  | "content_incomplete"
  | "publication_missing"
  | "commercial_incomplete"
  | "course_inactive"
  | "checkout_unavailable"
  | "changes_pending"
  | "ready";

export interface AdminCourseOperationalState {
  actionLabel: string | null;
  actionTab: AdminCourseActionTab | null;
  description: string;
  key: AdminCourseOperationalStateKey;
  label: string;
  tone: "attention" | "healthy" | "watch";
}
```

The function receives the already-derived `CoursePurchaseLink`, so price and environment availability remain owned by the payment feature instead of being reimplemented in presentation code.

- [x] **Step 4: Verify state priority and copy.** Re-run the focused presentation test; expected all previous content-signal tests and new operational-state tests pass.

- [ ] **Step 5: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/features/admin/presentation.ts" "src/features/admin/presentation.test.ts"
git commit -m "feat(admin): derive course operational state"
```

### Task 3: Synchronize Course tabs with the URL without discarding Certificate state

**Files:**
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.test.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.test.tsx`

- [x] **Step 1: Write failing URL-state tests.** In jsdom, mock `useSearchParams` with a mutable URL, render the shell, and prove valid, invalid, history, and Certificate preservation behavior:

```tsx
const findTab = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (tab) => tab.textContent === label
  );

expect(findTab("Conteúdo")?.getAttribute("data-state")).toBe("active");
act(() => findTab("Certificado")?.click());
expect(window.location.search).toBe("?tab=certificate");
expect(
  container.querySelector('[data-testid="certificate-stateful-panel"]')
).not.toBeNull();
act(() => window.history.back());
window.dispatchEvent(new PopStateEvent("popstate"));
expect(findTab("Conteúdo")?.getAttribute("data-state")).toBe("active");
```

- [x] **Step 2: Verify RED.**

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.test.tsx"
```

Expected: the new shell does not exist.

- [x] **Step 3: Implement the focused client shell.** Use a literal allowlist, `useSearchParams`, and `window.history.pushState`; omit `tab=overview` to keep the canonical URL short.

```tsx
"use client";

const COURSE_TABS = [
  "overview",
  "content",
  "students",
  "settings",
  "certificate",
] as const;
type CourseTab = (typeof COURSE_TABS)[number];

const normalizeCourseTab = (value: string | null): CourseTab =>
  COURSE_TABS.includes(value as CourseTab) ? (value as CourseTab) : "overview";

const changeTab = (value: string, searchParams: URLSearchParams): void => {
  const params = new URLSearchParams(searchParams.toString());
  if (value === "overview") {
    params.delete("tab");
  } else {
    params.set("tab", value);
  }
  const query = params.toString();
  window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
};
```

Use `value={normalizeCourseTab(searchParams.get("tab"))}` on Tabs. Give the list `variant="line"`, `max-w-full`, horizontal overflow, and no wrapping. Give the Certificate `TabsContent` `forceMount` plus `data-[state=inactive]:hidden` so its form remains mounted and inaccessible while inactive rather than losing unsaved changes.

- [x] **Step 4: Move all five panels into shell props.** Accept `ReactNode` props named after the tabs. This keeps server-rendered panels outside the client module while giving the shell ownership of selection only.

- [x] **Step 5: Simplify the global header.** Remove the content signal and curricular forms. Keep the localized Course status and `Ver como aluno`; allow actions to wrap below the title at narrow widths.

- [x] **Step 6: Verify GREEN.** Run shell and page tests. Expected: URL state, default fallback, back/forward, five panel labels, and mounted hidden Certificate all pass.

- [ ] **Step 7: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/page.tsx" "src/app/(admin)/admin/cursos/[courseId]/page.test.tsx"
git commit -m "refactor(admin): contextualize course management tabs"
```

### Task 4: Build the actionable Overview panel

**Files:**
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-overview.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-overview.test.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`

- [x] **Step 1: Write failing Overview composition tests.** Assert three exact metrics, one next action, the compact curriculum summary, and no workload KPI:

```tsx
expect(markup).toContain("57");
expect(markup).toContain("Matrículas ativas");
expect(markup).toContain("83");
expect(markup).toContain("Pedidos pagos");
expect(markup).toContain("41");
expect(markup).toContain("Certificados válidos");
expect(markup).toContain("Abrir Conteúdo");
expect(markup).not.toContain("Checklist mínimo");
expect(markup).not.toContain("Carga horária</p>");
```

- [x] **Step 2: Verify RED.**

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-overview.test.tsx"
```

Expected: `CourseOverview` does not exist.

- [x] **Step 3: Implement one state card and three metrics.** `CourseOverview` receives the exact summary, operational state, content summary, module count, workload, and publication state. Render the action as a real link to `?tab=settings` or `?tab=content`; use the project route helper and preserve the current Course pathname.

- [x] **Step 4: Add the compact curriculum summary.** Show `Módulos`, `Aulas`, `Duração` and `Publicação` as four aligned values inside one Card section. Use `formatLessonDuration` for curriculum duration and tabular numbers for comparisons.

- [x] **Step 5: Remove obsolete presentation helpers from the route surface.** Stop rendering the old readiness progress bar and status card. Remove `ContentStatusCard` and `InfoTile` only if repository search proves they have no remaining consumers; retain shared helpers still used elsewhere.

- [x] **Step 6: Verify GREEN.** Re-run Overview and page tests; expected semantic `h2`, one actionable state, three exact metrics, and no capped list-derived counts.

- [ ] **Step 7: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/app/(admin)/admin/cursos/[courseId]/course-overview.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-overview.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx" "src/app/(admin)/admin/cursos/[courseId]/page.tsx"
git commit -m "refactor(admin): make course overview actionable"
```

### Task 5: Move curricular publication into the Content workflow

**Files:**
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-content-panel.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-content-panel.test.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`

- [x] **Step 1: Write failing publication-context tests.** Cover no draft, active draft, and empty Course states:

```tsx
expect(noDraftMarkup).toContain("Preparar alterações");
expect(noDraftMarkup).toContain("Prepare alterações para editar o currículo");
expect(noDraftMarkup).not.toContain("Novo módulo");
expect(draftMarkup).toContain("Alterações em preparo");
expect(draftMarkup).toContain("Publicar alterações");
expect(draftMarkup).toContain("Novo módulo");
```

- [x] **Step 2: Verify RED.**

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-content-panel.test.tsx"
```

Expected: `CourseContentPanel` does not exist.

- [x] **Step 3: Implement the Content header and publication state.** Render the content signal, publication badge, and exactly one contextual primary publication action. Keep `Novo módulo` beside authoring controls only when `hasDraft` is true.

- [x] **Step 4: Replace the plain empty paragraph.** Use the shared `Empty` component. Without a draft, its action prepares changes. With a draft, its action opens `CreateModuleDialog` and says `Criar primeiro módulo`.

- [x] **Step 5: Thread editability into the builder.** Add `editable={publicationState.hasDraft}` to `CourseBuilderWrapper`; disabled actions explain that a draft is required instead of failing only after submission.

- [x] **Step 6: Verify GREEN.** Re-run content panel and page tests; expected publication actions exist only inside Content and empty states always offer one valid next step.

- [ ] **Step 7: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/app/(admin)/admin/cursos/[courseId]/course-content-panel.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-content-panel.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx" "src/app/(admin)/admin/cursos/[courseId]/page.tsx"
git commit -m "refactor(admin): move publication into course content"
```

### Task 6: Replace the rigid Lesson table with collapsible responsive Modules

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`
- Create: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx`
- Modify: `src/components/course-builder-dnd.tsx`
- Modify: `src/components/sortable-list.tsx`
- Test: `src/components/course-builder-reorder.test.ts`

- [x] **Step 1: Write failing Module and Lesson presentation tests.** Render long titles and assert semantic expansion, summary metadata, responsive row structure, and accessible edit/reorder labels:

```tsx
expect(container.querySelector('button[aria-expanded="true"]')).not.toBeNull();
expect(container.textContent).toContain("3 aulas");
expect(container.textContent).toContain("42 min");
expect(
  container.querySelector('button[aria-label="Reordenar aula Introdução"]')
).not.toBeNull();
expect(container.querySelector("table")).toBeNull();
```

- [x] **Step 2: Verify RED.**

```powershell
bunx vitest run "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx" "src/components/course-builder-reorder.test.ts"
```

Expected: Modules are always open and Lessons still render as table cells.

- [x] **Step 3: Convert `LessonRow` into a complete responsive row.** Use a compact grid at `md` and a stacked layout below it. Combine content types into one secondary string, keep `Sem conteúdo` as an attention badge, include required/optional state, and retain the existing Lesson edit route.

- [x] **Step 4: Add controlled Module expansion to `CourseBuilderClient`.** Initialize the first Module as open. Keep a `Set<string>` of expanded IDs, preserve open state across optimistic reorder, and open the destination Module when a Lesson moves into it.

- [x] **Step 5: Rebuild each Module card.** The persistent header contains a separate expansion button, summary, `Nova aula`, and secondary edit action. The expansion button owns `aria-expanded` and `aria-controls`; Module actions remain siblings and never nest interactive elements.

- [x] **Step 6: Replace Lesson table DnD markup.** Add a local sortable Lesson wrapper using `useSortable`; its handle is a real Button with the Lesson title in `aria-label`. Preserve the existing `data={{ type: "lesson" }}`, keyboard sensor, reorder grouping, optimistic rollback, and DragOverlay.

- [x] **Step 7: Make Module drag handles semantic.** Change `SortableItem`'s handle from a `div` to a named `button type="button"`, accept an `ariaLabel` prop, apply `touch-manipulation`, and provide `size-10 md:size-10` with a touch breakpoint that reaches 44 px.

- [x] **Step 8: Expose persistence state.** While `isPending`, show `Salvando ordem…` with `aria-live="polite"` in the builder header area and prevent another drag. Keep Sonner error handling and rollback; do not add success toasts.

- [x] **Step 9: Verify GREEN.** Run component, reorder, and content panel tests. Expected: no Course Lesson table, accessible expansion and drag controls, unchanged reorder payloads, rollback on failure, and no fixed-width overflow contract.

- [ ] **Step 10: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx" "src/components/course-builder-dnd.tsx" "src/components/sortable-list.tsx" "src/components/course-builder-reorder.test.ts"
git commit -m "refactor(admin): simplify course curriculum builder"
```

### Task 7: Compose the Certificate inspector into a bottom Sheet on compact screens

**Files:**
- Create: `src/hooks/use-media-query.ts`
- Create: `src/hooks/use-media-query.test.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [x] **Step 1: Write the failing media-query hook test.** Mock `matchMedia`, render a probe, dispatch a change, and assert hydration-safe false followed by the actual value.

- [x] **Step 2: Implement the generic hook.**

```ts
import { useEffect, useState } from "react";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = (): void => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
};
```

- [x] **Step 3: Write the failing compact editor test.** Mock `useMediaQuery` to return true, select `studentName`, and assert one bottom Sheet contains the existing inspector while the desktop properties panel is absent:

```tsx
expect(document.body.querySelector('[data-mobile-properties-sheet="true"]')).not.toBeNull();
expect(document.body.querySelector('[data-field-inspector="studentName"]')).not.toBeNull();
expect(container.querySelector('[data-properties-panel="true"]')).toBeNull();
```

Close and reopen the Sheet, then assert the selected field and hidden `spec` value remain unchanged.

- [x] **Step 4: Verify RED.**

```powershell
bunx vitest run "src/hooks/use-media-query.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"
```

Expected: no media-query hook and no compact properties Sheet.

- [x] **Step 5: Extract one reusable inspector node.** In `CertificateTemplateForm`, build the existing diagnostics plus `CertificateTemplateFields` once through a focused local component. Render it in the desktop side panel when `useMediaQuery("(max-width: 1023px)")` is false, or in `SheetContent side="bottom"` when compact.

- [x] **Step 6: Define Sheet behavior.** Selecting a field or background opens the Sheet. Closing it clears only the Sheet open state, not `selectedField`, `backgroundSelected`, fields, uploads, or dirty history. Cap its height with `max-h-[85dvh]`, keep its body scrollable, and include a title naming the selected field or `Arte de fundo`.

- [x] **Step 7: Correct compact control targets and input sizing.** Preview toolbar controls use `size-11 lg:size-6` or equivalent hit-area wrappers. Inspector inputs use `text-base lg:text-xs` and retain their compact desktop height only at `lg`. Keep all existing `aria-label`, tooltip, and form names.

- [x] **Step 8: Verify GREEN and regression behavior.** Re-run the full Certificate editor test. Expected: compact Sheet tests and all current save, publish, upload, overlap, keyboard, and beforeunload tests pass.

- [ ] **Step 9: Checkpoint commit only after explicit user authorization.**

```powershell
git add -- "src/hooks/use-media-query.ts" "src/hooks/use-media-query.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-fields.tsx" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx"
git commit -m "refactor(admin): adapt certificate inspector for mobile"
```

### Task 8: Reconcile documentation and verify the complete refactor

**Files:**
- Modify: `docs/superpowers/specs/2026-08-16-course-management-tabs-refactor-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-course-management-tabs-refactor.md`
- Verify all files changed in Tasks 1–7

- [ ] **Step 1: Update implementation evidence.** Set the specification's `last_verified_commit` only after the final implementation commit exists. Check completed plan boxes only after their decisive commands pass.

- [x] **Step 2: Run formatting and static checks.**

```powershell
bun x ultracite fix
bun x ultracite check
bun run typecheck
bun run docs:check
```

Expected: all commands exit 0.

- [x] **Step 3: Run the focused regression suite.**

```powershell
bunx vitest run "src/features/admin/server-read-projections.test.ts" "src/features/admin/presentation.test.ts" "src/app/(admin)/admin/cursos/[courseId]/course-management-tabs.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-overview.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-content-panel.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx" "src/components/course-builder-reorder.test.ts" "src/hooks/use-media-query.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/page.test.tsx"
```

Expected: all selected files pass with no skipped tests.

- [x] **Step 4: Run the complete test and build gates.**

```powershell
bunx vitest run
bun run build
git diff --check
```

Expected: full Vitest suite and production build pass; diff check prints nothing.

- [x] **Step 5: Perform source-level responsive and accessibility review.** Because the project forbids opening a local URL, inspect rendered contracts through tests and source only. Confirm:

```text
320 px: no fixed Lesson table widths; tabs remain one horizontal strip.
768 px: Module headers wrap without nesting buttons; Lesson metadata stacks.
1024 px: Certificate switches from bottom Sheet to side inspector.
Desktop: Overview uses one state block, three metrics, and one curriculum summary.
Keyboard: tabs, Module disclosures, drag handles, menus, and Certificate controls retain visible focus and names.
```

- [x] **Step 6: Inspect final repository state.** Run `git status --short` and confirm only approved files changed. Do not commit, merge, or push unless the user explicitly requests it.
