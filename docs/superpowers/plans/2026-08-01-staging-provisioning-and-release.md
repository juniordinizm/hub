# Staging Provisioning and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the persistent Staging environment, automate safe Staging deployment and jobs, keep Production deploy manual and closed, validate all product journeys, then retire the technical Preview.

**Architecture:** Keep provider secrets scoped to Vercel or GitHub Environments and use exact host/branch assertions before database mutation. Deploy `staging` only after CI succeeds, invoke Staging jobs through authenticated GitHub schedules, and promote Production only through an explicitly confirmed SHA. Treat DNS, CORS, and webhook updates as read-before-write operations with independent rollback evidence.

**Tech Stack:** GitHub Actions, Vercel Pro Custom Environments and CLI 57, Neon Postgres API, Cloudflare R2 S3/CORS, Asaas API v3 Sandbox, Hostinger DNS, Bun.

**Depends on:** `docs/superpowers/plans/2026-08-01-staging-runtime-and-maintenance.md`

---

## File structure

Create:

- `scripts/migrate-staging.ts`: guarded Staging migration command.
- `scripts/seed-staging-admin.ts`: idempotent Staging Admin seed.
- `scripts/reset-staging.ts`: explicit Staging reset and safe report.
- `src/db/staging-target.ts`: pure host, confirmation, and branch validation.
- `src/db/staging-target.test.ts`: destructive-target regressions.
- `.github/workflows/deploy-staging.yml`: CI-gated migration and deployment.
- `.github/workflows/run-staging-jobs.yml`: scheduled and manual job invocations.
- `.github/workflows/reset-staging.yml`: manual backup and destructive reset.

Modify:

- `package.json`: Staging migration, seed, and reset commands.
- `.github/workflows/ci.yml`: run on `staging`; remove Vercel Preview job.
- `.github/workflows/deploy-vercel.yml`: require an explicit main SHA and
  maintenance smoke.
- canonical release, database, environment, R2, Asaas, and incident runbooks.

External resources:

- Git branch `staging`.
- Neon branch `staging`.
- Vercel Custom Environment `staging`.
- Hostinger CNAME `preview`.
- GitHub Environment `vercel-staging`.
- R2 CORS origin for `https://preview.neurocapacitar.com.br`.
- Asaas Sandbox webhook for the stable Staging URL.

### Task 1: Guard Staging database commands

**Files:**

- Create: `src/db/staging-target.ts`
- Create: `src/db/staging-target.test.ts`

- [ ] **Step 1: Write failing target tests**

```ts
import { describe, expect, it } from "vitest";
import { assertStagingTarget } from "./staging-target";

describe("Staging database target", () => {
  it("accepts the explicitly confirmed Staging compute", () => {
    expect(
      assertStagingTarget({
        branchId: "br-staging",
        confirmation: "staging",
        databaseUrl:
          "postgresql://user:secret@ep-staging-pooler.sa-east-1.aws.neon.tech/neondb",
        expectedBranchId: "br-staging",
        expectedHost: "ep-staging.sa-east-1.aws.neon.tech",
      })
    ).toEqual({
      branchId: "br-staging",
      databaseName: "neondb",
      host: "ep-staging.sa-east-1.aws.neon.tech",
    });
  });

  it("rejects Production, wrong host, wrong branch, and weak confirmation", () => {
    const productionUrl =
      "postgresql://user:do-not-print@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb";
    expect(() =>
      assertStagingTarget({
        branchId: "br-staging",
        confirmation: "staging",
        databaseUrl: productionUrl,
        expectedBranchId: "br-staging",
        expectedHost:
          "ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Staging command refuses the Production Neon compute.");
    expect(() =>
      assertStagingTarget({
        branchId: "br-other",
        confirmation: "staging",
        databaseUrl:
          "postgresql://user:secret@ep-staging.sa-east-1.aws.neon.tech/neondb",
        expectedBranchId: "br-staging",
        expectedHost: "ep-staging.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Staging branch does not match STAGING_NEON_BRANCH_ID.");
    expect(() =>
      assertStagingTarget({
        branchId: "br-staging",
        confirmation: "production",
        databaseUrl:
          "postgresql://user:secret@ep-staging.sa-east-1.aws.neon.tech/neondb",
        expectedBranchId: "br-staging",
        expectedHost: "ep-staging.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Set STAGING_OPERATION_CONFIRMATION=staging.");
  });
});
```

