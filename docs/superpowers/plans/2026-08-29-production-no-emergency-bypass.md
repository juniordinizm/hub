# Production No-Emergency-Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Remove the two emergency input paths from the Production deployment workflow so every future release must pass the independent backup and successful-CI gates.

**Architecture:** Keep the existing protected workflow, its full-main-SHA check, independent R2 backup check, Neon rollback branch, migration, unpromoted smoke, provider check, promotion and public smoke. Delete only the optional bypass inputs, conditional branches and exception summaries; no runtime code, credentials or Production deployment is changed by this branch.

**Tech Stack:** GitHub Actions YAML, TypeScript contract tests, Markdown runbooks, Bun, Vitest.

---

### Task 1: Change the workflow contract test first

**Files:**
- Modify: `src/tooling/release-workflows.test.ts`
- Reference: `.github/workflows/deploy-vercel.yml`

- [x] **Step 1: Replace the emergency-exception assertions.**

Replace the `Emergency Production backup exception` test with a test named
`requires the normal Production backup and CI gates`. Read the workflow through
the existing `readWorkflow` helper and assert:

```typescript
expect(workflow).not.toContain("emergency_skip_backup:");
expect(workflow).not.toContain("emergency_skip_backup_confirmation:");
expect(workflow).not.toContain("emergency_skip_ci:");
expect(workflow).not.toContain("emergency_skip_ci_confirmation:");
expect(workflow).not.toContain("EMERGENCY_SKIP_PRODUCTION_BACKUP");
expect(workflow).not.toContain("EMERGENCY_SKIP_PRODUCTION_TESTS");
expect(workflow).toContain("name: Require a recent independent Production backup");
expect(workflow).not.toContain("if: inputs.emergency_skip_backup");
expect(workflow).toContain("name: Verify approved main SHA and green CI");
expect(workflow).toContain("No successful CI run exists for the current main SHA.");
expect(workflow).toContain("name: Create confirmed Production Neon backup");
expect(workflow).toContain("name: Smoke Production public profile");
expect(workflow).toContain("checkout_status=");
expect(workflow).toContain("webhook_status=");
expect(workflow).not.toContain(`[[ "${shellVariable("status")}" == "503" ]]`);
```

Keep the existing backup ancestry test unchanged. The new assertions must prove
that the mandatory gates remain present while the bypass vocabulary is gone.

- [x] **Step 2: Run the focused test and verify RED.**

Run:

```text
bun run test src/tooling/release-workflows.test.ts
```

Expected result: the replacement test fails because the current workflow still
declares the emergency inputs and conditional exception branches. Existing
workflow contract tests may remain green.

### Task 2: Remove only the bypass paths

**Files:**
- Modify: `.github/workflows/deploy-vercel.yml`
- Test: `src/tooling/release-workflows.test.ts`

- [x] **Step 1: Delete the four emergency workflow inputs.**

Remove `emergency_skip_backup`,
`emergency_skip_backup_confirmation`, `emergency_skip_ci`, and
`emergency_skip_ci_confirmation` from `on.workflow_dispatch.inputs`. Keep
`release_sha`, `confirmation`, `confirm_production`, their required flags and
the existing descriptions unchanged.

- [x] **Step 2: Make the CI gate unconditional.**

Inside `Verify approved main SHA and green CI`, remove the four emergency env
variables, both confirmation checks, and the `if [[ "${EMERGENCY_SKIP_CI}" ==
"true" ]]` branch. Leave the existing GitHub API request and its exact
successful-CI predicate as the only path before `sha=${release_sha}` is
written.

- [x] **Step 3: Make Production configuration and backup gates unconditional.**

In `Verify production deployment configuration`, remove the emergency env var
and make `required_names` always include:

```text
BACKUP_R2_ACCOUNT_ID BACKUP_R2_BUCKET_NAME
RESTORE_R2_ACCESS_KEY_ID RESTORE_R2_SECRET_ACCESS_KEY
```

Remove the conditional append. In `Require a recent independent Production
backup`, remove its `if` expression so the step always runs. Delete the entire
`Record emergency backup exception` step. Keep the Neon backup action and its
ancestry verification untouched.

- [x] **Step 4: Run the focused test and verify GREEN.**

Run:

```text
bun run test src/tooling/release-workflows.test.ts
```

Expected result: all workflow contract tests pass, and the workflow contains no
`EMERGENCY_SKIP` or `emergency_skip` token.

### Task 3: Update the operator documentation

**Files:**
- Modify: `docs/operations/production-release-guide.md`
- Modify: `docs/reviews/2026-08-29-repository-health-audit.md`

- [x] **Step 1: Document the mandatory release gates.**

In the Production workflow section of
`docs/operations/production-release-guide.md`, state that the workflow no
longer accepts emergency skip inputs and always requires successful CI for the
chosen `main` SHA plus a recent independent R2 backup. Keep the documented
staging-first sequence and do not promise a manual exception path.

- [x] **Step 2: Close the Sprint 4 checklist item without rewriting history.**

In `docs/reviews/2026-08-29-repository-health-audit.md`, mark only the item
that removes the emergency inputs as complete and set Sprint 4 to
`PARCIALMENTE CONCLUÍDA`: backup/restore evidence and a future Production
promotion still require their own run. Record that the change is present in
Staging and has not modified Production.

### Task 4: Verify and commit

**Files:**
- No files beyond Tasks 1–3.

- [x] **Step 1: Run all repository checks.**

```text
bun x ultracite check
bun run typecheck
bun run test
bun run docs:check
bun run db:migrations:check
bun audit --production --json
```

Expected result: all commands exit `0`; the audit returns `{}`; the full suite
has no failures.

- [x] **Step 2: Inspect the final diff.**

```text
git diff --check
git diff --stat origin/staging...HEAD
git status --short
```

Only the Production workflow, its contract test, the release guide, the health
report and this plan may differ. No runtime route, migration, secret, provider
setting or Production deployment is in scope.

- [x] **Step 3: Commit the change.**

```text
git add .github/workflows/deploy-vercel.yml src/tooling/release-workflows.test.ts docs/operations/production-release-guide.md docs/reviews/2026-08-29-repository-health-audit.md docs/superpowers/plans/2026-08-29-production-no-emergency-bypass.md
git commit -m "chore(release): remove production emergency bypasses"
```

### Done criteria

- The workflow has no emergency skip inputs, confirmation tokens or exception
  branches.
- Successful CI for the exact `main` SHA and the independent Production backup
  are mandatory.
- Neon rollback backup, ancestry verification, migration, unpromoted smoke,
  provider verification, promotion and public smoke remain unchanged.
- Contract tests, full tests, typecheck, Ultracite, docs/migration checks and
  production audit pass.
- The change is merged only into `staging`; Production remains unchanged until
  a separate human-approved `staging → main` promotion.
