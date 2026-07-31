# Asaas Production Cutover Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar contenção compatível com o schema `0043`, limpeza transacional dos dados de teste preservando uma Conta Admin e os controles necessários para publicar o Asaas com segurança.

**Architecture:** O corte usa duas releases. A Release A adiciona somente o modo de checkout e continua compatível com AbacatePay/schema `0043`; a Release B contém a implementação Asaas, um kill switch próprio de webhook e um workflow destrutivo separado. A limpeza divide regras puras, executor PostgreSQL e orquestração GitHub/Neon, com allowlist fechada, fingerprint e backup antes da escrita.

**Tech Stack:** TypeScript 6, Bun 1.3, Vitest 4, PostgreSQL 17/`pg`, Next.js 16 App Router, GitHub Actions, Neon API v2, Vercel.

---

## File map

### Release A: contenção compatível com `0043`

- Create `src/features/payments/checkout-availability.ts`: política pura dos modos `disabled`, `authenticated` e `public`.
- Create `src/features/payments/checkout-availability.test.ts`: matriz unitária de entrada/modo.
- Modify `src/lib/env.ts`: parse e default seguro por ambiente.
- Modify `src/lib/production-environment.ts`: exigir valor explícito em Production.
- Modify `src/lib/preview-environment.ts`: exigir `disabled` em Preview.
- Modify `src/lib/env.test.ts`, `src/lib/production-environment.test.ts`, `src/lib/preview-environment.test.ts`: contratos de configuração.
- Modify `src/features/payments/actions.ts`: bloquear a entrada autenticada antes de DB/provider.
- Modify `src/app/api/checkouts/course/route.ts`: bloquear a entrada pública antes de body, rate limit, DB/provider.
- Modify `src/features/payments/actions.test.ts` e `src/app/api/checkouts/course/route.test.ts`: provar ausência de efeitos.
- Modify `src/lib/env.ts`, contratos de ambiente e `.env.example`: adicionar
  `ABACATEPAY_WEBHOOK_ENABLED`, explícita em Production e falsa em Preview.
- Modify `src/app/api/webhooks/abacatepay/route.ts` e criar teste: com a flag falsa,
  responder `204` antes de body, segredo, banco ou processor.

### Release B: webhook Asaas e limpeza

- Modify `src/lib/env.ts`, `src/lib/production-environment.ts`, `src/lib/preview-environment.ts` e testes: `ASAAS_WEBHOOK_ENABLED`.
- Modify `src/app/api/webhooks/asaas/route.ts` e teste: recusar antes de body/token/DB.
- Modify `src/app/api/cron/asaas-webhooks/route.ts` e teste: não adquirir lease nem executar worker quando desabilitado.
- Create `src/db/production-cleanup.ts`: allowlist, argumentos, snapshot, fingerprint e validações puras.
- Create `src/db/production-cleanup.test.ts`: contrato puro completo.
- Create `src/db/production-cleanup-executor.ts`: consultas, locks, transação e pós-condições.
- Create `src/db/production-cleanup-executor.test.ts`: sequência SQL e rollback com cliente falso.
- Create `src/db/production-cleanup-executor.integration.test.ts`: prova PostgreSQL em schema isolado.
- Create `scripts/cleanup-production-test-data.ts`: CLI segura `plan|execute`.
- Create `src/tooling/cleanup-production-test-data.test.ts`: contrato do entrypoint sem conexão real.
- Modify `package.json`: comando `db:cleanup:production`.
- Create `.github/workflows/cleanup-production-test-data.yml`: workflow manual sem deploy/migration.
- Modify `src/tooling/release-workflows.test.ts`: contrato estático do workflow.
- Modify `.env.example`, `docs/operations/database-and-migrations.md`, `docs/operations/deploy-and-incidents.md`, `docs/integrations/asaas.md` e `docs/Plano de migracao.md`: contrato e progresso.

## Task 1: Modelar o modo de checkout

**Files:**

- Create: `src/features/payments/checkout-availability.ts`
- Create: `src/features/payments/checkout-availability.test.ts`

- [x] **Step 1: escrever o teste falho da matriz**

```ts
import { describe, expect, it } from "vitest";
import {
  assertCheckoutAvailable,
  CheckoutUnavailableError,
} from "./checkout-availability";

describe("checkout availability", () => {
  it.each([
    ["disabled", "authenticated", false],
    ["disabled", "public", false],
    ["authenticated", "authenticated", true],
    ["authenticated", "public", false],
    ["public", "authenticated", true],
    ["public", "public", true],
  ] as const)(
    "%s mode / %s entry => allowed=%s",
    (mode, entry, allowed) => {
      const invoke = () => assertCheckoutAvailable({ entry, mode });

      if (allowed) {
        expect(invoke).not.toThrow();
      } else {
        expect(invoke).toThrow(CheckoutUnavailableError);
      }
    }
  );
});
```

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/features/payments/checkout-availability.test.ts
```

Expected: FAIL porque `checkout-availability.ts` não existe.

- [x] **Step 3: implementar a política mínima**

```ts
export type CheckoutEntry = "authenticated" | "public";
export type PaymentsCheckoutMode = "authenticated" | "disabled" | "public";