- [ ] **Step 2: Run the focused test**

```powershell
bun run test -- src/db/staging-target.test.ts
```

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the pure guard**

Mirror the proven normalization in `shared-development-database.ts`:

```ts
const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const POOLED_HOST_MARKER = "-pooler.";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

export const assertStagingTarget = ({
  branchId,
  confirmation,
  databaseUrl,
  expectedBranchId,
  expectedHost,
}: {
  branchId: string | undefined;
  confirmation: string | undefined;
  databaseUrl: string;
  expectedBranchId: string | undefined;
  expectedHost: string | undefined;
}): { branchId: string; databaseName: string; host: string } => {
  if (confirmation?.trim().toLowerCase() !== "staging") {
    throw new Error("Set STAGING_OPERATION_CONFIRMATION=staging.");
  }
  if (!(branchId?.trim() && expectedBranchId?.trim())) {
    throw new Error("STAGING_NEON_BRANCH_ID is required.");
  }
  if (branchId.trim() !== expectedBranchId.trim()) {
    throw new Error("Staging branch does not match STAGING_NEON_BRANCH_ID.");
  }
  if (!expectedHost?.trim()) {
    throw new Error("STAGING_DATABASE_HOST is required.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Staging database URL is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Staging database URL must use PostgreSQL.");
  }

  const host = url.hostname.trim().toLowerCase().replace(POOLED_HOST_MARKER, ".");
  const confirmedHost = expectedHost
    .trim()
    .toLowerCase()
    .replace(POOLED_HOST_MARKER, ".");
  if (host.startsWith(PRODUCTION_NEON_COMPUTE)) {
    throw new Error("Staging command refuses the Production Neon compute.");
  }
  if (LOOPBACK_HOSTS.has(host)) {
    throw new Error("Staging command requires a remote Neon host.");
  }
  if (host !== confirmedHost) {
    throw new Error("Staging database does not match STAGING_DATABASE_HOST.");
  }

  const databaseName = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!databaseName) {
    throw new Error("Staging database name is missing.");
  }
  return { branchId: branchId.trim(), databaseName, host };
};
```

- [ ] **Step 4: Run the test**

```powershell
bun run test -- src/db/staging-target.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the guard**

```powershell
git add src/db/staging-target.ts src/db/staging-target.test.ts
git commit -m "feat: guard staging database commands"
```

### Task 2: Add migration and Admin seed commands

**Files:**

- Create: `scripts/migrate-staging.ts`
- Create: `scripts/seed-staging-admin.ts`
- Modify: `package.json`
- Test: `src/db/staging-target.test.ts`

- [ ] **Step 1: Add script contract tests**

Assert source-level contracts:

- both scripts require `DATABASE_URL_DIRECT`, `STAGING_DATABASE_HOST`,
  `STAGING_NEON_BRANCH_ID`, and `STAGING_OPERATION_CONFIRMATION=staging`;
- migration validates before constructing `Pool`;
- seed requires `STAGING_ADMIN_EMAIL`, `STAGING_ADMIN_PASSWORD`, and
  `BETTER_AUTH_SECRET`;
- output contains only host, database, branch ID, and row outcome;
- neither script accepts `DATABASE_URL`.

- [ ] **Step 2: Run the tests and verify failure**

```powershell
bun run test -- src/db/staging-target.test.ts
```

Expected: FAIL on missing script contracts.

- [ ] **Step 3: Implement guarded migration**

`migrate-staging.ts` must call `assertStagingTarget` before opening Postgres,
then reuse `runMigrationWithLock` and Drizzle's `migrate` exactly as
`migrate-production.ts` does. Use `application_name=protea-r-staging-migration`
and print:

```text
Staging migrations applied on <database> at <host>.
```

- [ ] **Step 4: Implement idempotent Admin seed**

Use Better Auth password hashing and the existing `users`, `accounts`, and
`profiles` schema. Normalize the email with `normalizeBuyerEmail`, whose
contract is aligned with Better Auth Sentinel. Upsert exactly one credential
account and set role `admin`.
Do not create Course or Student fixtures. Never print email or password.

- [ ] **Step 5: Add package scripts**

```json
"db:migrate:staging": "bun scripts/migrate-staging.ts",
"db:seed:staging-admin": "bun --conditions=react-server scripts/seed-staging-admin.ts"
```

- [ ] **Step 6: Run tests and typecheck**

```powershell
bun run test -- src/db/staging-target.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit operational commands**

