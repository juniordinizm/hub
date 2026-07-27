# Shared Development Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision a shared Development environment that exercises real test providers while failing closed before any local process can reach Production resources.

**Architecture:** Keep E2E, Vercel Preview and Production unchanged. Add a preflight command in front of `next dev`, a recipient allowlist at the Resend boundary and a remote-development-only seed command. Provision Development resources with provider-scoped credentials; secrets remain outside Git.

**Tech Stack:** Next.js 16, Bun, TypeScript, Vitest, Better Auth, Drizzle/Postgres, Neon, Cloudflare R2, Resend, AbacatePay, JMVStream and Sentry.

---

### Task 1: Provision resources exposed by connected providers

**Files:**
- Modify: `docs/operations/shared-development-and-release-guide.md`

- [ ] **Step 1: Confirm the connected Cloudflare account**

List R2 buckets and require both `neuro-prod-private` and
`neuro-prod-public` before creating anything.

- [ ] **Step 2: Create the two Development buckets**

Create exactly:

```text
hub-development-private
hub-development-public
```

- [ ] **Step 3: Verify both buckets**

List them again and record only names, locations and creation timestamps.

- [ ] **Step 4: Confirm the connected Resend account**

List domains. Proceed only when `neurocapacitar.com.br` is present. If another
account is connected, do not create the Development domain and document the
manual blocker.

- [ ] **Step 5: Record confirmed and manual work**

Update the runbook without recording tokens, DNS values that are not yet
issued, or database URLs.

### Task 2: Add a fail-closed Development preflight

**Files:**
- Create: `src/lib/development-environment.ts`
- Create: `src/lib/development-environment.test.ts`
- Create: `scripts/check-development-environment.ts`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Write failing tests for Production fingerprints**

Test the exported seam
`getDevelopmentEnvironmentProblems(environment)` with literals that prove:

```ts
expect(
  getDevelopmentEnvironmentProblems({
    DATABASE_URL:
      "postgresql://user:secret@ep-hidden-tooth-ac843qc2-pooler.sa-east-1.aws.neon.tech/neondb",
    DATABASE_URL_DIRECT:
      "postgresql://user:secret@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb",
  })
).toEqual(
  expect.arrayContaining([
    "DATABASE_URL must not target the Production Neon compute",
    "DATABASE_URL_DIRECT must not target the Production Neon compute",
  ])
);
```

- [ ] **Step 2: Write failing tests for provider separation**

Require the exact Development bucket names, a Development Resend sender,
AbacatePay dev mode, a non-Production JMVStream plan and a non-Production
Sentry project ID. Assert that returned messages contain variable names but no
credential values.

- [ ] **Step 3: Run the red test**

```powershell
bun run test -- src/lib/development-environment.test.ts
```

Expected: failure because the module does not exist.

- [ ] **Step 4: Implement the pure validator**

Export:

```ts
export const getDevelopmentEnvironmentProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] => {
  // Parse URLs without returning their credentials.
  // Require the approved Development resource fingerprints.
  // Reject the known Production Neon host, R2 buckets, JMV plan and Sentry ID.
  // Return unique, safe messages.
};
```

Approved fingerprints:

```ts
const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const PRODUCTION_PRIVATE_BUCKET = "neuro-prod-private";
const PRODUCTION_PUBLIC_BUCKET = "neuro-prod-public";
const PRODUCTION_JMVSTREAM_PLAN_ID = "OD-20912";
const PRODUCTION_SENTRY_PROJECT_ID = "4511771125219328";
```

Development must explicitly provide:

```text
DEVELOPMENT_DATABASE_HOST
DEVELOPMENT_ABACATEPAY_DEV_MODE=true
DEVELOPMENT_JMVSTREAM_PLAN_ID
DEVELOPMENT_SENTRY_PROJECT_ID
```

- [ ] **Step 5: Implement the preflight script**

Load `.env.local`, call the validator and throw one error containing only the
safe problem list. On success, print the database hostname and resource names,
never credentials.

- [ ] **Step 6: Put preflight in front of Next**

Change:

```json
"dev": "bun scripts/check-development-environment.ts && next dev"
```

Add the four confirmation variables and
`DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST` to `.env.example`.

- [ ] **Step 7: Run the green test**

```powershell
bun run test -- src/lib/development-environment.test.ts
```

Expected: pass.

### Task 3: Prevent Development email from reaching arbitrary recipients

**Files:**
- Create: `src/features/email/development-recipient.ts`
- Create: `src/features/email/development-recipient.test.ts`
- Modify: `src/features/email/server.ts`
- Modify: `src/features/email/server.test.ts`
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Write failing allowlist tests**