export class CheckoutUnavailableError extends Error {
  constructor() {
    super("Checkout indisponivel.");
    this.name = "CheckoutUnavailableError";
  }
}

export const assertCheckoutAvailable = ({
  entry,
  mode,
}: {
  entry: CheckoutEntry;
  mode: PaymentsCheckoutMode;
}): void => {
  const allowed =
    mode === "public" ||
    (mode === "authenticated" && entry === "authenticated");

  if (!allowed) {
    throw new CheckoutUnavailableError();
  }
};
```

- [x] **Step 4: confirmar GREEN**

Run:

```text
bun x vitest run src/features/payments/checkout-availability.test.ts
```

Expected: 6 casos PASS.

- [x] **Step 5: checkpoint sem commit**

Não executar `git commit`: o repositório exige autorização explícita. Registrar a tarefa como implementada em `docs/Plano de migracao.md`.

## Task 2: Tornar o modo obrigatório e seguro por ambiente

**Files:**

- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`
- Modify: `src/lib/production-environment.ts`
- Modify: `src/lib/production-environment.test.ts`
- Modify: `src/lib/preview-environment.ts`
- Modify: `src/lib/preview-environment.test.ts`
- Modify: `.env.example`

- [x] **Step 1: escrever testes falhos**

Adicionar aos testes de ambiente:

```ts
it("requires an explicit checkout mode in Production", () => {
  const environment = { ...COMPLETE_PRODUCTION_ENVIRONMENT };
  delete environment.PAYMENTS_CHECKOUT_MODE;

  expect(getProductionEnvironmentProblems(environment)).toContain(
    "PAYMENTS_CHECKOUT_MODE"
  );
});

it.each(["authenticated", "public"])(
  "rejects %s checkout mode in Preview",
  (mode) => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        PAYMENTS_CHECKOUT_MODE: mode,
      })
    ).toContain("PAYMENTS_CHECKOUT_MODE must equal disabled in Preview");
  }
);
```

No teste de `getServerEnv`, usar módulos isolados e provar:

```ts
expect(loadEnv({ NODE_ENV: "development" }).PAYMENTS_CHECKOUT_MODE).toBe(
  "public"
);
expect(
  loadEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" })
    .PAYMENTS_CHECKOUT_MODE
).toBe("disabled");
```

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/lib/env.test.ts src/lib/production-environment.test.ts src/lib/preview-environment.test.ts
```

Expected: FAIL nas novas expectativas.

- [x] **Step 3: implementar parsing e validação**

Em `src/lib/env.ts`, adicionar ao schema:

```ts
PAYMENTS_CHECKOUT_MODE: z.enum(["disabled", "authenticated", "public"]),
```

Antes do parse, completar somente o valor efetivo:

```ts
const sourceEnvironment =
  resolveCanonicalApplicationEnvironment(rawEnvironment);
const environmentWithCheckoutDefault = {
  ...sourceEnvironment,
  PAYMENTS_CHECKOUT_MODE:
    sourceEnvironment.PAYMENTS_CHECKOUT_MODE ??
    (sourceEnvironment.VERCEL_ENV === "preview" ? "disabled" : "public"),
};
const env = serverEnvSchema.parse(environmentWithCheckoutDefault);
```

Manter `rawEnvironment.PAYMENTS_CHECKOUT_MODE` sem default para os validadores distinguirem ausência em Production.

Em `production-environment.ts`:

```ts
const REQUIRED_PRODUCTION_VARIABLES = [
  // valores existentes
  "PAYMENTS_CHECKOUT_MODE",
] as const;
```

e validar o enum sem repetir valores sensíveis:

```ts
if (
  hasValue(environment, "PAYMENTS_CHECKOUT_MODE") &&
  !["disabled", "authenticated", "public"].includes(
    environment.PAYMENTS_CHECKOUT_MODE?.trim() ?? ""
  )
) {
  problems.push("PAYMENTS_CHECKOUT_MODE is invalid");
}
```

Em `preview-environment.ts`:

```ts
if (
  hasValue(environment, "PAYMENTS_CHECKOUT_MODE") &&
  environment.PAYMENTS_CHECKOUT_MODE?.trim() !== "disabled"
) {
  problems.push("PAYMENTS_CHECKOUT_MODE must equal disabled in Preview");
}
```

Em `.env.example`:

```dotenv
# disabled bloqueia tudo; authenticated bloqueia somente a rota pública; public libera ambas.
PAYMENTS_CHECKOUT_MODE=public
```

- [x] **Step 4: confirmar GREEN e tipos**

Run:

```text
bun x vitest run src/lib/env.test.ts src/lib/production-environment.test.ts src/lib/preview-environment.test.ts
bun run typecheck
```

Expected: PASS.

- [x] **Step 5: checkpoint sem commit**

Não versionar sem autorização.

## Task 3: Aplicar contenção às duas entradas de checkout

**Files:**

- Modify: `src/features/payments/actions.ts`
- Modify: `src/features/payments/actions.test.ts`
- Modify: `src/app/api/checkouts/course/route.ts`
- Modify: `src/app/api/checkouts/course/route.test.ts`

- [x] **Step 1: escrever testes falhos sem efeitos**

Na action autenticada:

```ts
// acrescentar getServerEnv ao objeto vi.hoisted e este mock:
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));