```powershell
git add scripts/migrate-staging.ts scripts/seed-staging-admin.ts package.json src/db/staging-target.test.ts
git commit -m "feat: add staging database commands"
```

### Task 3: Add explicit Staging reset

**Files:**

- Create: `scripts/reset-staging.ts`
- Modify: `package.json`
- Test: `src/db/staging-target.test.ts`

- [ ] **Step 1: Add parser and safety tests**

The command accepts only:

```text
--mode=plan --environment=staging
```

or:

```text
--mode=execute --environment=staging --confirm-reset=true --confirmation=RESET_STAGING_DATA
```

Tests must prove plan mode never executes SQL, execute requires both
confirmations, the target guard runs before SQL, `__drizzle_migrations` is
excluded, identifiers are validated before interpolation, and output contains
only table counts.

- [ ] **Step 2: Run the focused tests**

```powershell
bun run test -- src/db/staging-target.test.ts
```

Expected: FAIL on missing reset behavior.

- [ ] **Step 3: Implement plan and execute**

Inside one transaction:

1. acquire a dedicated advisory lock;
2. read public tables;
3. reject unsafe identifiers;
4. exclude `__drizzle_migrations`;
5. in plan mode, return counts and rollback;
6. in execute mode, run one explicit
   `TRUNCATE ... RESTART IDENTITY CASCADE`;
7. commit;
8. invoke the idempotent Admin seed;
9. delete only the physical `staging/` R2 namespace in batches;
10. never delete JMVStream videos.

If R2 cleanup fails after database commit, report a recoverable orphan cleanup
failure and allow rerunning only the R2 phase.

- [ ] **Step 4: Add the package command**

```json
"db:reset:staging": "bun --conditions=react-server scripts/reset-staging.ts"
```

- [ ] **Step 5: Run tests and typecheck**

```powershell
bun run test -- src/db/staging-target.test.ts src/features/storage/r2-object-namespace.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit reset tooling**

```powershell
git add scripts/reset-staging.ts package.json src/db/staging-target.test.ts
git commit -m "feat: add safe staging reset"
```

### Task 4: Change CI from Preview deployment to Staging promotion gates

**Files:**

- Modify: `.github/workflows/ci.yml`
- Test: `src/lib/docs-check.test.ts`

- [ ] **Step 1: Add workflow source assertions**

Assert:

- CI push branches are `[main, staging]`;
- no `vercel-preview` job remains;
- no Preview Neon branch creation remains;
- no `vercel deploy` command remains in `ci.yml`;
- PR, integration DB, E2E, build, and Knip jobs remain.

- [ ] **Step 2: Run the contract test**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: FAIL while the Preview job exists.

- [ ] **Step 3: Remove only the Preview deployment job**

Change:

```yaml
push:
  branches: [main, staging]
