# Release Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining safe improvements to the GitHub, Vercel and Neon release flow without changing Production during implementation.

**Architecture:** Repository policy and workflow contracts remain versioned in GitHub. Temporary Neon recovery branches are created by a tested REST client with an expiration and no compute endpoint. Inboxes, outbox records, leases and 15-minute workers remain the reliability boundary while immediate processing is added only where an audit proves it is safe.

**Tech Stack:** GitHub Actions, GitHub rulesets, Vercel Git Integration, Neon REST API, Bun, TypeScript, Vitest, Next.js.

---

## Sprint 0: Isolated baseline

**Files:**
- Create: `docs/superpowers/specs/2026-08-31-release-flow-hardening-design.md`
- Create: `docs/superpowers/plans/2026-08-31-release-flow-hardening-plan.md`

- [ ] Verify the worktree is clean and its commit equals `origin/main`.
- [ ] Work only on `codex/harden-release-flow-sprints-20260831`.
- [ ] Record the current Production and Staging deployment IDs for comparison.
- [ ] Avoid all Vercel, Neon, GitHub-secret and database mutations during source work.

## Sprint 1: Repository policy and documentation

**Files:**
- Modify: `.github/dependabot.yml`
- Modify: `docs/operations/release-flow.md`
- Modify: `docs/operations/release-state.md`
- Test: `src/tooling/release-workflows.test.ts`
- Test: `src/tooling/simplified-release-flow.test.ts`

- [ ] Add a failing test that requires every Dependabot update block to contain `target-branch: staging`.
- [ ] Run `bun test src/tooling/release-workflows.test.ts src/tooling/simplified-release-flow.test.ts` and confirm that assertion fails against the current file.
- [ ] Add `target-branch: staging` to both Dependabot update entries.
- [ ] Add a failing contract for a recovery workflow to use the tested no-compute helper and an explicit expiration.
- [ ] Update the canonical release guide to match that contract.
- [ ] Update `release-state.md` with only verified current deployment facts; keep uncertain historical facts unchanged and clearly historical.
- [ ] Run the focused tests and `bun run docs:check`.

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

- [ ] Write a failing helper test for a valid request containing `branch.name`, `branch.parent_id` and `branch.expires_at`, with no `endpoints` property.
- [ ] Write failing tests for missing credentials, invalid branch names, past expiration, unexpected project/parent, repeated polling and bounded API errors.
- [ ] Run the helper tests and confirm they fail because the helper is absent.
- [ ] Implement the helper with injected `fetch` and sleep functions, bounded response text, a maximum of 12 readiness polls, and GitHub output fields `branch_id`, `branch_name` and `expires_at`.
- [ ] Run the helper tests and confirm they pass.
- [ ] Replace the Production migration backup action with the helper while preserving the 14-day expiry and parent verification.
- [ ] Replace the Staging reset backup action with the helper while preserving the seven-day expiry and confirmations.
- [ ] Replace the Production test-data backup creation with the helper and a 14-day expiry.
- [ ] Make release-backup cleanup choose `STAGING_NEON_PROJECT_ID` for Staging and `PRODUCTION_NEON_PROJECT_ID` for Production.
- [ ] Add cleanup selection coverage for `asaas-cutover-backup-*` without selecting persistent branches.
- [ ] Run the focused Neon tests and workflow contracts.

## Sprint 3: Immediate worker safety

**Files:**
- Inspect all modules that insert outbox records.
- Modify only the producers that lack a safe post-commit drain.
- Test the corresponding producer, outbox, lease, retry and dead-letter files.
- Modify: `docs/operations/outbox-and-transactional-effects.md`
- Modify: `docs/operations/release-flow.md`

- [ ] Produce a source-level inventory of every outbox insertion and its current trigger.
- [ ] For each missing safe trigger, write a focused failing test before changing production code.
- [ ] Implement bounded post-commit scheduling using the existing background-drain and observation pattern.
- [ ] Verify immediate failure does not remove the durable inbox/outbox record.
- [ ] Verify the 15-minute cron can recover the record and leases prevent concurrent processing.
- [ ] Do not change any cron cadence in this sprint.
- [ ] Run the focused worker test set and update the operational documentation.

## Sprint 4: Offline release validation

**Files:**
- Modify only test fixtures or contract tests required for the scenarios.

- [ ] Exercise a no-migration release decision against local PostgreSQL with zero Neon API calls.
- [ ] Exercise migration ordering against a disposable local database and verify build-before-migration behavior.
- [ ] Verify a hotfix containing changes under `src/db/migrations` or `src/db/schema.ts` is rejected.
- [ ] Verify a synthetic main-ahead-of-staging state requires reconciliation before normal release.
- [ ] Verify reconciliation preserves both sides and does not delete `staging`.
- [ ] Verify missing expiration is rejected by the branch helper.
- [ ] Run `bun run verify:quick` followed by the full project verification.
- [ ] Compare current Production and Staging deployment IDs and confirm no external Production state changed.

## Manual infrastructure handoff

- [ ] Replace the Vercel token in both GitHub Environments with a durable, appropriately scoped token.
- [ ] Inventory Neon branches in the console before deleting anything.
- [ ] Run release-backup cleanup in `dry-run`, review exact IDs, then execute only approved deletions.
- [ ] Inspect Neon endpoint limits and scale-to-zero settings before changing them.
- [ ] Create and migrate to a separate Non-production Neon project only after source validation.
- [ ] Provide authenticated Sentry access for the Production/Staging error audit.
- [ ] Keep the repository public until ruleset enforcement is confirmed for the selected GitHub plan.

## Final verification

- [ ] Run `bun run docs:check`.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run check`.
- [ ] Run `bun test`.
- [ ] Run PostgreSQL integration tests, E2E tests, build and Knip.
- [ ] Request a code review against the base SHA.
- [ ] Do not promote Production from this implementation branch.