it("blocks disabled authenticated checkout before session and provider", async () => {
  dependencies.getServerEnv.mockReturnValue({
    PAYMENTS_CHECKOUT_MODE: "disabled",
  });
  const form = new FormData();
  form.set("courseId", COURSE_ID);
  form.set("checkoutAttemptId", ATTEMPT_ID);

  await expect(startCourseCheckoutAction(form)).rejects.toThrow(
    "Checkout indisponivel."
  );
  expect(dependencies.requireSession).not.toHaveBeenCalled();
  expect(dependencies.createAsaasCheckoutIntent).not.toHaveBeenCalled();
});
```

Na rota pública:

```ts
it.each(["disabled", "authenticated"] as const)(
  "blocks public checkout in %s mode before reading body or dependencies",
  async (mode) => {
    dependencies.getServerEnv.mockReturnValue({
      CLIENT_IP_SOURCE: "x-forwarded-for",
      PAYMENTS_CHECKOUT_MODE: mode,
    });
    const source = request(validBody);
    const response = await POST(source);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Servico de checkout indisponivel.",
    });
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
    expect(dependencies.observeOperation).not.toHaveBeenCalled();
  }
);
```

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/features/payments/actions.test.ts src/app/api/checkouts/course/route.test.ts
```

Expected: FAIL porque as entradas ainda ignoram o modo.

- [x] **Step 3: implementar guards antes de efeitos**

No início da action, antes de `requireSession()`:

```ts
assertCheckoutAvailable({
  entry: "authenticated",
  mode: getServerEnv().PAYMENTS_CHECKOUT_MODE,
});
```

No início da rota, antes de `request.json()`:

```ts
let environment: ReturnType<typeof getServerEnv>;
try {
  environment = getServerEnv();
  assertCheckoutAvailable({
    entry: "public",
    mode: environment.PAYMENTS_CHECKOUT_MODE,
  });
} catch {
  return errorResponse("Servico de checkout indisponivel.", 503);
}
```

Remover a segunda leitura de `getServerEnv` dentro do `try`. Não incluir detalhes do modo na resposta.

- [x] **Step 4: confirmar GREEN**

Run:

```text
bun x vitest run src/features/payments/actions.test.ts src/app/api/checkouts/course/route.test.ts
```

Expected: PASS e mocks de sessão/DB/provider intocados nos bloqueios.

- [x] **Step 5: provar compatibilidade da Release A com `origin/main`**

Criar um worktree isolado a partir de `origin/main`, reaplicar somente os arquivos da Release A e executar:

```text
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

Expected: todos PASS, sem migrations `0044` a `0051` no diff da Release A. Não criar commit ou push.

## Task 4: Adicionar kill switch específico do webhook Asaas

**Files:**

- Modify: `src/lib/env.ts`
- Modify: `src/lib/production-environment.ts`
- Modify: `src/lib/preview-environment.ts`
- Modify: testes correspondentes
- Modify: `src/app/api/webhooks/asaas/route.ts`
- Modify: `src/app/api/webhooks/asaas/route.test.ts`
- Modify: `src/app/api/cron/asaas-webhooks/route.ts`
- Modify: `src/app/api/cron/asaas-webhooks/route.test.ts`
- Modify: `.env.example`

- [x] **Step 1: escrever testes falhos de ambiente e rotas**

```ts
it("rejects the webhook before token, body and persistence when disabled", async () => {
  dependencies.getServerEnv.mockReturnValue({
    ASAAS_WEBHOOK_ENABLED: false,
    ASAAS_WEBHOOK_TOKEN: TOKEN,
  });

  const response = await POST(request());

  expect(response.status).toBe(503);
  expect(dependencies.persistAsaasWebhook).not.toHaveBeenCalled();
});
```

```ts
it("skips the Asaas worker before acquiring a lease when disabled", async () => {
  dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
  dependencies.getServerEnv.mockReturnValue({
    ASAAS_WEBHOOK_ENABLED: false,
  });

  const response = await GET(createRequest());

  await expect(response.json()).resolves.toEqual({
    ok: true,
    reason: "asaas_webhook_disabled",
    skipped: true,
  });
  expect(dependencies.runWithScheduledJobLease).not.toHaveBeenCalled();
});
```

Também provar que Production exige `ASAAS_WEBHOOK_ENABLED` quando a Release B está configurada e Preview rejeita `true`.

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/lib/env.test.ts src/lib/production-environment.test.ts src/lib/preview-environment.test.ts src/app/api/webhooks/asaas/route.test.ts src/app/api/cron/asaas-webhooks/route.test.ts
```