```

Delete the complete `vercel-preview` job. Do not remove ephemeral Neon branches
used by integration DB or E2E.

- [ ] **Step 4: Run tests**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit CI separation**

```powershell
git add .github/workflows/ci.yml src/lib/docs-check.test.ts
git commit -m "ci: replace preview deployment gate"
```

### Task 5: Deploy Staging after successful CI

**Files:**

- Create: `.github/workflows/deploy-staging.yml`
- Test: `src/lib/docs-check.test.ts`

- [ ] **Step 1: Add workflow contract assertions**

Require:

- trigger `workflow_run` for workflow `CI`, branch `staging`, type
  `completed`;
- job condition requires conclusion `success`;
- checkout uses `github.event.workflow_run.head_sha`;
- GitHub Environment is `vercel-staging`;
- exact SHA must equal current `origin/staging`;
- Neon backup is created before migration;
- migration uses `db:migrate:staging`;
- deploy uses `vercel@57.0.0 deploy --target=staging`;
- readiness checks both deployment URL and stable domain;
- stable-domain smoke checks `X-Robots-Tag`;
- secrets are environment variables, never command arguments.

- [ ] **Step 2: Run the contract test**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: FAIL because the workflow is absent.

- [ ] **Step 3: Implement the workflow**

Use:

```yaml
name: Deploy Vercel staging

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [staging]
  workflow_dispatch:

concurrency:
  group: vercel-staging
  cancel-in-progress: false
```

The workflow must:

1. resolve the CI head SHA;
2. verify it is the current `origin/staging`;
3. validate all required GitHub Environment variables by name;
4. create a Neon child backup with seven-day expiration;
5. run the guarded Staging migration;
6. deploy with `--target=staging`;
7. smoke `/api/health/ready` with `HEALTHCHECK_SECRET`;
8. smoke `https://preview.neurocapacitar.com.br`;
9. assert `X-Robots-Tag` contains `noindex`;
10. assert `/sitemap.xml` returns `404`.

The manual trigger exists for bootstrap and recovery. It must still resolve and
verify the current `staging` SHA.

- [ ] **Step 4: Run workflow tests and YAML inspection**

```powershell
bun run test -- src/lib/docs-check.test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit Staging deployment**

```powershell
git add .github/workflows/deploy-staging.yml src/lib/docs-check.test.ts
git commit -m "ci: deploy approved staging sha"
```

### Task 6: Schedule authenticated Staging jobs

**Files:**

- Create: `.github/workflows/run-staging-jobs.yml`
- Test: `src/lib/docs-check.test.ts`

- [ ] **Step 1: Add scheduler contract tests**

Assert the workflow:

- supports `workflow_dispatch`;
- schedules five-minute workers with `*/5 * * * *`;
- schedules enrollment at `0 10 * * *`;
- schedules maintenance at `0 4 * * *`;
- uses only `https://preview.neurocapacitar.com.br`;
- sends `Authorization: Bearer $CRON_SECRET`;
- never prints the secret or response body;
- uses concurrency without cancellation.

- [ ] **Step 2: Run the contract test**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: FAIL because the workflow is absent.

- [ ] **Step 3: Implement scheduled and manual modes**

Scheduled executions call:

- `/api/cron/asaas-webhooks`;
- `/api/cron/outbox`;
- `/api/cron/jmvstream`;
- `/api/cron/enrollments` at its daily schedule;
- `/api/cron/maintenance` at its daily schedule.

At the five-minute schedule, call the three frequent endpoints sequentially
with independent failure reporting. The workflow must fail if any endpoint
returns non-2xx.

GitHub schedules execute only from the default branch. During the first
homologation, run this workflow manually from `staging`; automatic schedules
start after the approved workflow reaches `main`. This bootstrap limitation
must be explicit in the runbook.

- [ ] **Step 4: Run workflow tests**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit scheduler**

```powershell
git add .github/workflows/run-staging-jobs.yml src/lib/docs-check.test.ts
git commit -m "ci: schedule staging workers"
```

### Task 7: Require an explicit Production SHA and maintenance smoke

**Files:**

- Modify: `.github/workflows/deploy-vercel.yml`
- Test: `src/lib/docs-check.test.ts`

- [ ] **Step 1: Add failing release assertions**

Require inputs:

```yaml
release_sha:
  description: Full 40-character SHA from main
  required: true
  type: string
confirmation:
  description: Type DEPLOY_PRODUCTION_MAINTENANCE
  required: true
  type: string
confirm_production:
  required: true
  default: false
  type: boolean
```

