# Default Learning Analytics Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep lesson-quality analytics enabled by default, offer a non-blocking opt-out in student settings, and remove individual reengagement.

**Architecture:** The domain keeps essential learning progress separate from analytics. Missing analytics preference means enabled; an explicit opt-out deletes identifiable raw analytics events and prevents future analytics processing for that Aluna. Admin sees only aggregate metrics per lesson and course version; no student list, contact workflow, or reengagement record remains.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Drizzle migrations, Vitest.

---

## Contract

- `lesson_progress` and `lesson_watch_progress` remain essential learning records; the preference never changes access, sequencing, completion, resume, or certificate behavior.
- Analytics defaults to enabled. A preference row exists only after the Aluna explicitly disables it.
- Opting out stops future analytics events, removes existing identifiable raw events for that Aluna, and excludes her essential progress from analytics-only aggregate queries. Already materialized daily metrics remain aggregate-only.
- The student surface is one compact control in account settings, not a sidebar destination, modal, or consent gate.
- `learning_reengagements`, its enum, actions, queries, and dashboard UI are removed. No personal inactivity list or analytics-driven contact remains.
- Production activation still requires a privacy notice and formal legal-basis ratification outside code. The preference is an objection/opt-out, never labelled consent.

## Test seams agreed for this change

1. Pure policy seam in `src/features/learning-analytics/rules.ts`: default-enabled and opt-out semantics.
2. Server/database seam in `src/features/learning-analytics/server.ts`: an explicit opt-out prevents insertion and removes identifiable raw events.
3. Rendered student setting seam: the user sees the current state and can submit the preference without navigating to a dedicated privacy page.
4. Rendered admin dashboard seam: aggregate metrics remain available while no person, inactivity list, or reengagement command is rendered.

## Task 1: Replace consent/reengagement schema with preference-only schema

**Files:**

- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0033_<generated>.sql`
- Modify: `src/db/migrations/meta/_journal.json` and generated snapshot
- Test: `scripts/check-migrations.ts` via `bun run db:migrations:check`

- [x] **Step 1: Write the migration from the domain contract**

```sql
alter table learning_analytics_consents rename to learning_analytics_preferences;
alter table learning_analytics_preferences rename column consented_at to enabled_at;
alter table learning_analytics_preferences rename column revoked_at to disabled_at;
drop table learning_reengagements;
drop type learning_reengagement_status;
```

- [ ] **Step 2: Generate/review Drizzle metadata**

Run: `bun x drizzle-kit generate --custom --name default_learning_analytics_preference` for the forward-only SQL. Before promotion, run `bun run db:generate` in an interactive terminal and confirm the real table/column renames so Drizzle can reconcile its snapshots without manual edits.

Expected: one forward-only `0033` migration and matching journal/snapshot; no existing migration is edited.

- [x] **Step 3: Align the TypeScript schema**

```ts
export const learningAnalyticsPreferences = pgTable(
  "learning_analytics_preferences",
  {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    enabledAt: timestamp("enabled_at", tz),
    disabledAt: timestamp("disabled_at", tz),
    policyVersion: text("policy_version").notNull(),
    ...timestamps,
  }
);
```

- [x] **Step 4: Verify migration integrity**

Run: `bun run db:migrations:check`

Expected: `Migrations validas.`

## Task 2: Change analytics policy and persistence to default-enabled opt-out

**Files:**

- Modify: `src/features/learning-analytics/rules.ts`
- Modify: `src/features/learning-analytics/rules.test.ts`
- Modify: `src/features/learning-analytics/server.ts`
- Create: `src/features/learning-analytics/server.test.ts`

- [x] **Step 1: Add failing pure-policy tests**

```ts
expect(isLearningAnalyticsEnabled({ disabledAt: null })).toBe(true);
expect(isLearningAnalyticsEnabled({ disabledAt: new Date() })).toBe(false);
```

- [x] **Step 2: Run the focused test and observe failure**

Run: `bun run test -- src/features/learning-analytics/rules.test.ts`

Expected: fail because the new policy function does not exist.

- [x] **Step 3: Implement the minimal pure policy**

```ts
export const isLearningAnalyticsEnabled = ({ disabledAt }: { disabledAt: Date | null }): boolean =>
  disabledAt === null;
