# Certificate Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the certificate completion and outbox races, add explicit Admin reconciliation, restore CI, close security and UX gaps, and prove the complete certificate story before Production.

**Architecture:** Keep the existing `CourseCompletion` + immutable `Certificate` + transactional outbox design. Serialize completion decisions with the existing Conta + Curso advisory lock, make outbox terminal transitions fenced and atomic, and introduce an explicit bounded reconciliation command for historical completions. Preserve provider IO outside database transactions and use guarded E2E-only seams instead of real Resend delivery in CI.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, PostgreSQL/Neon, `pg`, Vitest, Playwright, Sentry 10, R2/S3, Resend, shadcn UI, Bun.

---

### Task 1: Restore the browser-journey fixture contract

**Files:**
- Modify: `scripts/seed-e2e.ts`
- Test: `tests/e2e/critical-journeys.spec.ts`

- [ ] **Step 1: Add a fixture assertion that proves the seeded commercial Course is available**

After `readFixture()` in the first checkout journey, request `/comprar/${fixture.course.slug}` and assert the handoff reaches the checkout preparation state. Keep the existing assertions; the failure must continue to reproduce the current CI symptom.

- [ ] **Step 2: Run the affected Playwright journey and confirm RED**

Run in the isolated E2E environment used by CI:

```powershell
bun run test:e2e -- --grep "landing CTA handoff"
```

Expected: failure because the seeded Course has `sales_status=closed` and `catalog_visibility=hidden`.

- [ ] **Step 3: Make the seed explicit**

Change the main E2E Course insert to include:

```sql
catalog_visibility, sales_status
```

with values:

```sql
'listed'::course_catalog_visibility, 'open'::course_sales_status
```

Do not change certificate-only fixture Courses that are intentionally not sold.

- [ ] **Step 4: Run seed/type checks locally**

```powershell
bun run typecheck
bun run test -- src/features/payments/purchase-handoff.test.ts src/features/payments/checkout.test.ts
```

Expected: both commands pass. Full Playwright verification remains in Task 8 because it requires CI’s disposable Neon/R2 services.

- [ ] **Step 5: Commit**

```powershell
git add scripts/seed-e2e.ts tests/e2e/critical-journeys.spec.ts
git commit -m "test: restore purchasable E2E course fixture"
```

### Task 2: Serialize completion and make first completion the only automatic trigger

