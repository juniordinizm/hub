# Staging Runtime and Production Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed Staging runtime, full Production maintenance mode, non-indexable Staging presentation, shared-provider acknowledgements, and an R2 physical namespace without changing logical media keys.

**Architecture:** Resolve the application environment once from Vercel system variables, then delegate validation to isolated pure contracts for Preview, Staging, and Production. Keep maintenance routing as a pure decision module consumed by the single Next.js Proxy. Keep persisted R2 keys logical and apply the `staging/` namespace only at the S3 boundary so existing domain records and key builders remain unchanged.

**Tech Stack:** Next.js 16.2.11 App Router and Proxy, React 19, TypeScript 6, Zod 4, Vitest 4, AWS SDK S3, Sentry Next.js, Bun.

**Design:** `docs/superpowers/specs/2026-07-31-staging-environment-and-production-maintenance-design.md`

---

## File structure

Create:

- `src/lib/runtime-environment.ts`: classify Development, E2E, Preview, Staging, and Production.
- `src/lib/runtime-environment.test.ts`: classification regression tests.
- `src/lib/staging-environment.ts`: pure fail-closed Staging contract.
- `src/lib/staging-environment.test.ts`: provider, URL, database, and switch tests.
- `src/lib/maintenance-mode.ts`: pure request decision for full maintenance.
- `src/lib/maintenance-mode.test.ts`: route/method matrix.
- `src/lib/staging-presentation.ts`: pure Staging metadata and header policy.
- `src/lib/staging-presentation.test.ts`: robots and response-header tests.
- `src/app/manutencao/page.tsx`: user-facing maintenance response.
- `src/components/environment/staging-banner.tsx`: persistent Staging marker.
- `src/features/storage/r2-object-namespace.ts`: logical-to-physical R2 key mapping.
- `src/features/storage/r2-object-namespace.test.ts`: namespace and traversal tests.

Modify:

- `src/lib/env.ts`: parse `VERCEL_TARGET_ENV`, maintenance and Staging variables; dispatch validation.
- `src/lib/env.test.ts`: prove Staging is not handled as Preview.
- `src/lib/application-origin.ts`: prefer the explicit Staging origin.
- `src/lib/application-origin.test.ts`: cover Custom Environment semantics.
- `src/lib/production-environment.ts`: require a coherent maintenance profile.
- `src/lib/production-environment.test.ts`: reject partially open Production.
- `src/proxy.ts`: enforce maintenance before route execution while preserving correlation IDs.
- `src/proxy.test.ts`: verify page rewrite, API/Server Action `503`, and technical exceptions.
- `src/app/layout.tsx`: Staging robots metadata and banner.
- `next.config.ts`: emit `X-Robots-Tag` only for Staging.
- `src/lib/sentry-options.ts`: attach an explicit environment.
- `src/lib/sentry-options.test.ts`: distinguish Staging events.
- `sentry.server.config.ts`: pass `VERCEL_TARGET_ENV`.
- `instrumentation-client.ts`: pass `NEXT_PUBLIC_VERCEL_TARGET_ENV`.
- `src/features/storage/r2.ts`: map every S3 key/prefix at the provider boundary.
- `src/features/storage/public-media.ts`: validate logical public keys while
  allowing a distinct physical URL key.
- `src/features/storage/public-media.test.ts`: preserve public/private
  validation with a namespaced physical key.
- `src/features/storage/r2-conditional.test.ts`: prove physical Staging keys and logical return values.
- `.env.example`: document every new variable.
- canonical environment, R2, deploy, testing, and migration documentation.

Do not modify logical key builders in `r2-objects.ts`, `staged-image-upload.ts`,
certificate modules, or persisted database values.

### Task 1: Classify the runtime independently of `VERCEL_ENV`

**Files:**

- Create: `src/lib/runtime-environment.ts`
- Create: `src/lib/runtime-environment.test.ts`

- [ ] **Step 1: Write the failing classification tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveRuntimeEnvironment } from "./runtime-environment";