Expected: FAIL.

- [x] **Step 3: implementar flag e guards**

Schema:

```ts
ASAAS_WEBHOOK_ENABLED: z
  .enum(["true", "false"])
  .transform((value) => value === "true"),
```

Default efetivo: `false` em Preview, `true` em Development; Production exige o valor cru explícito. Na rota de ingresso, retornar `503 service_unavailable` imediatamente após `getServerEnv`. No cron, executar primeiro o guard compartilhado de autenticação/agendamento e depois:

```ts
if (!getServerEnv().ASAAS_WEBHOOK_ENABLED) {
  return NextResponse.json({
    ok: true,
    reason: "asaas_webhook_disabled",
    skipped: true,
  });
}
```

`.env.example`:

```dotenv
# Kill switch exclusivo da entrada e do worker Asaas.
ASAAS_WEBHOOK_ENABLED=true
```

- [x] **Step 4: confirmar GREEN**

Run:

```text
bun x vitest run src/lib/env.test.ts src/lib/production-environment.test.ts src/lib/preview-environment.test.ts src/app/api/webhooks/asaas/route.test.ts src/app/api/cron/asaas-webhooks/route.test.ts
```

Expected: PASS.

- [x] **Step 5: checkpoint sem commit**

Não versionar sem autorização.

## Task 5: Implementar o contrato puro da limpeza

**Files:**

- Create: `src/db/production-cleanup.ts`
- Create: `src/db/production-cleanup.test.ts`

- [x] **Step 1: escrever testes falhos para allowlist, argumentos e fingerprint**

Cobrir:

```ts
expect(parseCleanupArguments(["--mode=plan", "--environment=production"])).toEqual({
  environment: "production",
  mode: "plan",
});

expect(() =>
  parseCleanupArguments([
    "--mode=execute",
    "--environment=production",
    "--fingerprint=sha256",
    "--confirm-cleanup=true",
    "--confirmation=wrong",
  ])
).toThrow("Destructive cleanup confirmation is invalid.");

expect(validatePublicTables([...PRODUCTION_CLEANUP_TABLES])).toEqual([]);
expect(validatePublicTables([...PRODUCTION_CLEANUP_TABLES, "surprise"])).toEqual([
  "unexpected table: surprise",
]);

expect(createCleanupFingerprint(snapshot)).toMatch(/^[0-9a-f]{64}$/);
expect(createCleanupFingerprint({ ...snapshot, rowCounts: { ...snapshot.rowCounts, orders: 1 } }))
  .not.toBe(createCleanupFingerprint(snapshot));
```

Provar ainda zero/dois Admins, Admin bloqueado, ausência de conta `credential` com senha, journal diferente de 44 entradas/topo `0043` e output sem PII.

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/db/production-cleanup.test.ts
```

Expected: FAIL porque o módulo não existe.

- [x] **Step 3: implementar constantes e tipos exatos**

```ts
import { createHash } from "node:crypto";

export const PRODUCTION_CLEANUP_TABLES = [
  "accounts",
  "app_settings",
  "audit_logs",
  "certificate_issuer_profiles",
  "certificate_template_asset_cleanup",
  "certificate_templates",
  "certificates",
  "course_completions",
  "course_publications",
  "courses",
  "dashboard_banners",
  "enrollment_events",
  "enrollment_expiration_adjustments",
  "enrollment_grants",
  "enrollments",
  "faq_items",
  "jmvstream_folders",
  "jmvstream_video_assets",
  "learning_analytics_daily_metrics",
  "learning_analytics_events",
  "learning_analytics_preferences",
  "lesson_comments",
  "lesson_progress",
  "lesson_watch_progress",
  "lessons",
  "modules",
  "orders",
  "outbox_messages",
  "payment_reviews",
  "profiles",
  "public_certificate_rate_limits",
  "refund_requests",
  "scheduled_job_leases",
  "sessions",
  "staged_admin_image_uploads",
  "users",
  "verifications",
  "webhook_events",
] as const;

export const PRESERVED_IDENTITY_TABLES = [
  "accounts",
  "profiles",
  "sessions",
  "users",
] as const;

export const TRUNCATED_OPERATIONAL_TABLES =
  PRODUCTION_CLEANUP_TABLES.filter(
    (table) => !PRESERVED_IDENTITY_TABLES.includes(
      table as (typeof PRESERVED_IDENTITY_TABLES)[number]
    )
  );

export interface CleanupSnapshot {
  adminCount: number;
  adminIdHash: string;
  branchId: string;
  database: string;
  host: string;
  journalCount: number;
  journalHash: string;
  journalTop: "0043";
  publicTables: string[];
  rowCounts: Record<string, number>;
}

const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nested) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) =>
          left.localeCompare(right)
        ))
      : nested
  );

export const createCleanupFingerprint = (
  snapshot: CleanupSnapshot
): string =>
  createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