Assert checkout uses `release_sha`, the SHA is a commit contained in `main`, CI
for that exact SHA succeeded, a confirmed Neon backup precedes migration, and
the post-promotion smoke expects:

- `/` returns `503`;
- `/entrar` returns `503`;
- `/admin` returns `503`;
- `/api/health` returns success;
- authenticated `/api/health/ready` returns success.

- [ ] **Step 2: Run the contract test**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: FAIL on missing inputs and maintenance smoke.

- [ ] **Step 3: Modify the manual deployment**

Do not change the existing unpromoted deployment, readiness, or promote
sequence. Replace implicit current-main resolution with the explicit SHA,
verify `git merge-base --is-ancestor "$release_sha" origin/main`, and require
the literal confirmation.

Before `db:migrate:production`, require `NEON_API_KEY`,
`PRODUCTION_NEON_PROJECT_ID`, and `PRODUCTION_NEON_BRANCH_ID`. Read the source
branch, verify project/branch/readiness, create a child backup named
`production-release-<UTC timestamp>` with a 14-day expiration, poll until
ready, and emit only its branch ID. If backup confirmation fails, do not run
the migration.

After promotion, execute the maintenance smoke matrix.

- [ ] **Step 4: Run workflow tests**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Production promotion hardening**

```powershell
git add .github/workflows/deploy-vercel.yml src/lib/docs-check.test.ts
git commit -m "ci: require explicit production sha"
```

### Task 8: Add the manual reset workflow

**Files:**

- Create: `.github/workflows/reset-staging.yml`
- Test: `src/lib/docs-check.test.ts`

- [ ] **Step 1: Add workflow assertions**

Require `mode=plan|execute`, fingerprint-free explicit confirmation
`RESET_STAGING_DATA`, GitHub Environment `vercel-staging`, backup before
execute, guarded reset command, and post-reset Admin seed verification.

- [ ] **Step 2: Implement the workflow**

Plan mode:

- validates branch, host, and secrets;
- runs `db:reset:staging -- --mode=plan --environment=staging`;
- performs no Neon or R2 mutation.

Execute mode:

- requires boolean and literal confirmation;
- creates a seven-day Neon backup;
- executes database and R2 reset;
- confirms exactly one Admin profile and no operational rows;
- never prints PII or connection strings.

- [ ] **Step 3: Run workflow tests**

