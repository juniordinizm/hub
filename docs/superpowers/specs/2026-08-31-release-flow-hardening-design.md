# Release Flow Hardening Design

**Date:** 2026-08-31
**Status:** Approved for implementation
**Scope:** operational simplification follow-up

## Goal

Consolidate the remaining safe improvements to the GitHub, Vercel and Neon
release workflow without changing the public Production deployment during the
implementation or validation period.

## Context

The repository already has a persistent `main` branch for Production and a
persistent `staging` branch for homologation. Pull-request CI uses local
PostgreSQL and does not create Neon branches. Merges to `staging` are deployed
by Vercel Git Integration, while Production is built and promoted by the
manual `Deploy Vercel production` workflow.

The audit found four classes of remaining work:

1. Dependabot still targets `main`, although normal changes must target
   `staging`.
2. The current-state documentation has an old SHA and one inaccurate claim
   that recovery branches have no compute.
3. Recovery workflows use the Neon create-branch action, which provisions a
   read-write endpoint even when a recovery branch only needs to preserve a
   point-in-time state. One manual Production cleanup path also creates a
   branch without an expiration.
4. Immediate worker processing is implemented for Asaas and Resend, but all
   outbox producers must be audited before reducing recovery behavior further.

## Design

### Sprint 1 — repository policy and documentation

- Set `target-branch: staging` for both Dependabot update groups.
- Keep the hotfix exception for `hotfix/*` PRs into `main`.
- Update `release-state.md` to the currently verified commit only when the
  external deployment facts are known; do not invent a status snapshot.
- Make the canonical release guide describe recovery branches accurately.
- Add contracts for Dependabot target branch, recovery branch expiration, and
  the absence of provider deployments in CI.

These changes are source-only and have no runtime or database effect.

### Sprint 2 — Neon recovery branch lifecycle

Recovery branches will be created directly through the Neon REST API with a
parent branch, an explicit name and `expires_at`, but without an `endpoints`
array. This avoids provisioning compute for a branch that is only a safety
copy. The workflow will still verify the returned branch ID, project ID,
parent ID, state and expiration before continuing.

The reset and release workflows will retain their current confirmations and
concurrency locks. A Production migration release will continue to require an
independent recent R2 backup. The Production test-data cleanup branch will get
an expiration and will be included in the documented retention policy.

The cleanup workflow will select the environment-specific project variable,
so it remains correct after Non-production is moved to its own Neon project.

No existing Neon branch will be deleted by this change.

### Sprint 3 — worker safety and observability

Keep the 15-minute workers as recovery mechanisms. Inspect every outbox
producer and add post-commit scheduling only where it is missing and safe to
do so. Immediate attempts remain best-effort; inboxes, outbox records, leases,
retry counters and dead-letter behavior remain authoritative.

Add focused tests for immediate success, immediate failure followed by cron
recovery, and idempotent processing. Do not alter cron frequency in this
sprint.

### Sprint 4 — offline operational validation

Use local PostgreSQL, disposable test data and Staging-only checks to validate:

- release without migration;
- release with migration and failure before promotion;
- a hotfix-only `main` state;
- reconciliation back into `staging`;
- branch expiration and cleanup input validation.

The validation must not promote Production or mutate the Production database.

### Manual infrastructure sprint

The following remain operator-controlled:

- replacing the expiring Vercel token;
- inventorying and deleting obsolete Neon branches;
- changing Neon compute limits and scale-to-zero settings;
- migrating Staging/Development to a separate Neon project;
- auditing Sentry with an authenticated token;
- making the GitHub repository private only after ruleset enforcement is
  confirmed for the selected GitHub plan.

## Safety boundaries

- Work is performed on a branch created from the current `main` SHA.
- No Production environment variable, domain alias, database, or Vercel
  deployment is changed by the implementation branch.
- No destructive Neon operation is automated as part of these changes.
- Every new behavior gets a failing focused test before implementation.
- Full verification runs before a PR or merge is proposed.

## Acceptance criteria

- Dependabot normal updates target `staging`.
- Recovery branches have explicit expiration and no unnecessary compute.
- Cleanup remains environment-scoped and confirmation-protected.
- All outbox producers have an explicit immediate-processing decision.
- Canonical documentation matches the implementation.
- Existing CI, build, migration checks and contract tests remain green.
- No Production deployment or database mutation occurs during validation.