**Files:**
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/courses/server.ts`
- Modify: `src/features/certificates/server.test.ts`
- Modify: `src/features/courses/certificate-issuance.integration.test.ts`
- Modify: `docs/domain/certificates-and-data-rights.md`
- Modify: `docs/domain/learning-content-and-progress.md`

- [ ] **Step 1: Write the unit regression for an existing completion**

In `server.test.ts`, make the `CourseCompletion` insert return no rows and assert that `tryIssueAutomaticCompletionCertificate` and the outbox insert are not called. The public behavior is:

```ts
await expect(issueCompletionCertificateIfEligible(input)).resolves.toBe(false);
```

- [ ] **Step 2: Run the unit regression and confirm RED**

```powershell
bun run test -- src/features/certificates/server.test.ts
```

Expected: the existing code attempts emission after the conflict update returns the historical completion.

- [ ] **Step 3: Export one lifecycle lock and use insert-only completion semantics**

Rename the current private lock to the intentional interface:

```ts
export const lockCourseCertificateLifecycle = async (
  client: PoolClient,
  userId: string,
  courseId: string
): Promise<void> => { ... };
```

Use it in all existing manual/automatic lifecycle paths. Change the completion insert to:

```sql
insert into course_completions (user_id, course_id, course_publication_id)
values ($1, $2, $3)
on conflict (user_id, course_id) do nothing
returning id, completed_at
```

Return `false` immediately when no row was inserted.

- [ ] **Step 4: Write the PostgreSQL regression for two distinct final lessons**

Extend the integration fixture to create two required lessons. Pre-complete every other required lesson, then conclude the two remaining lessons concurrently. Assert:

```ts
expect(await countCourseCompletions(courseId, userId)).toBe(1);
expect(await countCertificates(courseId, userId)).toBe(1);
expect(await countCertificateRenderMessages(certificateId)).toBe(1);
```

- [ ] **Step 5: Run the integration regression in CI-compatible PostgreSQL and confirm RED**

```powershell
bun run test:certificates:integration
```

Expected before the implementation is complete: two distinct transactions can both commit without creating the completion. If `CERTIFICATE_CONCURRENCY_DATABASE_URL` is unavailable locally, preserve this RED assertion for the CI integration gate and use the unit SQL contract test below locally.

- [ ] **Step 6: Acquire the lifecycle lock before progress mutation and summary**

In `completeLesson`, after beginning the transaction and before inserting `lesson_progress`, call:

```ts
await lockCourseCertificateLifecycle(client, userId, data.course.id);
```

Keep the lock order identical across automatic, manual and reconciliation paths.

- [ ] **Step 7: Add a SQL contract test and run GREEN locally**

Extend `src/features/courses/server-sql.test.ts` to assert the lifecycle lock call occurs before the progress insert and summary query. Then run:

```powershell
bun run test -- src/features/certificates/server.test.ts src/features/courses/server-sql.test.ts
```

Expected: pass.

- [ ] **Step 8: Update canonical rules and commit**

Document first-insert-only autoemission and serialization in both domain guides.

```powershell
git add src/features/certificates/server.ts src/features/courses/server.ts src/features/certificates/server.test.ts src/features/courses/server-sql.test.ts src/features/courses/certificate-issuance.integration.test.ts docs/domain/certificates-and-data-rights.md docs/domain/learning-content-and-progress.md
git commit -m "fix: serialize course completion certificate issuance"
```

### Task 3: Add bounded Admin-confirmed reconciliation

**Files:**
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/certificates/templates.ts`
- Modify: `src/features/certificates/actions.ts`
- Modify: `src/features/certificates/command-input.ts`
- Modify: `src/features/certificates/server.test.ts`
- Modify: `src/features/certificates/actions.test.ts`
- Modify: `src/features/certificates/command-input.test.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/page.tsx`
- Modify: `src/features/admin/server.ts`
- Modify: `src/features/admin/server-read-projections.test.ts`
- Modify: `docs/adr/0006-certificate-lifecycle.md`

- [ ] **Step 1: Write RED tests for count, confirmation and idempotency**

Add tests proving:

```ts
expect(parseReconcileCertificatesInput(formWithoutConfirmation)).toThrow();
expect(await countPendingCertificateReconciliations(courseId)).toBe(3);
expect(await reconcileCourseCertificates(input)).toEqual({ issued: 3, remaining: 0 });
```

The server test must assert only completions with no Certificate history are selected and each created Certificate gets one `certificate.render` message.

- [ ] **Step 2: Run focused tests and confirm RED**

```powershell
bun run test -- src/features/certificates/command-input.test.ts src/features/certificates/actions.test.ts src/features/certificates/server.test.ts src/features/admin/server-read-projections.test.ts
```

Expected: missing parser, projection and reconciliation interfaces.

- [ ] **Step 3: Implement the reconciliation query and command**

Add `CERTIFICATE_RECONCILIATION_BATCH_LIMIT = 100`. Count candidates with `CourseCompletion`, enabled Course, published template and no Certificate history. In the command:

1. begin transaction;
2. acquire the Course advisory lock used by template publication;
3. select up to 100 eligible completions ordered by `completed_at, id`;
4. acquire Conta + Curso lifecycle lock per row;
5. recheck absence of Certificate history;
6. issue using the completion’s publication and current published template;
7. audit origin `admin_reconciliation`;
8. commit and return issued/remaining.