```powershell
bun run test -- src/lib/docs-check.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit reset workflow**

```powershell
git add .github/workflows/reset-staging.yml src/lib/docs-check.test.ts
git commit -m "ci: add manual staging reset"
```

### Task 9: Provision isolated Staging resources

**External changes:** Neon, Vercel, GitHub, Production Vercel credential.

- [ ] **Step 1: Remove the invalid Sandbox key from Production**

Read the Production variable list without values. Remove only
`ASAAS_API_KEY` from Production after confirming checkout and webhook remain
disabled. Redeploy is unnecessary solely to remove an unused variable; the
next explicit Production deployment will consume the new configuration.

Expected: Production has no `ASAAS_API_KEY` and no `ASAAS_WEBHOOK_TOKEN`.

- [ ] **Step 2: Create the persistent Git branch**

Create `staging` from the approved implementation SHA and push it only after
all Plan 1 verification is green.

Expected: `origin/staging` points to the exact approved SHA.

- [ ] **Step 3: Configure branch protection**

Require Pull Requests and the complete `CI` workflow for both `staging` and
`main`. Disable force pushes and deletion. Treat `staging -> main` as the only
documented promotion path; an emergency exception requires an incident record
and the same CI gates.

- [ ] **Step 4: Create the Neon branch**

Create Neon branch `staging` from the project root branch without copying
Production application data. Obtain:

- project ID;
- branch ID;
- normalized direct host;
- pooled runtime URL;
- direct migration URL.

Store URLs only as secrets. Record IDs and host as protected variables.

- [ ] **Step 5: Configure GitHub Environment `vercel-staging`**

Secrets:

- `DATABASE_URL_DIRECT`;
- `HEALTHCHECK_SECRET`;
- `NEON_API_KEY`;
- `STAGING_ADMIN_EMAIL`;
- `STAGING_ADMIN_PASSWORD`;
- `VERCEL_TOKEN`.

Variables:

- `STAGING_DATABASE_HOST`;
- `STAGING_NEON_BRANCH_ID`;
- `STAGING_NEON_PROJECT_ID`;
- `VERCEL_ORG_ID`;
- `VERCEL_PROJECT_ID`;
- `VERCEL_SCOPE=neuro-capacitar`.

- [ ] **Step 6: Create Vercel Custom Environment**

In the existing project:

- create target slug `staging`;
- set exact branch matcher `staging`;
- attach `preview.neurocapacitar.com.br`;
- keep system environment variables exposed;
- verify with `vercel target list`.

- [ ] **Step 7: Configure Vercel Staging variables**

Set all variables required by `getStagingEnvironmentProblems`. Use the pooled
database URL only in web runtime. Do not set `DATABASE_URL_DIRECT`,
`INTERNAL_BOOTSTRAP_SECRET`, E2E variables, or Production Asaas values.

The Asaas token must contain 32–255 characters, contain no spaces, and differ
from the API key. Store secrets as Sensitive.

- [ ] **Step 8: Configure Production maintenance variables**

Set in Production:

```dotenv
APPLICATION_MAINTENANCE_MODE=full
AUTH_PUBLIC_SIGNUP_ENABLED=false
PAYMENTS_CHECKOUT_MODE=disabled
ASAAS_WEBHOOK_ENABLED=false
SCHEDULED_JOBS_ENABLED=false
```

Remove the Sandbox `ASAAS_API_KEY`; keep all other Asaas credentials absent
while maintenance is active. Verify the environment contract from a temporary
pull without printing values. These changes take effect only on the later
explicit Production deployment.

- [ ] **Step 9: Audit Vercel Git deployment settings**

Before the first promotion, prove that merging `staging` or `main` does not
create an automatic Vercel deployment. The only authorized deployments are
`deploy-staging.yml` and the manual Production workflow. If Git integration is
enabled, configure an ignored-build rule for unassigned branches or disable
automatic deployments while preserving repository metadata used by the CLI.

- [ ] **Step 10: Run configuration preflight**

Pull Staging variables to a temporary file, run the contract without printing
values, and delete the file in `finally`.

Expected: `STAGING_ENVIRONMENT_VALID=true`.

### Task 10: Configure domain, R2, and Asaas

**External changes:** Hostinger DNS, Cloudflare R2 CORS, Asaas Sandbox.

- [ ] **Step 1: Configure Hostinger DNS**

Inspect the Vercel domain first. In Hostinger DNS:

- type `CNAME`;
- name `preview`;
- target exactly as supplied by Vercel;
- default TTL.

Remove only a conflicting record for the exact `preview` host. Preserve apex,
mail, Resend, and unrelated records.

- [ ] **Step 2: Verify domain and TLS**

Wait for DNS, then inspect the domain in Vercel. Expected:

- verified domain;
- valid TLS certificate;
- target environment `staging`;
- stable HTTPS response.

- [ ] **Step 3: Update R2 CORS read-before-write**

Read and save the current private-bucket CORS policy. Add only:

```text
https://preview.neurocapacitar.com.br
```

to the existing allowed origins for PUT/GET/HEAD and preserve
`Content-Type`, `ETag`, and max-age. Read the policy again and compare the full
normalized document.

- [ ] **Step 4: Verify R2 browser preflight**

Prepare one disposable signed upload and send an OPTIONS request from the
Staging origin. Expected: `204`, exact allowed origin, PUT, `Content-Type`, and
`ETag`.

- [ ] **Step 5: Create the Asaas Sandbox webhook**

Create one API v3 webhook:

- URL
  `https://preview.neurocapacitar.com.br/api/webhooks/asaas`;
- enabled `true`;
- interrupted `false`;
- send type `SEQUENTIALLY`;
- the exact event set documented in `docs/integrations/asaas.md`;
- auth token identical to the Vercel Staging secret;
- monitored operational email.