Test the exported seam:

```ts
assertDevelopmentEmailRecipientAllowed({
  allowlist: "dev-one@example.com, dev-two@example.com",
  environment: "development",
  recipient: "dev-one@example.com",
});
```

It must accept case-insensitively, reject an absent allowlist in Development,
reject a recipient outside it and allow Production unchanged.

- [ ] **Step 2: Run the red test**

```powershell
bun run test -- src/features/email/development-recipient.test.ts
```

Expected: failure because the module does not exist.

- [ ] **Step 3: Implement the allowlist boundary**

Export:

```ts
export const assertDevelopmentEmailRecipientAllowed = ({
  allowlist,
  environment,
  recipient,
}: {
  allowlist: string | undefined;
  environment: string;
  recipient: string;
}): void => {
  // Production is unchanged.
  // Development requires an exact normalized address in the comma-separated list.
};
```

The error must not echo the recipient.

- [ ] **Step 4: Apply it before constructing the Resend client**

Read `DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST` through `getServerEnv` and call
the guard after the E2E early return and before `new Resend(...)`.

- [ ] **Step 5: Prove provider calls are blocked**

Extend `server.test.ts` so an unlisted Development recipient rejects and
`Resend` is never constructed.

- [ ] **Step 6: Run focused tests**

```powershell
bun run test -- src/features/email/development-recipient.test.ts src/features/email/server.test.ts
```

Expected: pass.

### Task 4: Add a guarded shared Development seed

**Files:**
- Create: `src/lib/shared-development-database.ts`
- Create: `src/lib/shared-development-database.test.ts`
- Create: `scripts/seed-shared-development.ts`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Write failing target validation tests**

Test `assertSharedDevelopmentDatabase` with:

```ts
assertSharedDevelopmentDatabase({
  databaseUrl:
    "postgresql://owner:secret@ep-development-pooler.sa-east-1.aws.neon.tech/neondb",
  expectedHost: "ep-development-pooler.sa-east-1.aws.neon.tech",
  confirmation: "development",
});
```

Reject Production host, hostname mismatch, missing confirmation and localhost.
Never include the URL or password in errors.

- [ ] **Step 2: Run the red test**

```powershell
bun run test -- src/lib/shared-development-database.test.ts
```

Expected: failure because the module does not exist.

- [ ] **Step 3: Implement the database guard**

Return only:

```ts
{ databaseName: string; host: string }
```

Require `SHARED_DEVELOPMENT_SEED_CONFIRMATION=development` and exact hostname
equality with `DEVELOPMENT_DATABASE_HOST`.

- [ ] **Step 4: Implement an idempotent seed**

Read account credentials only from:

```text
DEVELOPMENT_ADMIN_EMAIL
DEVELOPMENT_ADMIN_PASSWORD
DEVELOPMENT_STUDENT_EMAIL
DEVELOPMENT_STUDENT_PASSWORD
```

Use Better Auth to create or locate both accounts, set roles through `profiles`
and insert stable catalog fixtures using conflict-safe keys. Do not execute
E2E teardown, R2 deletion, provider calls or destructive truncation.

- [ ] **Step 5: Add the command**

```json
"db:seed:development": "bun --conditions=react-server scripts/seed-shared-development.ts"
```

- [ ] **Step 6: Run unit tests**

```powershell
bun run test -- src/lib/shared-development-database.test.ts
```

Expected: pass. Do not execute the remote seed until the Neon branch has been
created and its hostname independently confirmed.

### Task 5: Align documentation and verify the repository

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/shared-development-and-release-guide.md`
- Modify: `docs/integrations/abacatepay.md`
- Modify: `docs/integrations/resend.md`

- [ ] **Step 1: Replace the tunnel-first AbacatePay instruction**

Document the official Development flow:

```powershell
abacatepay -l login
abacatepay -l listen --forward-to http://localhost:3000/api/webhooks/abacatepay
abacatepay -l trigger billing.paid
```

The API endpoint remains `https://api.abacatepay.com/v2`; the key selects
Development or Production.

- [ ] **Step 2: Record actual provisioning state**

Mark R2 bucket creation complete. Mark public access, CORS, R2 API key, Neon,
Resend DNS/key, AbacatePay, JMVStream and Sentry as manual until independently
verified.

- [ ] **Step 3: Run formatter and gates**

```powershell
bun x ultracite fix
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run check
bun run test
bun run build
bun run knip
```

Expected: every command exits zero.

- [ ] **Step 4: Review the final diff**

Confirm no `.env.local`, provider token, database URL, password or generated
fixture is tracked.