describe("resolveRuntimeEnvironment", () => {
  it("gives the custom Staging target precedence over Preview type", () => {
    expect(
      resolveRuntimeEnvironment({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "staging",
      })
    ).toBe("staging");
  });

  it("keeps ordinary Vercel previews isolated", () => {
    expect(
      resolveRuntimeEnvironment({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      })
    ).toBe("preview");
  });

  it("distinguishes E2E, Production, and Development", () => {
    expect(resolveRuntimeEnvironment({ CI: "true", E2E_TEST_MODE: "true" }))
      .toBe("e2e");
    expect(resolveRuntimeEnvironment({ NODE_ENV: "production" }))
      .toBe("production");
    expect(resolveRuntimeEnvironment({ NODE_ENV: "development" }))
      .toBe("development");
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```powershell
bun run test -- src/lib/runtime-environment.test.ts
```

Expected: FAIL because `runtime-environment.ts` does not exist.

- [ ] **Step 3: Implement the pure classifier**

```ts
export type RuntimeEnvironment =
  | "development"
  | "e2e"
  | "preview"
  | "production"
  | "staging";

type Environment = Readonly<Record<string, string | undefined>>;

export const resolveRuntimeEnvironment = (
  environment: Environment
): RuntimeEnvironment => {
  if (
    environment.E2E_TEST_MODE?.trim() === "true" &&
    environment.CI?.trim() === "true"
  ) {
    return "e2e";
  }
  if (environment.VERCEL_TARGET_ENV?.trim() === "staging") {
    return "staging";
  }
  if (
    environment.NODE_ENV === "production" &&
    environment.VERCEL_ENV === "preview"
  ) {
    return "preview";
  }
  return environment.NODE_ENV === "production"
    ? "production"
    : "development";
};
```

- [ ] **Step 4: Run the focused test**

Run:

```powershell
bun run test -- src/lib/runtime-environment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the classifier**

```powershell
git add src/lib/runtime-environment.ts src/lib/runtime-environment.test.ts
git commit -m "feat: classify staging runtime"
```

### Task 2: Add the fail-closed Staging contract

**Files:**

- Create: `src/lib/staging-environment.ts`
- Create: `src/lib/staging-environment.test.ts`

- [ ] **Step 1: Define one complete valid fixture and failing boundary tests**

The fixture must contain:

```ts
const COMPLETE_STAGING_ENVIRONMENT: Record<string, string> = {
  APPLICATION_MAINTENANCE_MODE: "off",
  ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
  ASAAS_API_KEY: "$aact_hmlg_fixture",
  ASAAS_USER_AGENT: "hub/1.0 pagamentos@example.com",
  ASAAS_WEBHOOK_ENABLED: "true",
  ASAAS_WEBHOOK_TOKEN: "staging-webhook-token-at-least-thirty-two-characters",
  AUTH_PUBLIC_SIGNUP_ENABLED: "true",
  BETTER_AUTH_SECRET: "staging-auth-secret-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "https://preview.neurocapacitar.com.br",
  CERTIFICATE_PUBLIC_BASE_URL: "https://preview.neurocapacitar.com.br",
  CLIENT_IP_SOURCE: "x-forwarded-for",
  CRON_SECRET: "staging-cron-secret-at-least-thirty-two-characters",
  DATABASE_URL:
    "postgresql://user:secret@ep-staging-pooler.sa-east-1.aws.neon.tech/neondb",
  HEALTHCHECK_SECRET: "staging-health-secret-at-least-thirty-two-characters",
  JMVSTREAM_AUTH_RESOURCE: "6a05c62e-5e71-47b8-9ac7-9c787ec626db",
  JMVSTREAM_PLAN_ID: "OD-20912",
  NEXT_PUBLIC_APP_URL: "https://preview.neurocapacitar.com.br",
  NEXT_PUBLIC_SENTRY_DSN:
    "https://public@example.ingest.sentry.io/4511999999999999",
  PAYMENTS_CHECKOUT_MODE: "public",
  R2_ACCESS_KEY_ID: "development-r2-key",
  R2_ACCOUNT_ID: "90058d5ae5098fe32c8c0e21209f3c86",
  R2_BUCKET_NAME: "hub-development-private",
  R2_OBJECT_PREFIX: "staging",
  R2_PUBLIC_BASE_URL: "https://pub-development.r2.dev",
  R2_PUBLIC_BUCKET_NAME: "hub-development-public",
  R2_SECRET_ACCESS_KEY: "development-r2-secret",
  RESEND_API_KEY: "re_shared",
  RESEND_FROM_EMAIL:
    "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
  SCHEDULED_JOBS_ENABLED: "true",
  SENTRY_DSN: "https://secret@example.ingest.sentry.io/4511999999999999",
  STAGING_DATABASE_HOST: "ep-staging.sa-east-1.aws.neon.tech",
  STAGING_JMVSTREAM_USES_PRODUCTION: "true",
  STAGING_R2_USES_DEVELOPMENT: "true",
  STAGING_RESEND_USES_PRODUCTION: "true",
  STAGING_SENTRY_PROJECT_ID: "4511999999999999",
  SUPPORT_EMAIL: "suporte@neurocapacitar.com.br",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "staging",
};
```

Tests must assert:

- the complete fixture returns `[]`;
- all three canonical URLs must equal
  `https://preview.neurocapacitar.com.br`;
- `VERCEL_TARGET_ENV` must equal `staging`;
- the normalized database host must equal `STAGING_DATABASE_HOST` and must not
  begin with the known Production compute `ep-hidden-tooth-ac843qc2`;
- Asaas must use the exact Sandbox origin and a key beginning `$aact_hmlg_`;
- the Production key prefix `$aact_prod_` is rejected without echoing the key;
- public signup must equal `true`;
- checkout, webhook, and job switches must be explicitly present but may equal
  `false` during incident containment;
- maintenance must equal `off`;
- R2 bucket names and prefix must equal the approved values;
- the three sharing acknowledgements must equal `true`;
- JMVStream must use plan `OD-20912`;
- Resend must use `neurocapacitar.com.br` without requiring a recipient
  allowlist;
- Sentry DSNs must match `STAGING_SENTRY_PROJECT_ID` and not the Production
  project;
- first-party secrets must contain at least 32 characters;
- `DATABASE_URL_DIRECT`, `INTERNAL_BOOTSTRAP_SECRET`, and E2E-only variables are
  forbidden in the web runtime;
- returned problems contain variable names, never secret values.

- [ ] **Step 2: Run the focused test and verify failure**

```powershell
bun run test -- src/lib/staging-environment.test.ts
```

Expected: FAIL because the contract does not exist.

- [ ] **Step 3: Implement `getStagingEnvironmentProblems`**

Use small pure helpers matching `production-environment.ts`:

```ts
const STAGING_ORIGIN = "https://preview.neurocapacitar.com.br";
const ASAAS_SANDBOX_ORIGIN = "https://api-sandbox.asaas.com";
const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const PRODUCTION_SENTRY_PROJECT_ID = "4511771125219328";
const APPROVED_JMVSTREAM_PLAN_ID = "OD-20912";
const APPROVED_PRIVATE_BUCKET = "hub-development-private";
const APPROVED_PUBLIC_BUCKET = "hub-development-public";
const APPROVED_R2_PREFIX = "staging";
const MINIMUM_SECRET_LENGTH = 32;

type Environment = Readonly<Record<string, string | undefined>>;

export const getStagingEnvironmentProblems = (
  environment: Environment
): string[] => {
  const problems: string[] = [];

  for (const key of [
    "APPLICATION_MAINTENANCE_MODE",
    "ASAAS_API_BASE_URL",
    "ASAAS_API_KEY",
    "ASAAS_USER_AGENT",
    "ASAAS_WEBHOOK_ENABLED",
    "ASAAS_WEBHOOK_TOKEN",
    "AUTH_PUBLIC_SIGNUP_ENABLED",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "CERTIFICATE_PUBLIC_BASE_URL",
    "CLIENT_IP_SOURCE",
    "CRON_SECRET",
    "DATABASE_URL",
    "HEALTHCHECK_SECRET",
    "JMVSTREAM_PLAN_ID",
    "NEXT_PUBLIC_APP_URL",
    "PAYMENTS_CHECKOUT_MODE",
    "R2_ACCESS_KEY_ID",
    "R2_ACCOUNT_ID",
    "R2_BUCKET_NAME",
    "R2_OBJECT_PREFIX",
    "R2_PUBLIC_BASE_URL",
    "R2_PUBLIC_BUCKET_NAME",
    "R2_SECRET_ACCESS_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "SCHEDULED_JOBS_ENABLED",
    "SENTRY_DSN",
    "STAGING_DATABASE_HOST",
    "STAGING_JMVSTREAM_USES_PRODUCTION",
    "STAGING_R2_USES_DEVELOPMENT",
    "STAGING_RESEND_USES_PRODUCTION",
    "STAGING_SENTRY_PROJECT_ID",
    "SUPPORT_EMAIL",
    "VERCEL_TARGET_ENV",
  ] as const) {
    if (!environment[key]?.trim()) {
      problems.push(`${key} is required`);
    }
  }

  // Append the exact URL, host, provider, acknowledgement, enum, and secret
  // problems enumerated in Step 1. Each branch emits only a constant message
  // such as "ASAAS_API_BASE_URL must equal https://api-sandbox.asaas.com" or
  // "DATABASE_URL must target STAGING_DATABASE_HOST".

  return [...new Set(problems)];
};
```

Implement named helpers `readUrl`, `normalizeNeonHost`,
`readSentryProjectId`, `getCanonicalOriginProblems`, `getDatabaseProblems`,
`getAsaasProblems`, `getR2Problems`, `getJmvstreamProblems`,
`getResendProblems`, `getSentryProblems`, `getSwitchProblems`,
`getSecretProblems`, and `getForbiddenVariableProblems`. Concatenate their
results after the required-variable loop. Each helper corresponds one-to-one
with the assertions from Step 1 and emits only constant safe messages. Do not
import `getDevelopmentEnvironmentProblems`: Staging deliberately omits the
Development Resend allowlist and permits Vercel system variables.

- [ ] **Step 4: Run the contract tests**

```powershell
bun run test -- src/lib/staging-environment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the isolated contract**

```powershell
git add src/lib/staging-environment.ts src/lib/staging-environment.test.ts
git commit -m "feat: validate staging environment"
```

### Task 3: Wire Staging into runtime parsing and canonical URLs

**Files:**

- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`
- Modify: `src/lib/application-origin.ts`
- Modify: `src/lib/application-origin.test.ts`

- [ ] **Step 1: Add failing integration tests**

Add an `env.test.ts` fixture with `NODE_ENV=production`,
`VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=staging`, and the complete Staging
configuration. Assert that `getServerEnv()`:

```ts
expect(env.VERCEL_TARGET_ENV).toBe("staging");
expect(env.NEXT_PUBLIC_APP_URL).toBe(
  "https://preview.neurocapacitar.com.br"
);
expect(env.PAYMENTS_CHECKOUT_MODE).toBe("public");
expect(env.ASAAS_WEBHOOK_ENABLED).toBe(true);
```

Add a second test with the same `VERCEL_ENV=preview` but no custom target and
assert that provider credentials are still rejected by the Preview contract.

Add an `application-origin.test.ts` case proving explicit Staging URLs win over
`VERCEL_BRANCH_URL`:

```ts
expect(
  resolveCanonicalApplicationEnvironment({
    NEXT_PUBLIC_APP_URL: "https://preview.neurocapacitar.com.br",
    VERCEL_BRANCH_URL: "transient.vercel.app",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "staging",
  }).NEXT_PUBLIC_APP_URL
).toBe("https://preview.neurocapacitar.com.br");
```

- [ ] **Step 2: Run the focused tests and verify failure**

```powershell
bun run test -- src/lib/env.test.ts src/lib/application-origin.test.ts
```

Expected: FAIL because Staging is routed through Preview.

- [ ] **Step 3: Extend the schema and dispatch by runtime environment**

Add to `serverEnvSchema` and `rawEnvironment`:

```ts
APPLICATION_MAINTENANCE_MODE: z.enum(["full", "off"]).default("off"),
R2_OBJECT_PREFIX: optionalNonEmptyString,
STAGING_DATABASE_HOST: optionalNonEmptyString,
STAGING_JMVSTREAM_USES_PRODUCTION: optionalNonEmptyString,
STAGING_R2_USES_DEVELOPMENT: optionalNonEmptyString,
STAGING_RESEND_USES_PRODUCTION: optionalNonEmptyString,
STAGING_SENTRY_PROJECT_ID: optionalNonEmptyString,
VERCEL_TARGET_ENV: optionalNonEmptyString,
```

Replace the Preview-first conditional with:

```ts
const runtimeEnvironment = resolveRuntimeEnvironment(rawEnvironment);

if (runtimeEnvironment === "staging") {
  const problems = getStagingEnvironmentProblems(rawEnvironment);
  if (problems.length > 0) {
    throw new Error(`Staging environment is invalid: ${problems.join(", ")}.`);
  }
  return;
}

if (runtimeEnvironment === "preview") {
  const problems = getPreviewEnvironmentProblems(rawEnvironment);
  if (problems.length > 0) {
    throw new Error(`Preview environment is invalid: ${problems.join(", ")}.`);
  }
  return;
}
```

Defaults must use `runtimeEnvironment`, so only ordinary Preview defaults to
disabled. Staging requires explicit payment and webhook values.

Extend `CanonicalApplicationEnvironment` with `VERCEL_TARGET_ENV`; derive a
transient Vercel origin only when the runtime is ordinary Preview, never when
the target is `staging`.

- [ ] **Step 4: Run environment tests**

```powershell
bun run test -- src/lib/runtime-environment.test.ts src/lib/staging-environment.test.ts src/lib/env.test.ts src/lib/application-origin.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit runtime wiring**

```powershell
git add src/lib/env.ts src/lib/env.test.ts src/lib/application-origin.ts src/lib/application-origin.test.ts
git commit -m "feat: wire staging runtime contract"
```

### Task 4: Enforce coherent full maintenance in Production

**Files:**

- Modify: `src/lib/production-environment.ts`
- Modify: `src/lib/production-environment.test.ts`

- [ ] **Step 1: Write failing maintenance profile tests**

Set the complete Production fixture to:

```ts
APPLICATION_MAINTENANCE_MODE: "full",
AUTH_PUBLIC_SIGNUP_ENABLED: "false",
PAYMENTS_CHECKOUT_MODE: "disabled",
ASAAS_WEBHOOK_ENABLED: "false",
SCHEDULED_JOBS_ENABLED: "false",
```

Remove all other `ASAAS_*` values from that complete maintenance fixture. Assert
it is accepted. Add table-driven cases that change one value at a time and
expect:

```ts
[
  ["AUTH_PUBLIC_SIGNUP_ENABLED", "true"],
  ["PAYMENTS_CHECKOUT_MODE", "public"],
  ["ASAAS_WEBHOOK_ENABLED", "true"],
  ["SCHEDULED_JOBS_ENABLED", "true"],
]
```

Each case must return a problem naming the inconsistent switch. Add a test that
`APPLICATION_MAINTENANCE_MODE` is required explicitly in Production.

- [ ] **Step 2: Run the focused test**

```powershell
bun run test -- src/lib/production-environment.test.ts
```

Expected: FAIL because Production has no maintenance contract.

- [ ] **Step 3: Add maintenance validation**

Add `APPLICATION_MAINTENANCE_MODE` and `AUTH_PUBLIC_SIGNUP_ENABLED` to
`REQUIRED_PRODUCTION_VARIABLES`. Validate `full|off`. When `full`, require all
four containment switches from Step 1. Preserve the existing Asaas capability
rules for maintenance `off`.

- [ ] **Step 4: Run Production and environment tests**

```powershell
bun run test -- src/lib/production-environment.test.ts src/lib/env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the Production contract**

```powershell
git add src/lib/production-environment.ts src/lib/production-environment.test.ts
git commit -m "feat: require coherent production maintenance"
```

### Task 5: Block user-facing Production traffic at Proxy

**Files:**

- Create: `src/lib/maintenance-mode.ts`
- Create: `src/lib/maintenance-mode.test.ts`
- Create: `src/app/manutencao/page.tsx`
- Modify: `src/proxy.ts`
- Modify: `src/proxy.test.ts`

- [ ] **Step 1: Write the pure request matrix**

```ts
import { describe, expect, it } from "vitest";
import { getMaintenanceRequestDecision } from "./maintenance-mode";

describe("maintenance request decision", () => {
  it.each([
    "/api/health",
    "/api/health/ready",
    "/api/cron/asaas-webhooks",
    "/manutencao",
  ])("allows technical path %s", (pathname) => {
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "GET",
        pathname,
      })
    ).toBe("allow");
  });

  it("rewrites navigations and rejects APIs or mutations", () => {
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "GET",
        pathname: "/entrar",
      })
    ).toBe("maintenance-page");
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "POST",
        pathname: "/entrar",
      })
    ).toBe("service-unavailable");
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "GET",
        pathname: "/api/courses",
      })
    ).toBe("service-unavailable");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

```powershell
bun run test -- src/lib/maintenance-mode.test.ts
```

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the pure decision**

```ts
export type MaintenanceMode = "full" | "off";
export type MaintenanceRequestDecision =
  | "allow"
  | "maintenance-page"
  | "service-unavailable";

const ALLOWED_EXACT_PATHS = new Set([
  "/api/health",
  "/api/health/ready",
  "/manutencao",
]);

export const getMaintenanceRequestDecision = ({
  maintenanceMode,
  method,
  pathname,
}: {
  maintenanceMode: MaintenanceMode;
  method: string;
  pathname: string;
}): MaintenanceRequestDecision => {
  if (
    maintenanceMode === "off" ||
    ALLOWED_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/api/cron/")
  ) {
    return "allow";
  }
  if (
    !["GET", "HEAD"].includes(method) ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  ) {
    return "service-unavailable";
  }
  return "maintenance-page";
};
```

- [ ] **Step 4: Add Proxy behavior tests**

Assert:

- ordinary mode preserves the correlation ID behavior;
- `GET /admin` in full mode rewrites to `/manutencao` with status `503`;
- `POST /admin` and `GET /api/checkouts/course` return JSON `503`,
  `Retry-After: 3600`, and a correlation ID;
- both health routes and a cron route call `NextResponse.next`;
- `/manutencao` never loops.

Use `vi.stubEnv("APPLICATION_MAINTENANCE_MODE", "full")` and restore env after
each test.

- [ ] **Step 5: Implement Proxy containment and the page**

In `proxy.ts`, calculate the correlation ID first. Then:

```ts
const decision = getMaintenanceRequestDecision({
  maintenanceMode:
    process.env.APPLICATION_MAINTENANCE_MODE === "full" ? "full" : "off",
  method: request.method,
  pathname: request.nextUrl.pathname,
});
```

For `service-unavailable`, return a direct JSON `NextResponse` with status 503,
`Retry-After`, and correlation ID. For `maintenance-page`, rewrite to
`/manutencao` with status 503. For `allow`, preserve the current request-header
and response-header propagation.

The maintenance page must be a Server Component with:

```tsx
export default function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="max-w-xl text-center">
        <p className="font-medium text-primary">Neuro Capacitar</p>
        <h1 className="mt-3 text-3xl font-semibold">Ambiente em manutenção</h1>
        <p className="mt-4 text-muted-foreground">
          Estamos preparando a plataforma. Tente novamente mais tarde.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Run the request-boundary tests**

```powershell
bun run test -- src/lib/maintenance-mode.test.ts src/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit maintenance routing**

```powershell
git add src/lib/maintenance-mode.ts src/lib/maintenance-mode.test.ts src/app/manutencao/page.tsx src/proxy.ts src/proxy.test.ts
git commit -m "feat: close production for maintenance"
```

### Task 6: Mark Staging and prevent indexing

**Files:**

- Create: `src/components/environment/staging-banner.tsx`
- Create: `src/lib/staging-presentation.ts`
- Create: `src/lib/staging-presentation.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Add source-level and configuration tests**

Use this pure contract:

```ts
import type { Metadata } from "next";

type Environment = Readonly<Record<string, string | undefined>>;

export const getStagingPresentation = (
  environment: Environment
): {
  headers: Array<{ key: string; value: string }>;
  isStaging: boolean;
  robots?: Metadata["robots"];
} => {
  const isStaging = environment.VERCEL_TARGET_ENV?.trim() === "staging";
  return {
    headers: isStaging
      ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
      : [],
    isStaging,
    ...(isStaging
      ? { robots: { follow: false, index: false } }
      : {}),
  };
};
```

Add assertions that when `VERCEL_TARGET_ENV=staging`:

- root metadata contains `robots: { follow: false, index: false }`;
- the root layout renders `StagingBanner`;
- the banner contains `Ambiente de homologação`;
- `next.config.ts` adds `X-Robots-Tag: noindex, nofollow`;
- a non-Staging synthetic build does not add the header.

Test `getStagingPresentation` directly. In the same test file, read
`src/app/layout.tsx` and assert:

```ts
const layoutSource = readFileSync(
  resolve(process.cwd(), "src/app/layout.tsx"),
  "utf8"
);
expect(layoutSource).toContain("<StagingBanner />");
```

Do not parse rendered React internals.

- [ ] **Step 2: Run the focused tests and verify failure**

```powershell
bun run test -- src/lib/staging-presentation.test.ts
```

Expected: FAIL on the new Staging assertions.

- [ ] **Step 3: Implement metadata, banner, and response header**

Create a server component:

```tsx
export function StagingBanner() {
  return (
    <aside className="sticky top-0 z-50 bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      Ambiente de homologação: dados e pagamentos são apenas testes.
    </aside>
  );
}
```

In `layout.tsx`, compute
`const stagingPresentation = getStagingPresentation(process.env)`, spread its
robots value into metadata when present, and render the banner before
`children` when `isStaging` is true.

In `next.config.ts`, append `getStagingPresentation(process.env).headers` to
the existing security headers:

```ts
{
  key: "X-Robots-Tag",
  value: "noindex, nofollow",
}
```

Do not add a sitemap. Confirm `/sitemap.xml` remains 404 during deployment
smoke.

- [ ] **Step 4: Run tests and a synthetic Staging build**

```powershell
bun run test -- src/lib/staging-presentation.test.ts
$env:VERCEL_TARGET_ENV='staging'
$env:NEXT_PUBLIC_APP_URL='https://preview.neurocapacitar.com.br'
$env:BETTER_AUTH_URL='https://preview.neurocapacitar.com.br'
$env:CERTIFICATE_PUBLIC_BASE_URL='https://preview.neurocapacitar.com.br'
$env:BETTER_AUTH_SECRET='synthetic-staging-build-secret-at-least-thirty-two'
bun run build
Remove-Item Env:VERCEL_TARGET_ENV
```

Expected: tests and build PASS.

- [ ] **Step 5: Commit Staging presentation**

```powershell
git add src/components/environment/staging-banner.tsx src/lib/staging-presentation.ts src/lib/staging-presentation.test.ts src/app/layout.tsx next.config.ts
git commit -m "feat: mark staging as non-indexable"
```

### Task 7: Attach the Staging environment to Sentry events

**Files:**

- Modify: `src/lib/sentry-options.ts`
- Modify: `src/lib/sentry-options.test.ts`
- Modify: `sentry.server.config.ts`
- Modify: `instrumentation-client.ts`

- [ ] **Step 1: Add a failing Sentry option test**

```ts
expect(
  getSentryOptions("https://public@example.ingest.sentry.io/1", "staging")
).toMatchObject({ environment: "staging" });
```

- [ ] **Step 2: Run the focused test**

```powershell
bun run test -- src/lib/sentry-options.test.ts
```

Expected: FAIL because the helper accepts one argument.

- [ ] **Step 3: Add the optional environment**

Change the signature to:

```ts
export const getSentryOptions = (
  dsn: string | undefined,
  environment?: string
) => ({
  beforeSend: sanitizeSentryEvent,
  dsn,
  enabled: Boolean(dsn),
  ...(environment ? { environment } : {}),
  sendDefaultPii: false,
  tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
});
```

Pass `process.env.VERCEL_TARGET_ENV` on the server and
`process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV` in the client.

- [ ] **Step 4: Run the test**

```powershell
bun run test -- src/lib/sentry-options.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit observability classification**

```powershell
git add src/lib/sentry-options.ts src/lib/sentry-options.test.ts sentry.server.config.ts instrumentation-client.ts
git commit -m "feat: classify staging sentry events"
```

### Task 8: Namespace physical R2 keys

**Files:**

- Create: `src/features/storage/r2-object-namespace.ts`
- Create: `src/features/storage/r2-object-namespace.test.ts`
- Modify: `src/features/storage/r2.ts`
- Modify: `src/features/storage/public-media.ts`
- Modify: `src/features/storage/public-media.test.ts`
- Modify: `src/features/storage/r2-conditional.test.ts`

- [ ] **Step 1: Write namespace tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createR2ObjectNamespace,
  parseR2ObjectPrefix,
} from "./r2-object-namespace";

describe("R2 object namespace", () => {
  it("keeps logical keys unchanged without a prefix", () => {
    const namespace = createR2ObjectNamespace(undefined);
    expect(namespace.toPhysicalKey("courses/a/cover.webp"))
      .toBe("courses/a/cover.webp");
  });

  it("maps Staging keys and prefixes to one physical namespace", () => {
    const namespace = createR2ObjectNamespace("staging");
    expect(namespace.toPhysicalKey("courses/a/cover.webp"))
      .toBe("staging/courses/a/cover.webp");
    expect(namespace.toPhysicalPrefix("uploads/admin-images/"))
      .toBe("staging/uploads/admin-images/");
    expect(namespace.toLogicalKey("staging/courses/a/cover.webp"))
      .toBe("courses/a/cover.webp");
  });

  it.each(["/staging", "staging/", "stage/../prod", ".", "..", "a/b"])(
    "rejects unsafe prefix %s",
    (prefix) => expect(() => parseR2ObjectPrefix(prefix)).toThrow()
  );
});
```

- [ ] **Step 2: Run the focused test**

```powershell
bun run test -- src/features/storage/r2-object-namespace.test.ts
```

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the mapping**

```ts
const SAFE_PREFIX = /^[a-z0-9][a-z0-9_-]*$/;

export const parseR2ObjectPrefix = (
  value: string | undefined
): string | undefined => {
  const prefix = value?.trim();
  if (!prefix) {
    return;
  }
  if (!SAFE_PREFIX.test(prefix)) {
    throw new Error("R2_OBJECT_PREFIX is invalid.");
  }
  return prefix;
};

export const createR2ObjectNamespace = (value: string | undefined) => {
  const prefix = parseR2ObjectPrefix(value);
  const physicalPrefix = prefix ? `${prefix}/` : "";
  return {
    toLogicalKey(key: string): string {
      if (!physicalPrefix) {
        return key;
      }
      if (!key.startsWith(physicalPrefix)) {
        throw new Error("R2 object escaped its namespace.");
      }
      return key.slice(physicalPrefix.length);
    },
    toPhysicalKey(key: string): string {
      return `${physicalPrefix}${key}`;
    },
    toPhysicalPrefix(keyPrefix: string): string {
      return `${physicalPrefix}${keyPrefix}`;
    },
  };
};
```

- [ ] **Step 4: Apply mapping to every S3 command**

Create one namespace inside `getR2Config()` from `R2_OBJECT_PREFIX` and add it
to `R2Config`. For every `PutObjectCommand`, `GetObjectCommand`,
`HeadObjectCommand`, `CopyObjectCommand`, `DeleteObjectsCommand`, and
`ListObjectsV2Command` in `r2.ts`:

- convert logical `Key` to `toPhysicalKey(key)`;
- convert list `Prefix` to `toPhysicalPrefix(prefix)`;
- map listed physical keys back through `toLogicalKey` before passing them to
  domain logic;
- use the physical source and destination in `CopyObject`;
- pass the physical key to `buildPublicMediaUrl`, while continuing to validate
  the logical key before mapping;
- keep return objects and database records on logical keys.

Error messages from batch deletion must not expose physical keys.

Change `buildPublicMediaUrl` to accept a separately validated logical key:

```ts
export const buildPublicMediaUrl = ({
  baseUrl,
  key,
  physicalKey = key,
}: {
  baseUrl: string;
  key: string;
  physicalKey?: string;
}): string => {
  if (!isPublicMediaKey(key)) {
    throw new Error("Chave de mídia pública inválida.");
  }
  return new URL(
    physicalKey,
    `${baseUrl.replace(TRAILING_SLASH_PATTERN, "")}/`
  ).toString();
};
```

`getPublicMediaUrl` passes the logical key as `key` and
`namespace.toPhysicalKey(key)` as `physicalKey`. This preserves the
`banners/|courses/` authorization boundary while producing a
`staging/banners/...` or `staging/courses/...` URL.

- [ ] **Step 5: Extend AWS command tests**

With `vi.stubEnv("R2_OBJECT_PREFIX", "staging")`, assert:

- prepared PUT signs `staging/uploads/...`;
- lesson HEAD reads `staging/lessons/...`;
- publishing copies from and writes to `staging/courses/...`;
- certificate conditional PUT uses `staging/certificates/...`;
- staged-image listing uses `staging/uploads/admin-images/`;
- returned domain references remain `courses/...`, `lessons/...`, or
  `certificates/...`;
- deleting a logical key can never delete an unprefixed object.

- [ ] **Step 6: Run the storage suite**

```powershell
bun run test -- src/features/storage/r2-object-namespace.test.ts src/features/storage/r2-objects.test.ts src/features/storage/r2-conditional.test.ts src/features/storage/public-media.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the provider boundary**

```powershell
git add src/features/storage/r2-object-namespace.ts src/features/storage/r2-object-namespace.test.ts src/features/storage/r2.ts src/features/storage/public-media.ts src/features/storage/public-media.test.ts src/features/storage/r2-conditional.test.ts
git commit -m "feat: isolate staging r2 objects"
```

### Task 9: Document and verify the runtime contract

**Files:**

- Modify: `.env.example`
- Modify: `docs/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/integrations/r2.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/deploy-and-incidents.md`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/Plano de migracao.md`

- [ ] **Step 1: Add every new variable to `.env.example`**

Document:

```dotenv
APPLICATION_MAINTENANCE_MODE=off
VERCEL_TARGET_ENV=
R2_OBJECT_PREFIX=
STAGING_DATABASE_HOST=
STAGING_JMVSTREAM_USES_PRODUCTION=false
STAGING_R2_USES_DEVELOPMENT=false
STAGING_RESEND_USES_PRODUCTION=false
STAGING_SENTRY_PROJECT_ID=
```

Also describe `NEXT_PUBLIC_VERCEL_TARGET_ENV` as Vercel-managed and never
manually set in Development.

- [ ] **Step 2: Update canonical docs once**

Define the five-environment topology in
`environment-and-local-development.md`; reference it elsewhere instead of
duplicating it. Record:

- maintenance routing and technical exceptions;
- Staging provider sharing and accepted risks;
- logical versus physical R2 keys;
- no automatic data retention;
- GitHub scheduler latency;
- noindex limitations;
- removal of the Sandbox key from Production;
- Preview as a dormant fail-closed target.

Update `last_verified_commit` only after the implementation commit exists.

- [ ] **Step 3: Run focused tests and documentation checks**

```powershell
bun run test -- src/lib/runtime-environment.test.ts src/lib/staging-environment.test.ts src/lib/production-environment.test.ts src/lib/env.test.ts src/lib/application-origin.test.ts src/lib/maintenance-mode.test.ts src/proxy.test.ts src/lib/sentry-options.test.ts src/features/storage/r2-object-namespace.test.ts src/features/storage/r2-conditional.test.ts
bun run docs:check
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 4: Run full verification**

```powershell
bun run verify
```

Expected: docs, migrations, types, Ultracite, tests, build, and Knip PASS.

- [ ] **Step 5: Commit the canonical contract**

```powershell
git add .env.example docs src next.config.ts sentry.server.config.ts instrumentation-client.ts
git commit -m "docs: define staging runtime operations"
```

### Task 10: Review Plan 1 acceptance

- [ ] **Step 1: Prove the exact runtime stories locally**

Run the unit suites with three synthetic profiles:

- ordinary Preview with no providers;
- Staging with complete test providers;
- Production full maintenance with no Asaas credentials.

Expected: all three profiles validate; cross-environment combinations fail.

- [ ] **Step 2: Inspect the complete diff**

```powershell
git status --short
git diff --stat
git diff --check
```

Expected: only files named in this plan plus previously approved documentation
changes.

- [ ] **Step 3: Record the handoff**

Do not create infrastructure yet. Record:

- exact commit SHA;
- verification commands and results;
- remaining external requirements: Neon Staging, Vercel target, DNS, provider
  secrets, R2 CORS, webhook, and workflows.

Proceed to
`docs/superpowers/plans/2026-08-01-staging-provisioning-and-release.md`.