Keep R2, PDF generation and email outside this transaction through existing outbox messages.

- [ ] **Step 4: Add the Server Action with authoritative confirmation**

The parser must include:

```ts
confirmed: z.literal("yes", {
  error: "Confirme a emissão dos certificados pendentes.",
})
```

The action requires Admin authority, calls the command and returns a typed success/error state containing `issued` and `remaining`.

- [ ] **Step 5: Add the compact Admin UI**

Pass `pendingCertificateReconciliationCount` through the Admin Course projection. In the Certificate tab render the section only when the count is positive. Use existing shadcn `AlertDialog` and `Button`; copy must explain PDF and e-mail side effects. After success, refresh and show Sonner feedback.

- [ ] **Step 6: Run focused tests GREEN**

```powershell
bun run test -- src/features/certificates src/features/admin/server-read-projections.test.ts 'src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx'
```

Expected: pass.

- [ ] **Step 7: Update ADR and commit**

Record Admin-confirmed bounded reconciliation and its snapshot choices in ADR-0006.

```powershell
git add src/features/certificates src/features/admin/server.ts src/features/admin/server-read-projections.test.ts 'src/app/(admin)/admin/cursos/[courseId]' docs/adr/0006-certificate-lifecycle.md
git commit -m "feat: reconcile historical certificate completions"
```

### Task 4: Fence all outbox transitions and terminalize render atomically

**Files:**
- Modify: `src/features/outbox/server.ts`
- Modify: `src/features/outbox/worker.ts`
- Modify: `src/features/outbox/runner.ts`
- Modify: `src/features/outbox/server.test.ts`
- Modify: `src/features/outbox/worker.test.ts`
- Modify: `src/features/outbox/runner.test.ts`
- Modify: `src/features/outbox/outbox.integration.test.ts`
- Modify: `src/features/certificates/server.ts`

- [ ] **Step 1: Write RED tests for lease loss**

Make transition callbacks return `boolean`. Add tests where `markDelivered`, `markRetry`, `markDeferred` and `markDeadLetter` return `false`; assert:

```ts
expect(outcome).toBe("lease_lost");
```

For `certificate.render`, assert a dead-letter transition owned by another worker neither changes the message nor marks the Certificate failed.

- [ ] **Step 2: Run focused tests and confirm RED**

```powershell
bun run test -- src/features/outbox/server.test.ts src/features/outbox/worker.test.ts src/features/outbox/runner.test.ts
```

Expected: current void callbacks report delivered/dead-letter despite zero affected rows.

- [ ] **Step 3: Return ownership results from persistence transitions**

Each `markOutboxMessage*` function returns `result.rowCount === 1`. Extend the worker outcome union with `lease_lost` and propagate false transitions.

- [ ] **Step 4: Implement atomic certificate render dead letter**

Use one transaction or one CTE-based SQL command that:

- updates the outbox row only for `status='processing' and locked_by=$workerId`;
- derives `certificateId` only from the transitioned `certificate.render` message;
- sets `render_status='failed'` only for the corresponding pending Certificado with no active render claim.

Remove the runner’s independent `markCertificateRenderFailed` call. A lost lease sets `result.leaseLost=true` and stops processing.

- [ ] **Step 5: Add PostgreSQL reclaim regression**

In `outbox.integration.test.ts`, let worker A claim a fifth-attempt render message, expire its lease, let worker B reclaim it, then terminalize as worker A. Assert message remains owned by B and Certificado remains pending.

- [ ] **Step 6: Run focused tests GREEN and commit**

```powershell
bun run test -- src/features/outbox src/features/certificates/server.test.ts
```

```powershell
git add src/features/outbox src/features/certificates/server.ts
git commit -m "fix: fence certificate outbox terminal states"
```

### Task 5: Harden command confirmation, telemetry and operational alerts