```

Implementar parser fechado: `plan` aceita somente ambiente; `execute` exige fingerprint hexadecimal de 64 caracteres, booleano verdadeiro e literal `DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN`. Erro não inclui valor recebido.

Normalizar hosts Neon removendo apenas o marcador `-pooler.` e comparar o host real da
URL com `PRODUCTION_DATABASE_HOST`. O snapshot inclui
`PRODUCTION_NEON_BRANCH_ID`; ausência ou divergência de host, database ou branch aborta
antes de qualquer SQL destrutivo. O journal é comparado linha a linha com as 44 entradas
locais até `0043` antes de atribuir `journalTop: "0043"`.

- [x] **Step 4: confirmar GREEN**

Run:

```text
bun x vitest run src/db/production-cleanup.test.ts
```

Expected: PASS.

- [x] **Step 5: checkpoint sem commit**

Não versionar sem autorização.

## Task 6: Implementar executor PostgreSQL transacional

**Files:**

- Create: `src/db/production-cleanup-executor.ts`
- Create: `src/db/production-cleanup-executor.test.ts`

- [x] **Step 1: escrever teste falho da sequência segura**

Com um `PoolClient` falso, exigir esta ordem no modo `execute`:

```ts
expect(statements).toEqual([
  "begin isolation level serializable",
  "set local statement_timeout = '30s'",
  "set local lock_timeout = '10s'",
  "select pg_try_advisory_xact_lock($1) as acquired",
  expect.stringMatching(/^lock table /),
  expect.stringContaining("information_schema.tables"),
  expect.stringContaining("drizzle.__drizzle_migrations"),
  expect.stringContaining("from profiles"),
  expect.stringMatching(/^select count\(\*\)::int as count from /),
  expect.stringMatching(/^truncate table /),
  "delete from users where id <> $1",
  expect.stringContaining("from profiles"),
  expect.stringMatching(/^select count\(\*\)::int as count from /),
  "commit",
]);
```

Também testar: lock ocupado, fingerprint divergente e pós-condição inválida executam `rollback` e nunca `truncate`.

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/db/production-cleanup-executor.test.ts
```

Expected: FAIL porque o executor não existe.

- [x] **Step 3: implementar API e SQL fechado**

```ts
export interface CleanupExecutionInput {
  branchId: string;
  database: string;
  expectedFingerprint?: string;
  expectedHost: string;
  host: string;
  mode: "execute" | "plan";
  schema?: string;
}

export interface CleanupExecutorDependencies {
  readJournal?: (client: PoolClient) => Promise<
    Array<{ createdAt: string; hash: string }>
  >;
}

export interface CleanupExecutionResult {
  fingerprint: string;
  mode: "execute" | "plan";
  rowCounts: Record<string, number>;
  status: "cleaned" | "planned";
}

export const runProductionCleanup = async ({
  client,
  dependencies = {},
  input,
}: {
  client: PoolClient;
  dependencies?: CleanupExecutorDependencies;
  input: CleanupExecutionInput;
}): Promise<CleanupExecutionResult> => {
  // Implementação usa somente identificadores provenientes das constantes versionadas.
};
```

Regras obrigatórias:

- `schema` aceita apenas `public` em runtime; testes podem injetar nome que satisfaça `/^cleanup_test_[a-f0-9]+$/`.
- `readJournal` é uma seam exclusiva de testes; a CLI não a injeta e sempre lê
  `drizzle.__drizzle_migrations`.
- `plan` usa `begin read only`, `statement_timeout`, advisory lock compartilhado próprio, snapshot e `rollback`.
- `execute` usa `begin isolation level serializable`, advisory transaction lock exclusivo e `LOCK TABLE` das 38 tabelas em ordem alfabética com `ACCESS EXCLUSIVE`.
- O snapshot é recalculado depois dos locks.
- O `TRUNCATE` contém exatamente as 34 tabelas operacionais, todas qualificadas, numa única instrução e sem `CASCADE`.
- Depois: `DELETE FROM <schema>.users WHERE id <> $1`; as FKs removem identidade não preservada.
- Pós-condição: um Admin não bloqueado, uma `credential` com senha, somente seu `user/profile/accounts/sessions`, todas as tabelas operacionais zeradas.
- Qualquer erro tenta `rollback`; o erro público não inclui URL, e-mail, token ou ID cru.

- [x] **Step 4: confirmar GREEN**

Run:

```text
bun x vitest run src/db/production-cleanup-executor.test.ts
```

Expected: PASS.

- [x] **Step 5: checkpoint sem commit**

Não versionar sem autorização.

## Task 7: Provar a limpeza em PostgreSQL isolado

**Files:**

- Create: `src/db/production-cleanup-executor.integration.test.ts`

- [x] **Step 1: criar fixture isolada**

O teste usa `CERTIFICATE_CONCURRENCY_DATABASE_URL`, cria schema único
`cleanup_test_<hex>`, cria as 38 tabelas da allowlist, as quatro tabelas de identidade
com FKs equivalentes e injeta `readJournal` com as 44 entradas esperadas. Nunca usa
`public` nem o journal real da conexão.