```

- [x] **Step 4: Replace consent persistence/query contract**

```ts
export const setLearningAnalyticsPreference = async ({ enabled, userId }) => {
  if (!enabled) {
    await client.query("delete from learning_analytics_events where user_id = $1", [userId]);
  }
  await client.query(/* upsert disabled_at; missing row means enabled */);
};
```

`recordLearningAnalyticsEvent` must left join preferences and accept the event only when `disabled_at is null`. It must not join or write a consent row.

- [x] **Step 5: Add database-seam tests**

Cover: no preference records an event; disabled preference records none; disabling deletes that user’s raw events but never another user’s events.

- [x] **Step 6: Run focused tests**

Run: `bun run test -- src/features/learning-analytics`

Expected: all analytics policy and persistence tests pass.

## Task 3: Replace the student Privacy destination with a compact account preference

**Files:**

- Modify: `src/app/(student)/app/actions.ts`
- Modify: `src/app/(student)/app/layout.tsx`
- Delete: `src/app/(student)/app/privacidade/page.tsx`
- Delete: `src/app/(student)/app/privacidade/loading.tsx`
- Create: `src/app/(student)/app/configuracoes/page.tsx`
- Create: `src/app/(student)/app/configuracoes/page.test.tsx`

- [x] **Step 1: Write the rendered-setting test**

Assert the page presents an enabled-by-default status, an opt-out action, a privacy-notice link, and does not use the words “consentimento” or “autorizar”.

- [ ] **Step 2: Run the focused test and observe failure**

Run: `bun run test -- src/app/(student)/app/configuracoes/page.test.tsx`

Expected: fail because the settings route does not exist.

- [x] **Step 3: Implement server action and page**

The action calls `setLearningAnalyticsPreference({ enabled, userId })`. The page keeps a concise copy such as “Usamos dados mínimos de uso para melhorar as aulas. Você pode desativar análises opcionais.” The shell sidebar exposes only `Configurações`; it no longer exposes `Privacidade`.

- [x] **Step 4: Run focused test**

Run: `bun run test -- src/app/(student)/app/configuracoes/page.test.tsx`

Expected: pass.

## Task 4: Make the Admin surface aggregate-only and remove reengagement

**Files:**

- Modify: `src/features/learning-analytics/server.ts`
- Delete: `src/features/learning-analytics/actions.ts`
- Modify: `src/app/(admin)/admin/aprendizagem/page.tsx`
- Modify: `src/app/(admin)/admin/admin-sidebar-nav.tsx` only if its copy names reengagement
- Create: `src/app/(admin)/admin/aprendizagem/page.test.tsx`

- [x] **Step 1: Write the dashboard rendering test**

Assert lesson/version aggregate headings and CSV remain; assert student names, “14 dias”, “Registrar contato manual”, “Opt-out”, and contact forms are absent.

- [ ] **Step 2: Run it and observe failure**

Run: `bun run test -- src/app/(admin)/admin/aprendizagem/page.test.tsx`

Expected: fail while the personal reengagement sections exist.

- [x] **Step 3: Remove individual read/write paths**

Delete `getInactiveLearningEnrollments`, `initiateLearningReengagement`, `getOpenLearningReengagements`, `resolveLearningReengagement`, and their actions. In aggregate SQL, exclude users with `disabled_at is not null` from eligible and completion datasets, so opt-out applies to the analytics view as well as emitted events.

- [x] **Step 4: Run focused tests**

Run: `bun run test -- src/features/learning-analytics src/app/(admin)/admin/aprendizagem/page.test.tsx`

Expected: pass.

## Task 5: Update contracts, retention, and verification

**Files:**

- Modify: `src/features/privacy/server.ts`
- Modify: `CONTEXT.md`
- Modify: `PRODUCT.md`
- Modify: `docs/domain/learning-content-and-progress.md`
- Modify: `docs/adr/0008-optional-learning-analytics.md`
- Modify: `docs/architecture.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/deploy-and-incidents.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/README.md`
- Modify: `docs/decisions.md`

- [x] **Step 1: Remove reengagement retention fields and queries**

`runDataRetention` returns only aggregate/event cleanup counts. It continues aggregating daily metrics and deleting raw analytics after 90 days; it no longer references a deleted table.

- [x] **Step 2: Record the approved decision**

Document: default-enabled analytics preference, opt-out behavior, no individual reengagement, and the production prerequisite of legal-basis ratification plus a public notice. Do not claim legal compliance.

- [x] **Step 3: Update document verification commits**

Set `last_verified_commit` to an existing commit only. Do not invent a future hash; preserve a valid current commit until a later commit can verify the final state.

- [x] **Step 4: Run complete verification**

Run:

```bash
bun run db:migrations:check
bun run docs:check
bun run test
bun run typecheck
bun run check
bun run build
git diff --check
```

Expected: every command exits zero. If a migration must be applied to a shared database, stop after local verification and follow the controlled promotion runbook; do not apply it automatically.