**Files:**
- Modify: `src/features/certificates/command-input.ts`
- Modify: `src/features/certificates/command-input.test.ts`
- Modify: `src/features/certificates/actions.test.ts`
- Modify: `src/lib/sentry-options.ts`
- Modify: `src/lib/sentry-options.test.ts`
- Modify: `src/features/operations/server.ts`
- Modify: `src/features/operations/server.test.ts`
- Modify: `src/app/(admin)/admin/auditoria/page.tsx`
- Modify: `src/app/api/cron/outbox/route.ts`
- Modify: `docs/operations/observability-and-recovery.md`

- [ ] **Step 1: Write RED confirmation tests for all lifecycle commands**

For issue, revoke and reissue, omit `confirmed` and expect the parser/action to reject without invoking the server command. Include `confirmed=yes` in existing success fixtures.

- [ ] **Step 2: Write RED Sentry sanitization tests**

Construct events containing a certificate code in request URL, breadcrumb URL/message, transaction name and span description. Assert none of the serialized output contains the code and all retain `/certificados/[certificate-code]`.

- [ ] **Step 3: Verify current Sentry API names before implementation**

Use Context7 for `@sentry/nextjs` 10.68 hooks `beforeSend`, `beforeBreadcrumb` and `beforeSendTransaction`. Confirm callback signatures against installed types before editing.

- [ ] **Step 4: Write RED alert tests**

Given `deadLetterCount > 0`, expect an outbox dead-letter alert. Given oldest pending age at least 15 minutes, expect warning; at least 60 minutes, expect critical. Assert no alert below threshold.

- [ ] **Step 5: Implement confirmation, centralized redaction and alerts**

Add `confirmed: z.literal("yes")` to both lifecycle schemas. Centralize certificate-path normalization and apply it to all supported Sentry hooks, including span data without mutating unrelated event fields.

Extend `OperationalAlert` with named outbox codes and constants:

```ts
const OUTBOX_BACKLOG_WARNING_MINUTES = 15;
const OUTBOX_BACKLOG_CRITICAL_MINUTES = 60;
```

Show alerts in the existing Auditoria alert surface. Remove `provider: "resend"` from the aggregate outbox cron observation.

- [ ] **Step 6: Run focused tests GREEN and commit**

```powershell
bun run test -- src/features/certificates/command-input.test.ts src/features/certificates/actions.test.ts src/lib/sentry-options.test.ts src/features/operations/server.test.ts
```

```powershell
git add src/features/certificates/command-input.ts src/features/certificates/command-input.test.ts src/features/certificates/actions.test.ts src/lib/sentry-options.ts src/lib/sentry-options.test.ts src/features/operations/server.ts src/features/operations/server.test.ts src/app/'(admin)'/admin/auditoria/page.tsx src/app/api/cron/outbox/route.ts docs/operations/observability-and-recovery.md
git commit -m "fix: harden certificate operations and observability"
```

### Task 6: Refine the student completion and public certificate experience

**Files:**
- Modify: `src/app/(student)/app/actions.ts`
- Modify: `src/app/(student)/app/actions.test.ts`
- Modify: `src/app/(student)/app/cursos/[courseId]/page.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/page.test.tsx`
- Modify: `src/app/(student)/app/certificados/page.tsx`
- Create: `src/app/(student)/app/certificados/pending-certificate-refresh.tsx`
- Create: `src/app/(student)/app/certificados/pending-certificate-refresh.test.tsx`
- Modify: `src/app/certificados/[code]/page.tsx`
- Modify: `src/app/certificados/[code]/page.test.tsx`
- Create: `src/app/certificados/[code]/certificate-public-actions.tsx`
- Create: `src/app/certificados/[code]/certificate-public-actions.test.tsx`
- Create: `src/app/certificados/[code]/pdf/route.ts`
- Create: `src/app/certificados/[code]/pdf/route.test.ts`
- Modify: `src/features/email/server.ts`
- Modify: `src/features/email/server.test.ts`

- [ ] **Step 1: Write RED tests for completion and failed state copy**