Fixtures:

```ts
await client.query(`
  create table "${schema}".users (
    id text primary key,
    email text not null
  );
  create table "${schema}".profiles (
    user_id text primary key references "${schema}".users(id) on delete cascade,
    role text not null,
    platform_blocked_at timestamptz
  );
  create table "${schema}".accounts (
    id text primary key,
    user_id text not null references "${schema}".users(id) on delete cascade,
    provider_id text not null,
    password text
  );
  create table "${schema}".sessions (
    id text primary key,
    user_id text not null references "${schema}".users(id) on delete cascade
  );
`);
```

As 34 tabelas operacionais recebem `id text primary key`; `audit_logs` também recebe FK para `users` para provar que todas as referenciadoras participam do mesmo `TRUNCATE`.

- [x] **Step 2: escrever os casos**

Provar:

- `plan` não altera nenhuma contagem;
- `execute` preserva Admin/profile/credential/sessão e zera todo o resto;
- outra Conta e identidade desaparecem por cascade;
- fingerprint divergente não altera linhas;
- tabela inesperada aborta;
- lock concorrente aborta;
- erro forçado após `TRUNCATE` faz rollback integral;
- segunda execução exige novo `plan`.

- [x] **Step 3: executar**

Run:

```text
bun x vitest run --config vitest.integration.config.ts src/db/production-cleanup-executor.integration.test.ts
```

Expected: PASS. Se `CERTIFICATE_CONCURRENCY_DATABASE_URL` não existir, registrar o bloqueio exato; não apontar o teste para Production.

- [x] **Step 4: remover fixture com segurança**

No `afterAll`, validar o regex do schema e executar:

```sql
drop schema "<schema_validado>" cascade
```

Expected: somente o schema aleatório do teste é removido.

- [x] **Step 5: checkpoint sem commit**

Não versionar sem autorização.

## Task 8: Criar a CLI de plan/execute

**Files:**

- Create: `scripts/cleanup-production-test-data.ts`
- Create: `src/tooling/cleanup-production-test-data.test.ts`
- Modify: `package.json`

- [x] **Step 1: escrever teste do entrypoint extraível**

Manter parsing e execução em funções importáveis. Testar que ausência de
`DATABASE_URL_DIRECT`, `PRODUCTION_DATABASE_HOST` ou
`PRODUCTION_NEON_BRANCH_ID` falha antes de criar `Pool`, e que somente o resumo seguro
vai para stdout. Extrair da URL validada o host normalizado e o nome do database para o
snapshot.

- [x] **Step 2: implementar o entrypoint**

Configuração do pool:

```ts
const pool = new Pool({
  application_name: "protea-r-production-cleanup",
  connectionString: withVerifiedSslMode(databaseUrl),
  connectionTimeoutMillis: 10_000,
  max: 1,
});
```

Executar `runProductionCleanup`, imprimir apenas:

```ts
process.stdout.write(
  `${JSON.stringify({
    fingerprint: result.fingerprint,
    mode: result.mode,
    rowCounts: result.rowCounts,
    status: result.status,
  })}\n`
);
```

Adicionar:

```json
"db:cleanup:production": "bun scripts/cleanup-production-test-data.ts"
```

- [x] **Step 3: testar o modo plan contra cliente falso**

Run:

```text
bun x vitest run src/tooling/cleanup-production-test-data.test.ts
```

Expected: PASS; nenhuma credencial no output.

- [x] **Step 4: verificar help/erro sem conexão**

Run:

```text
bun run db:cleanup:production -- --mode=plan --environment=invalid
```

Expected: saída não zero com mensagem de ambiente inválido antes de conexão.

- [x] **Step 5: checkpoint sem commit**

Não versionar sem autorização.

## Task 9: Criar workflow manual com backup Neon

**Files:**

- Create: `.github/workflows/cleanup-production-test-data.yml`
- Modify: `src/tooling/release-workflows.test.ts`

- [x] **Step 1: escrever contrato estático falho**

```ts
it("plans or executes Production cleanup without deploying or migrating", () => {
  const workflow = readWorkflow("cleanup-production-test-data.yml");

  expect(workflow).toContain("mode:");
  expect(workflow).toContain("fingerprint:");
  expect(workflow).toContain("confirm_cleanup:");
  expect(workflow).toContain("DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN");
  expect(workflow).toContain("name: vercel-production");
  expect(workflow).toContain("group: production-test-data-cleanup");
  expect(workflow).toContain("cancel-in-progress: false");
  expect(workflow).toContain("PRODUCTION_DATABASE_HOST");
  expect(workflow).toContain("PRODUCTION_NEON_PROJECT_ID");
  expect(workflow).toContain("PRODUCTION_NEON_BRANCH_ID");
  expect(workflow).toContain("secrets.NEON_API_KEY");
  expect(workflow).toContain("bun run db:cleanup:production");
  expect(workflow).not.toContain("db:migrate:production");
  expect(workflow).not.toContain("vercel deploy");
});
```