The endpoint must persist a valid event before returning success. Never log
the token or API key.

- [ ] **Step 6: Confirm provider configuration**

Read the webhook metadata without secrets. Expected: one enabled Staging
webhook with the exact URL, API version, send type, and event set.

### Task 11: Deploy and homologate Staging

- [ ] **Step 1: Run Plan 1 full verification on the candidate**

```powershell
bun run verify
```

Expected: PASS.

- [ ] **Step 2: Push/merge the candidate to `staging`**

Expected: CI runs for the exact SHA and succeeds.

- [ ] **Step 3: Run Staging deployment**

Use the automatic `workflow_run`, or the manual bootstrap trigger if automatic
schedule/workflow availability requires it.

Expected: backup, migration, deploy, readiness, `noindex`, and sitemap smoke
all pass.

- [ ] **Step 4: Seed the Staging Admin**

Run the guarded seed from `vercel-staging`. Expected: one usable Admin
credential, no PII in logs.

- [ ] **Step 5: Execute the complete manual homologation**

Verify, in order:

1. public signup;
2. login and password recovery;
3. Admin Course creation and publication;
4. R2 cover, banner, material, and certificate template uploads;
5. JMVStream multipart upload and player sync;
6. per-Course price, PIX/card methods, installments, and interest;
7. copyable public purchase URL;
8. PIX Sandbox purchase;
9. card Sandbox purchase with installments;
10. duplicate and delayed webhook delivery;
11. account activation from buyer email;
12. grant, enrollment, progress, and certificate;
13. Resend delivery;
14. manual job invocation and backlog drain;
15. Sentry event tagged `staging`;
16. physical R2 objects only below `staging/`;
17. reset plan mode without writes.

Record IDs and statuses only; do not record PII, tokens, signed URLs, or
financial payloads.

### Task 12: Promote maintenance and retire Preview

- [ ] **Step 1: Open `staging -> main` Pull Request**

Require full CI on the exact candidate. Review code, workflows, migrations,
provider boundaries, and runbooks.

- [ ] **Step 2: Merge without deploying Production**

Confirm no Vercel Production deployment was created by the merge. If Git
integration creates one, stop and disable automatic Production deployments
before continuing.

- [ ] **Step 3: Run scheduled Staging jobs from default branch**

After the workflow reaches `main`, wait for or manually invoke the scheduled
workflow. Expected: the Staging backlog drains with authenticated 2xx calls.

- [ ] **Step 4: Deploy Production maintenance manually**

Dispatch the Production workflow with:

- exact full SHA from `main`;
- boolean confirmation;
- literal `DEPLOY_PRODUCTION_MAINTENANCE`.

Expected: migration/readiness pass, promotion succeeds, all user-facing paths
return maintenance `503`, and technical health paths remain available.

- [ ] **Step 5: Disable automatic Preview deployments**

Verify:

- `ci.yml` contains no Preview deployment;
- Vercel Git settings do not auto-deploy unassigned branches;
- Preview target has no provider credentials;
- no new `ci-preview-*` Neon branch appears.

- [ ] **Step 6: Remove Preview resources after the first approved cycle**

Delete only the GitHub Environment/secrets dedicated to `vercel-preview` and
any confirmed orphaned Preview Neon branch. Preserve integration/E2E branches
and the dormant Preview runtime guard.

- [ ] **Step 7: Run final audits**

Run:

```powershell
bun run verify
git diff --check
git status --short
```

External audit must confirm:

- Staging target, domain, branch, database, and providers;
- Production maintenance and absent Asaas Sandbox key;
- manual Production release;
- no active Preview deployment pipeline;
- no secret values in Git, logs, or documentation.

- [ ] **Step 8: Update canonical evidence**

Update all affected `last_verified_commit` values to the final verified commit,
mark completed migration-plan items, run `bun run docs:check`, and record
remaining accepted risks:

- public-by-link Staging;
- shared Resend reputation;
- shared JMVStream plan;
- shared Development R2 buckets;
- GitHub scheduler delay;
- `noindex` is not access control.