Assert final manual completion redirects to:

```text
/app/cursos/<courseId>?certificate=issued
```

only when `certificateIssued=true`. Assert the Course page renders an accessible completion status, points a ready/revoked record to `/certificados/[code]` and never diverts that contextual action to `/app/certificados`. `renderStatus=failed` says the PDF failed and directs the Aluna to support. The authenticated list remains the global archive.

- [ ] **Step 2: Write RED polling, public page, PDF route and email-link tests**

The refresh component receives `hasPendingCertificates`. With `true`, fake timers advance ten seconds and `router.refresh()` runs only while `document.visibilityState === "visible"`. With `false`, no timer is created. Assert the certificate e-mail action URL ends in `/certificados/<encoded-code>`.

For `/certificados/[code]`, assert `valid`/`ready` renders immutable claims, preview, download and copy-link actions; `pending`, `failed` and `revoked` render a safe status without preview or download. For `/certificados/[code]/pdf`, assert rate limiting happens before lookup, only `valid`/`ready` with key and digest can pass, SHA-256 is verified before signing, the signed URL is short-lived and the redirect sends `X-Robots-Tag: noindex, nofollow`.

- [ ] **Step 3: Implement minimal UX behavior**

Use a query parameter only as a redirect handoff; the Course page displays a semantic `Alert` and its links do not persist the parameter. In `getCertificateHelper`, branch explicitly for `failed`, `pending` and `ready`. Keep the Course as the contextual entry and `/app/certificados` as the global archive; both link to the public canonical page.

Mount `PendingCertificateRefresh` only when at least one valid pending record exists. Use a ten-second interval, clean it up on unmount, skip refresh while hidden and stop when refreshed data has no pending records.

Keep the PDF object in private R2. The public route must reuse `consumePublicCertificateLookup`, reject non-ready/non-valid states before storage access, verify private SHA-256 metadata and issue only a five-minute signed redirect. The page uses `noindex,nofollow`; the redirect uses `X-Robots-Tag`. Revocation blocks future route access without claiming to recall copies already downloaded.

- [ ] **Step 4: Run focused tests GREEN and commit**

```powershell
bun run test -- 'src/app/(student)/app/actions.test.ts' 'src/app/(student)/app/cursos/[courseId]/page.test.tsx' 'src/app/(student)/app/certificados' 'src/app/certificados/[code]' src/features/email/server.test.ts
```

```powershell
git add 'src/app/(student)/app' 'src/app/certificados/[code]' src/features/email/server.ts src/features/email/server.test.ts
git commit -m "feat: clarify certificate completion feedback"
```

### Task 7: Prove the complete story in integration and E2E

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/lib/production-environment.ts`
- Create: `src/features/email/e2e-delivery-sink.ts`
- Create: `src/features/email/e2e-delivery-sink.test.ts`
- Modify: `src/features/email/server.ts`
- Create: `src/app/api/e2e/email-deliveries/route.ts`
- Create: `src/app/api/e2e/email-deliveries/route.test.ts`
- Modify: `scripts/seed-e2e.ts`
- Modify: `tests/e2e/critical-journeys.spec.ts`
- Modify: `src/features/courses/certificate-issuance.integration.test.ts`
- Modify: `src/features/outbox/outbox.integration.test.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write RED guards for the E2E sink**

The sink and route must reject unless all are true:

```ts
process.env.CI === "true";
process.env.E2E_TEST_MODE === "true";
BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL and CERTIFICATE_PUBLIC_BASE_URL use the same 127.0.0.1 origin.
```

Production/Preview environment validation must continue rejecting E2E variables. Test that the sink stores only topic, recipient fixture ID and idempotency key, never rendered HTML, token or arbitrary payload.

- [ ] **Step 2: Implement the guarded sink**