- [x] **Step 2: confirmar RED**

Run:

```text
bun x vitest run src/tooling/release-workflows.test.ts
```

Expected: FAIL porque o workflow não existe.

- [x] **Step 3: implementar workflow**

Entradas:

```yaml
on:
  workflow_dispatch:
    inputs:
      mode:
        description: plan is read-only; execute deletes approved test data
        required: true
        default: plan
        type: choice
        options: [plan, execute]
      fingerprint:
        description: Required only for execute
        required: false
        type: string
      confirm_cleanup:
        description: Confirm destructive cleanup
        required: true
        default: false
        type: boolean
      confirmation:
        description: Type DELETE_TEST_DATA_EXCEPT_CURRENT_ADMIN for execute
        required: false
        type: string
```

O job usa `environment: vercel-production`, `ref: main`, confirma SHA igual a
`origin/main` e CI verde como `deploy-vercel.yml`.

No modo `execute`, validar inputs e a branch de origem:

```bash
branch_json="$(
  curl --fail-with-body --silent --show-error \
    --header "Accept: application/json" \
    --header "Authorization: Bearer ${NEON_API_KEY}" \
    "https://console.neon.tech/api/v2/projects/${PRODUCTION_NEON_PROJECT_ID}/branches/${PRODUCTION_NEON_BRANCH_ID}"
)"
jq -e \
  --arg project "${PRODUCTION_NEON_PROJECT_ID}" \
  --arg branch "${PRODUCTION_NEON_BRANCH_ID}" \
  '.branch.project_id == $project and .branch.id == $branch' \
  <<< "${branch_json}" > /dev/null
```

Criar backup sem compute e sem expiração automática:

```bash
backup_name="asaas-cutover-backup-$(date -u +%Y%m%dT%H%M%SZ)"
backup_json="$(
  jq -n \
    --arg name "${backup_name}" \
    --arg parent "${PRODUCTION_NEON_BRANCH_ID}" \
    '{branch:{name:$name,parent_id:$parent}}' |
  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "Accept: application/json" \
    --header "Authorization: Bearer ${NEON_API_KEY}" \
    --header "Content-Type: application/json" \
    --data @- \
    "https://console.neon.tech/api/v2/projects/${PRODUCTION_NEON_PROJECT_ID}/branches"
)"
backup_id="$(jq -er '.branch.id' <<< "${backup_json}")"
echo "${backup_json}" |
  jq -e \
    --arg project "${PRODUCTION_NEON_PROJECT_ID}" \
    --arg parent "${PRODUCTION_NEON_BRANCH_ID}" \
    --arg backup "${backup_id}" \
    '.branch.project_id == $project and
     .branch.parent_id == $parent and
     .branch.id == $backup' > /dev/null
echo "backup_branch_id=${backup_id}" >> "$GITHUB_OUTPUT"
```

Não imprimir resposta completa nem URL. O modo `plan` não chama Neon. Executar CLI com
inputs explícitos, nunca interpolar secrets em argumento.

- [x] **Step 4: confirmar GREEN**

Run:

```text
bun x vitest run src/tooling/release-workflows.test.ts
```

Expected: PASS.

- [x] **Step 5: validar YAML e shell indiretamente**

Run:

```text
bun run check
bun run typecheck
```

Expected: PASS. Revisar manualmente que não há migration/deploy/delete de branch.

## Task 10: Atualizar documentação canônica e progresso

**Files:**

