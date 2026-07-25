# Coolify Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining code, database, CI, and infrastructure blockers for the first production release on Coolify.

**Architecture:** Keep the web container stateless and publish one immutable ARM64 image per Git SHA. Separate the normal Postgres pool from the readiness pool, make Docker health prove database/schema readiness, promote migrations through a disposable Neon branch, and configure Coolify only from verified immutable artifacts. Controls that require a human-held authenticator, provider credential, domain choice, or off-server backup remain explicit manual gates.

**Tech Stack:** Next.js 16, TypeScript, Vitest, node-postgres, Drizzle, Docker/BuildKit, GitHub Actions/GHCR, Neon PostgreSQL 18, Coolify 4.1.

---

### Task 1: Database connection and readiness policy

**Files:**
- Modify: `src/db/index.ts`
- Modify: `src/app/api/health/ready/route.ts`
- Modify: `src/features/operations/readiness.test.ts`
- Modify: `Dockerfile`
- Modify: `.github/workflows/ci.yml`

- [x] Add a failing test proving application connections allow a production-safe timeout while readiness uses a dedicated short connection policy.
- [x] Introduce separate web and readiness pools with bounded connection counts and timeouts.
- [x] Make the readiness route use the readiness pool.
- [x] Change the image health check to authenticated readiness without embedding the secret in image metadata.
- [x] Give the ARM64 smoke test an isolated PostgreSQL 18 container, apply migrations with the bundled one-shot migrator, and prove the tested image reaches `healthy`.

### Task 2: Production contract hardening

**Files:**
- Modify: `src/lib/production-environment.ts`
- Modify: `src/lib/production-environment.test.ts`
- Modify: `src/config/scheduled-jobs.ts`
- Modify: `src/config/scheduled-jobs.test.ts`
- Modify: `.env.example`

- [x] Add failing tests for HTTP production URLs, mismatched canonical application origins, weak operational secrets, and inherited object-property job names.
- [x] Require HTTPS for public production URLs and PostgreSQL-compatible database URLs.
- [x] Require at least 32 characters for first-party authentication, cron, and healthcheck secrets; provider-issued webhook secrets keep the provider contract.
- [x] Require the auth, certificate, and public application URLs to share one canonical origin.
- [x] Validate scheduled job names with own-property semantics.

### Task 3: CI supply-chain hardening

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Modify: `src/deployment-container-contract.test.ts`

- [x] Resolve the current commit for every GitHub Action used by CI.
- [x] Pin actions to immutable commit SHAs with version comments.
- [x] Add Dependabot updates for GitHub Actions.
- [x] Add the production dependency audit to CI.
- [x] Extend the container contract test to guard readiness health and immutable action references.

### Task 4: Neon production promotion

**External resources:**
- Neon project: `quiet-heart-81417613`
- Parent branch: `br-winter-voice-ace5lsla` (`production`)
- Database: `neondb`

- [x] Prepare migrations `0033` through `0040` on a temporary child branch using the exact repository SQL chain.
- [x] Verify the Drizzle journal marker, certificate schema, course publication schema, and render claim behavior on the temporary branch.
- [x] Apply the prepared migration to `production` through the Neon migration workflow.
- [x] Verify all 41 journal entries and the `0040` compatibility marker on `production`.
- [x] Update the canonical database runbook with the observed promotion state.

### Task 5: Coolify and VPS preparation

**External resources:**
- Coolify server: `xydd0o7d0v3btkzzbjth62wo`
- Repository: `juniordinizm/hub`

- [ ] Confirm the current GitHub commit CI result and immutable GHCR artifact.
- [x] Preserve the existing safe settings: automatic updates disabled, registration disabled, S3 backup enabled, and management ports blocked externally.
- [ ] Create the Coolify project/environment/application only after the production domain and required provider credentials are available.
- [ ] Configure port `3000`, exact SHA image tag, runtime-only variables, resource limits, and four UTC Scheduled Tasks.
- [ ] Run migration and readiness smoke before attaching public traffic.
- [ ] Record human-only gates: 2FA enrollment, notification provider credentials, VPN/SSH allow-list, external APP_KEY/key backup, and restore drill.

### Task 6: Verification

**Files:**
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/operations/deploy-and-incidents.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/testing-and-ci.md`

- [x] Run focused red/green tests after each code slice.
- [x] Run `bun run docs:check`.
- [x] Run `bun run db:migrations:check`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run check`.
- [x] Run `bun run test`.
- [x] Run `bun run build`.
- [x] Run `bun run knip`.
- [x] Run `bun audit --production`.
- [x] Run `git diff --check`.
- [ ] Re-audit Neon, GitHub, Coolify, GHCR access, VPS ports, backups, and health.

No commit or push is included because repository policy requires separate explicit authorization.
