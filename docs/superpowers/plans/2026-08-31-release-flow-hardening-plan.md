# Release Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining low-risk release-flow improvements while preserving Production and making Neon recovery resources finite and observable.

**Architecture:** Repository policy and workflow contracts stay in GitHub source control. Recovery branches are created through a small, tested Neon API helper without compute endpoints and with mandatory expiration. Immediate worker execution remains best-effort, while inbox/outbox records and 15-minute crons remain the recovery authority.

**Tech Stack:** GitHub Actions, GitHub rulesets, Vercel Git Integration, Neon REST API, Bun, TypeScript, Vitest, Next.js.

---

## Sprint 0: Isolated baseline

**Files:**
- Create: `docs/superpowers/specs/2026-08-31-release-flow-hardening-design.md`
- Create: `docs/superpowers/plans/2026-08-31-release-flow-hardening-plan.md`

- [ ] Confirm the worktree starts at the current `origin/main` SHA and has no user changes.
- [ ] Create `codex/harden-release-flow-sprints-20260831` from that SHA.
- [ ] Do not change Vercel, Neon, GitHub secrets, aliases, or databases during source implementation.

## Sprint 1: Repository policy and documentation

**Files:**
- Modify: `.github/dependabot.yml`
- Modify: `docs/operations/release-flow.md`
- Modify: `docs/operations/release-state.md`
- Test: `src/tooling/release-workflows.test.ts`
- Test: `src/tooling/simplified-release-flow.test.ts`

- [ ] Add a failing contract asserting each Dependabot update block has `target-branch: staging`.
- [ ] Run `bun test src/tooling/release-workflows.test.ts src/tooling/simplified-release-flow.test.ts` and confirm the new assertion fails because the current configuration targets the default branch.
- [ ] Add `target-branch: staging` to the GitHub Actions and Bun Dependabot update blocks.
- [ ] Update the canonical release guide to say recovery branches are created without compute endpoints.
- [ ] Update the current-state frontmatter and deployment facts using only the verified `main` and `staging` SHAs and deployment IDs.
- [ ] Mark older snapshots as historical where they describe superseded branch or cron behavior.
- [ ] Run the focused contract tests and `bun run docs:check`.

## Sprint 2: Neon recovery branch lifecycle

**Files:**
- Create: `scripts/create-neon-recovery-branch.ts`
- Test: `scripts/create-neon-recovery-branch.test.ts`
- Modify: `.github/workflows/deploy-vercel.yml`
- Modify: `.github/workflows/reset-staging.yml`
- Modify: `.github/workflows/cleanup-production-test-data.yml`
- Modify: `.github/workflows/cleanup-neon-release-backups.yml`
- Modify: `src/tooling/release-workflows.test.ts`
- Modify: `src/tooling/simplified-release-flow.test.ts`
- Modify: `src/tooling/neon-release-backup-cleanup.ts`
- Modify: `src/tooling/neon-release-backup-cleanup.test.ts`

- [ ] Write tests for a recovery-branch client that sends `branch.name`, `branch.parent_id` and `branch.expires_at`, omits `endpoints`, rejects missing/expired inputs, verifies project and parent IDs, and writes only the branch ID/name/expiry outputs.
- [ ] Run the new test and confirm it fails because the helper does not exist.
- [ ] Implement the minimal helper using `fetch`, bounded error text, a bounded readiness poll, and dependency injection for `fetch` and sleep in tests.
- [ ] Run the helper tests and confirm they pass.
- [ ] Replace the release workflow's `create-branch-action` step with the helper, preserving the 14-day expiration and parent verification.
- [ ] Replace the Staging reset action with the helper, preserving the seven-day expiration and explicit reset confirmations.
- [ ] Add a 14-day expiration to the Production test-data backup branch and invoke the same helper.
- [ ] Use `PRODUCTION_NEON_PROJECT_ID` or `STAGING_NEON_PROJECT_ID` in the cleanup workflow according to the selected environment.
- [ ] Add cleanup selection tests for the `asaas-cutover-backup-*` prefix without ever deleting persistent branches.
- [ ] Run workflow contract tests and the focused Neon tests.

## Sprint 3: Immediate worker safety

**Files:**
- Inspect and modify only the outbox-producing modules identified by the audit.
- Test: the corresponding producer and worker test files.
- Modify: `docs/operations/outbox-and-transactional-effects.md`
- Modify: `docs/operations/release-flow.md`

- [ ] Enumerate every call that writes an outbox record and classify it as immediate, cron-only, or intentionally deferred.
- [ ] Write one failing test for each producer that should schedule a post-commit drain but currently does not.
- [ ] Run only those tests and confirm the expected failures.
- [ ] Add post-commit scheduling with bounded work and swallowed background errors, matching the existing Asaas/Resend pattern.
- [ ] Run the focused producer, outbox, lease, retry and dead-letter tests.
- [ ] Do not change cron schedules in this sprint.
- [ ] Document that immediate processing is best-effort and cron remains recovery.

## Sprint 4: Offline release validation

**Files:**
- Modify only tests or test fixtures required for the scenarios below.
- Test: workflow contract tests, migration checks, local integration tests and existing E2E tests.

- [ ] Validate a release candidate without migrations using local PostgreSQL and no Neon API calls.
- [ ] Validate a migration candidate against a disposable local database and confirm build-before-migration ordering.
- [ ] Validate that a hotfix with a migration is rejected.
- [ ] Validate a synthetic `main`-ahead-of-`staging` state and the reconciliation guard without pushing a branch.
- [ ] Validate that a branch with no expiration is rejected by the helper.
- [ ] Run `bun run verify:quick` and then the full verification required by the repository before opening a PR.
- [ ] Confirm that no Production URL, alias, database or Vercel deployment changed.

## Manual infrastructure handoff

- [ ] Ask the operator to replace the Vercel token in both GitHub Environments with a durable, appropriately scoped token.
- [ ] Ask the operator to inventory Neon branches and execute cleanup only after a dry-run review.
- [ ] Ask the operator to inspect Neon compute settings before enabling scale-to-zero.
- [ ] Ask the operator to create a separate Non-production Neon project and migrate Staging/Development after the source changes are stable.
- [ ] Ask the operator to provide authenticated Sentry access for the Production/Staging audit.
- [ ] Do not make the repository private until ruleset enforcement is confirmed for the chosen GitHub plan.

## Verification and integration

- [ ] Run the focused tests after every sprint.
- [ ] Run `bun run docs:check`, `bun run typecheck`, `bun run check`, `bun test`, integration tests, E2E tests, build and Knip.
- [ ] Request a code review against the base SHA before proposing merge.
- [ ] Do not promote Production from this branch.