- Modify: `.env.example`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/operations/deploy-and-incidents.md`
- Modify: `docs/integrations/asaas.md`
- Modify: `docs/Plano de migracao.md`

- [x] **Step 1: documentar configuração**

Registrar:

- Release A precisa de `PAYMENTS_CHECKOUT_MODE=disabled` antes do deploy;
- Release B precisa de `ASAAS_WEBHOOK_ENABLED=false` antes do deploy;
- GitHub Environment precisa de `NEON_API_KEY`,
  `PRODUCTION_NEON_PROJECT_ID`, `PRODUCTION_NEON_BRANCH_ID` e
  `PRODUCTION_DATABASE_HOST`;
- `plan` é somente leitura e não cria backup;
- `execute` exige fingerprint e duas confirmações;
- backup permanece sem expiração automática durante a estabilização e só é removido
  depois do aceite explícito;
- nenhum segredo, PII ou URL de conexão aparece em logs.

- [x] **Step 2: atualizar checklist do plano**

Marcar cada item como:

- `Concluído em código` somente depois dos testes focais;
- `Validado localmente` somente depois de PostgreSQL/build/E2E;
- `Pendente de autorização` para commit, push, PR, variáveis e Production.

- [x] **Step 3: validar docs**

Run:

```text
bun run docs:check
git diff --check
```

Expected: `Documentação válida` e zero erro de whitespace.

## Task 11: Executar verificação local completa

**Files:**

- Nenhum arquivo novo; corrigir apenas falhas causadas por este plano.

- [x] **Step 1: focais**

Run:

```text
bun x vitest run src/features/payments/checkout-availability.test.ts src/features/payments/actions.test.ts src/app/api/checkouts/course/route.test.ts src/app/api/webhooks/asaas/route.test.ts src/app/api/cron/asaas-webhooks/route.test.ts src/db/production-cleanup.test.ts src/db/production-cleanup-executor.test.ts src/tooling/release-workflows.test.ts
```

Expected: PASS.

- [x] **Step 2: PostgreSQL**

Run:

```text
bun x vitest run --config vitest.integration.config.ts
```

Expected: todas as integrações PASS em banco descartável.

- [x] **Step 3: gate completo**

Run:

```text
bun run verify
```

Expected: docs, migrations, TypeScript, Ultracite, unitários, build e Knip aprovados.

- [x] **Step 4: E2E**

Run:

```text
bun run test:e2e
```

Expected: jornadas PASS com checkout Development em `public`; adicionar smoke de modo
`disabled` se o harness suportar override isolado.

- [x] **Step 5: auditoria final sem mutação**

Run:

```text
git diff --check
git status --short
```

Expected: nenhum artefato temporário; nenhuma alteração em Production.

## Task 12: Gate externo da Release A

**Files:**

- Somente após autorização explícita: branch/worktree de Release A.

- [ ] **Step 1: parar e pedir autorização**

Pedir autorização específica para commit, push e Pull Request da Release A. Não inferir
essa autorização da aprovação do design ou da autorização para apagar dados de teste.

- [ ] **Step 2: após autorização, versionar somente contenção**

O diff da Release A pode conter apenas os arquivos das Tasks 1 a 3 aplicáveis ao código
AbacatePay de `main`, `.env.example`, testes e documentação correspondente. Não incluir
migrations nem código Asaas.

Também deve conter o kill switch `ABACATEPAY_WEBHOOK_ENABLED` e o bloqueio antecipado
da rota legada. Antes da limpeza, Production usa `false`; a resposta `204` não lê corpo,
não valida segredo e não acessa persistência. A autorização foi concedida em 2026-07-30.

- [ ] **Step 3: CI, variável e deploy**

Depois de merge aprovado:

1. configurar `PAYMENTS_CHECKOUT_MODE=disabled` em Vercel Production;
2. disparar `Deploy Vercel production`;
3. confirmar readiness;
4. provar que action autenticada e rota pública não criam Pedido nem chamam provider;
5. provar que a rota AbacatePay responde `204` sem processar nem persistir;
6. confirmar login da Conta Admin.

Qualquer falha interrompe o corte.

## Task 13: Gate externo da Release B e limpeza

**Files:**

- Somente após autorização explícita: branch Asaas, GitHub Environment, Vercel, Neon e Asaas Production.

- [ ] **Step 1: parar e pedir autorização**

Pedir autorização específica para commit/push/PR da Release B. Depois do merge, pedir
autorização específica para cada operação externa destrutiva ou financeira.

- [ ] **Step 2: configurar ambiente de limpeza**

Adicionar ao GitHub Environment:

- secret `NEON_API_KEY`;
- vars `PRODUCTION_NEON_PROJECT_ID`, `PRODUCTION_NEON_BRANCH_ID`,
  `PRODUCTION_DATABASE_HOST`.

Auditar somente nomes e presença, nunca valores.

- [ ] **Step 3: executar `plan`**

Disparar workflow com `mode=plan`. Revisar:

- 38 tabelas exatas;
- 44 migrations/topo `0043`;
- um Admin utilizável;
- contagens esperadas;
- fingerprint hexadecimal.

Drift ou divergência => parar.

- [ ] **Step 4: pedir confirmação final e executar limpeza**

Somente após confirmação humana do fingerprint, disparar `execute`. Confirmar branch de
backup criada, um Admin preservado, tabelas operacionais vazias e journal `0043`.

- [ ] **Step 5: publicar Release B contida**

Configurar Asaas Production e `ASAAS_WEBHOOK_ENABLED=false`; executar workflow
Production para aplicar `0044` a `0051`, build, readiness e promoção. A Release B deve
remover a rota e o código executável AbacatePay antes da migration `0044`.

- [ ] **Step 6: ativação controlada**

1. cadastrar webhook não sequencial interrompido;
2. publicar `ASAAS_WEBHOOK_ENABLED=true`;
3. confirmar inbox/worker;
4. publicar `PAYMENTS_CHECKOUT_MODE=authenticated`;
5. executar PIX, cartão e reembolso supervisionados;
6. conferir Pedido, Concessão, Matrícula, taxas, extrato e alertas;
7. publicar `PAYMENTS_CHECKOUT_MODE=public`;
8. revogar credenciais e configuração remota AbacatePay, cujo código executável já foi
   removido;
9. manter backup por 14 dias.

Pagamento real, reembolso e revogação exigem confirmação específica no momento da
ação. Falha depois do primeiro pagamento Asaas => pausar checkout e corrigir para
frente; não reativar AbacatePay.