When the strict E2E runtime guard passes, `sendCertificateIssuedEmail` records a delivery and returns without Resend. The GET test route returns only aggregate/test identifiers and is unavailable otherwise. Keep normal Development, Staging and Production delivery unchanged.

- [ ] **Step 3: Seed a real certifiable completion Course**

For `studentForCompletion`, configure the existing completion Course with:

- one required final lesson for the certificate journey;
- global issuer fixture;
- published certificate template with an R2 background fixture;
- `certificate_enabled=true`;
- no preinserted Certificate.

Preserve separate pending/ready/revoked fixtures for state-specific tests.

- [ ] **Step 4: Add the complete Playwright journey**

Drive the final lesson through the UI, assert the issued feedback and the contextual Course link, inspect `/app/certificados` as the global archive, then invoke `/api/cron/outbox` with the E2E cron secret until the record is ready. Open `/certificados/[code]`, compare the claims, assert preview/download, follow the mediated public PDF route and check `%PDF`. Confirm `pending`, `failed` and `revoked` never expose the action, then query the guarded sink and assert one certificate e-mail delivery pointing to the canonical page.

- [ ] **Step 5: Add lifecycle integration cases**

With real PostgreSQL, execute issue → revoke → reissue and assert immutable predecessor, replacement link, one valid record and outbox messages. Requeue a failed render message and assert `failed → pending → ready`. Include the lease-loss cases from Task 4.

- [ ] **Step 6: Run all available focused tests**

```powershell
bun run test -- src/features/email src/app/api/e2e src/lib/env.test.ts src/lib/production-environment.test.ts
```

Expected: pass locally. Run PostgreSQL integration and Chromium in the CI disposable environment.

- [ ] **Step 7: Commit**

```powershell
git add src/lib src/features/email src/app/api/e2e scripts/seed-e2e.ts tests/e2e/critical-journeys.spec.ts src/features/courses/certificate-issuance.integration.test.ts src/features/outbox/outbox.integration.test.ts .github/workflows/ci.yml
git commit -m "test: verify certificate issuance end to end"
```

### Task 8: Align documentation and execute Production-readiness gates

**Files:**
- Modify: `CONTEXT.md`
- Modify: `PRODUCT.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/domain/certificates-and-data-rights.md`
- Modify: `docs/domain/learning-content-and-progress.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/outbox-and-transactional-effects.md`
- Modify: `docs/operations/observability-and-recovery.md`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `docs/adr/0006-certificate-lifecycle.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Reconcile canonical documentation**

Document the Admin-confirmed reconciliation, first-completion-only trigger, completion lock, fenced dead letter, E2E sink boundaries, student status flow, canonical public certificate page, mediated PDF access, Course/global-archive roles and operational alerts. Correct the migration-chain top wherever touched.

- [ ] **Step 2: Run formatting and focused verification**

```powershell
bun x ultracite fix
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun x ultracite check
```

Expected: all exit 0.

- [ ] **Step 3: Run the complete local verification profile**

Stop only the isolated worktree’s dev server if it holds the Next build lock, then run:

```powershell
bun run verify
```

Expected: docs, migrations, typecheck, lint, 1705+ unit tests, production build and Knip all pass.

- [ ] **Step 4: Push the feature branch and require CI**

```powershell
git push -u origin codex/certificate-production-hardening
```

Require all four CI jobs to pass: Quality gates, PostgreSQL integration, Browser journeys, Build and dependency audit. Browser journeys must have zero retries.

- [ ] **Step 5: Inspect runtime readiness without deploying Production**

Confirm the candidate deployment has no certificate/outbox runtime errors, verify the Staging migration state and run the real Staging smoke only with explicit provider authorization. Do not promote Production in this sprint without a separate release approval.

- [ ] **Step 6: Final review and commit documentation**

```powershell
git add CONTEXT.md PRODUCT.md README.md docs
git commit -m "docs: record certificate hardening verification"
git diff staging...HEAD --check
```

Expected: clean diff check and no undocumented contract changes.
