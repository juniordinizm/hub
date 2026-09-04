# Module Content Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liberar Módulos em D+N após o início efetivo do acesso de cada Aluna, preservando Matrículas existentes, sequência pedagógica, segurança server-side e o contrato comercial vendido.

**Architecture:** O Módulo guarda um atraso inteiro; a Matrícula guarda modo explícito e a âncora do episódio contínuo de entrega; o Pedido guarda apenas o snapshot da oferta. Uma regra pura calcula disponibilidade em cada request. A publicação impede aumento retroativo de atraso, e todas as superfícies protegidas reutilizam a mesma decisão.

**Tech Stack:** TypeScript 6, Next.js 16 App Router, React 19, PostgreSQL/Neon, Drizzle ORM, Bun, Vitest, Playwright, Zod, Ultracite/Biome.

---

```yaml
status: ready_for_implementation
owner: engineering
planned_at_commit: 9d0450a
spec: docs/superpowers/specs/2026-09-04-module-content-release-design.md
adr: docs/adr/0010-relative-module-content-release.md
```

## 1. Como usar este plano

Execute os sprints na ordem. Não pule testes vermelhos, migrations ou gates. Cada
checkbox representa uma ação curta e verificável.

Regras para a pessoa executora:

- leia a especificação e o ADR antes de editar;
- não mude uma decisão de produto para fazer um teste passar;
- não adicione coorte, cron, data absoluta, regra por Aula ou notificação;
- nunca use banco Development, Staging ou Production em testes;
- não execute `db:push`;
- gere migration com Drizzle e revise SQL, journal e snapshot;
- `redirect()` do Next.js deve ficar fora de `try/catch`, pois lança uma exceção de
  controle;
- páginas e handlers protegidos continuam dinâmicos/no-store;
- não crie commit sem autorização explícita. Os passos “Checkpoint Git” são opcionais e
  devem ser ignorados quando essa autorização não existir;
- se o worktree já estiver sujo, preserve alterações não relacionadas, especialmente
  `skills-lock.json`.

## 2. Estado inicial e resultado final

Estado atual:

- `modules` não possui atraso;
- `enrollments` não distingue acesso integral de cronograma;
- `orders` não captura a oferta temporal;
- `isLessonAvailable` considera apenas Progresso;
- overview e workspace devolvem todas as Aulas da publicação;
- comentários repetem autorização/sequência;
- materiais R2 passam pelo workspace;
- `CoursePublication` já preserva `curriculum_key` da Aula;
- pagamentos e reembolsos já recompõem a Matrícula de forma transacional.

Resultado final:

```text
Módulo D+0 + sequência satisfeita  => Aula disponível
Módulo D+8 antes de 192 horas      => Módulo visível, conteúdo oculto
Módulo D+8 em/apos 192 horas       => sequência volta a decidir
Matrícula full_access              => tempo ignorado
Matrícula scheduled sem âncora     => estado impossível no banco e fail-closed no código
```

## 3. Mapa de arquivos

### Criar

- `src/features/courses/module-content-release.ts`: tipos e regras puras de relógio,
  disponibilidade e snapshot comercial.
- `src/features/courses/module-content-release.test.ts`: matriz unitária completa.
- `src/features/courses/module-content-release-digest.ts`: digest server-only do
  snapshot apresentado no handoff.
- `src/features/courses/module-content-release-digest.test.ts`: estabilidade e mudança
  do digest.
- `src/features/admin/course-publication-release-policy.ts`: comparação monotônica
  entre publicação vigente e rascunho.
- `src/features/admin/course-publication-release-policy.test.ts`: movimentação,
  aumento, redução e Aula nova.
- `src/components/admin/student-content-release-controls.tsx`: override Admin com
  confirmação e motivo.
- `src/components/admin/student-content-release-controls.test.tsx`: autorização e
  interação do override.
- `src/features/enrollments/content-release.integration.test.ts`: transições reais em
  PostgreSQL.
- `src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.test.ts`:
  negação de preview R2 antes da liberação.
- migration Drizzle `0070_<nome-gerado>.sql` e snapshot `0070_snapshot.json`.

### Modificar

- `src/db/schema.ts`
- `src/features/enrollments/rules.ts`
- `src/features/enrollments/rules.test.ts`
- `src/features/enrollments/server.ts`
- `src/features/enrollments/server-sql.test.ts`
- `src/features/enrollments/server-revocation.test.ts`
- `src/features/enrollments/access.ts`
- `src/features/enrollments/access.test.ts`
- `src/features/progress/rules.ts`
- `src/features/progress/rules.test.ts`
- `src/features/admin/authoring.ts`
- `src/features/admin/authoring.test.ts`
- `src/features/admin/publication-contract.test.ts`
- `src/features/admin/server.ts`
- `src/features/admin/server-read-projections.test.ts`
- `src/features/admin/actions.ts`
- `src/features/admin/enrollment-command-input.ts`
- `src/features/admin/enrollment-command-input.test.ts`
- `src/features/admin/enrollment-actions.test.ts`
- `src/features/admin/support-server.ts`
- `src/features/admin/support-server.test.ts`
- `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`
- `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx`
- `src/app/(admin)/admin/alunos/students-table.tsx`
- `src/app/(admin)/admin/cursos/[courseId]/course-enrollments-table.tsx`
- `src/app/(admin)/admin/operacao/cursos/[courseId]/alunas/support-course-students-table.tsx`
- `src/components/admin/student-management-types.ts`
- `src/components/admin/student-management-sheet.tsx`
- `src/components/admin/student-management-sheet.test.tsx`
- `src/components/admin/student-enrollment-list.tsx`
- `src/features/payments/checkout.ts`
- `src/features/payments/checkout.test.ts`
- `src/features/payments/checkout-api.ts`
- `src/features/payments/checkout-api.test.ts`
- `src/features/payments/purchase-handoff.ts`
- `src/features/payments/purchase-handoff.test.ts`
- `src/features/courses/module-content-release-digest.ts`
- `src/features/courses/module-content-release-digest.test.ts`
- `src/app/api/checkouts/course/route.ts`
- `src/app/api/checkouts/course/route.test.ts`
- `src/app/comprar/[slug]/page.tsx`
- `src/app/comprar/[slug]/page.test.tsx`
- `src/app/comprar/[slug]/purchase-handoff-client.tsx`
- `src/app/comprar/[slug]/purchase-handoff-client.test.tsx`
- `src/features/courses/server.ts`
- `src/features/courses/server-sql.test.ts`
- `src/features/courses/access-contract.test.ts`
- `src/features/courses/availability-server.ts`
- `src/features/courses/availability-server.test.ts`
- `src/features/comments/server.ts`
- `src/features/comments/server-sql.test.ts`
- `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- `src/app/(student)/app/cursos/[courseId]/page.tsx`
- `src/app/(student)/app/cursos/[courseId]/page.test.tsx`
- `src/app/(student)/app/aulas/[lessonId]/page.tsx`
- `src/app/(student)/app/actions.ts`
- `src/app/(student)/app/actions.test.ts`
- `src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.ts`
- `src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.test.ts`
- `src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.ts`
- `scripts/seed-e2e.ts`
- `tests/e2e/critical-journeys.spec.ts`
- `tests/e2e/payment-helpers.ts`
- `PRODUCT.md`
- `CONTEXT.md`
- `docs/README.md`
- `docs/decisions.md`
- `docs/domain/commerce-and-access.md`
- `docs/domain/learning-content-and-progress.md`
- `docs/architecture.md`
- `docs/operations/database-and-migrations.md`
- `docs/operations/testing-and-ci.md`

### Não tocar

- lógica de cálculo monetário ou matriz financeira Asaas;
- lifecycle de certificados fora da verificação de elegibilidade já existente;
- autenticação Better Auth;
- configuração JMVStream/DRM;
- crons em `vercel.json`;
- analytics opcional;
- expiração comercial por Concessão;
- `CoursePublication` como currículo vivo.

## 4. Dependências entre sprints

```text
Sprint 0 baseline
  -> Sprint 1 regras + schema
    -> Sprint 2 âncora da Matrícula
      -> Sprint 3 autoria + publicação monotônica
        -> Sprint 4 oferta + snapshot do Pedido
          -> Sprint 5 read models + overview
            -> Sprint 6 fechamento de bypasses
              -> Sprint 7 operação Admin/Suporte
                -> Sprint 8 integração, E2E e documentação
```

---

# Sprint 0 — Preparar baseline reproduzível

## Objetivo

Garantir que qualquer falha posterior possa ser atribuída à implementação, não à falta
de dependências ou ao estado inicial.

### Task 0.1: Ler autoridades e instalar dependências

**Files:**

- Read: `AGENTS.md`
- Read: `docs/README.md`
- Read: `docs/superpowers/specs/2026-09-04-module-content-release-design.md`
- Read: `docs/adr/0010-relative-module-content-release.md`
- Read: `docs/operations/database-and-migrations.md`
- Read: `docs/operations/testing-and-ci.md`
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.mdx` depois da instalação
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx` depois da instalação

- [ ] **Step 1: Confirmar o commit e alterações preexistentes**

Run:

```powershell
git rev-parse --short HEAD
git status --short
```

Expected:

- `HEAD` começa em `9d0450a`, ou a pessoa executora registra o novo commit e faz drift
  check antes de continuar;
- alterações não relacionadas são listadas e preservadas.

- [ ] **Step 2: Instalar exatamente o lockfile**

Run:

```powershell
bun install --frozen-lockfile
```

Expected: exit code `0`, sem alteração de `bun.lock`.

- [ ] **Step 3: Ler a documentação Next.js vendorizada**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.mdx
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx
```

Expected: os arquivos existem; registrar que `redirect()` lança e que
`revalidatePath()` é server-only.

### Task 0.2: Executar o baseline curto

**Files:** none.

- [ ] **Step 1: Rodar gates rápidos**

Run:

```powershell
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun run check
bun run test
```

Expected: todos passam. Se algum falhar antes de qualquer mudança, salvar o comando e
a menor mensagem decisiva; não alterar código desta feature para esconder falha
preexistente.

- [ ] **Step 2: Confirmar que o lockfile não mudou**

Run:

```powershell
git status --short bun.lock skills-lock.json
```

Expected: `bun.lock` limpo. Preservar qualquer mudança preexistente em
`skills-lock.json`.

### Gate da Sprint 0

- dependências instaladas;
- documentação Next.js local lida;
- baseline conhecido;
- nenhuma alteração funcional.

---

# Sprint 1 — Criar regras puras e schema compatível

## Objetivo

Definir o contrato temporal em código puro e preparar o banco de forma expand-only,
sem ativar bloqueio para ninguém.

### Task 1.1: Escrever a matriz temporal primeiro

**Files:**

- Create: `src/features/courses/module-content-release.test.ts`
- Create: `src/features/courses/module-content-release.ts`

- [ ] **Step 1: Criar o teste vermelho das fronteiras**

Adicionar:

```ts
import { describe, expect, it } from "vitest";
import {
  buildContentReleaseScheduleSnapshot,
  resolveLessonAvailability,
  resolveModuleContentRelease,
} from "./module-content-release";

const STARTED_AT = new Date("2026-09-04T17:30:00.000Z");
const D8 = new Date("2026-09-12T17:30:00.000Z");

describe("module content release", () => {
  it("keeps full-access enrollments independent from module delay", () => {
    expect(
      resolveModuleContentRelease({
        mode: "full_access",
        now: STARTED_AT,
        releaseDelayDays: 8,
        startedAt: null,
      })
    ).toEqual({ kind: "available" });
  });

  it("opens D+8 exactly after 192 elapsed hours", () => {
    expect(
      resolveModuleContentRelease({
        mode: "scheduled",
        now: new Date(D8.getTime() - 1),
        releaseDelayDays: 8,
        startedAt: STARTED_AT,
      })
    ).toEqual({ kind: "time_locked", availableAt: D8 });

    expect(
      resolveModuleContentRelease({
        mode: "scheduled",
        now: D8,
        releaseDelayDays: 8,
        startedAt: STARTED_AT,
      })
    ).toEqual({ kind: "available" });
  });

  it("fails closed for scheduled access without an anchor", () => {
    expect(() =>
      resolveModuleContentRelease({
        mode: "scheduled",
        now: STARTED_AT,
        releaseDelayDays: 8,
        startedAt: null,
      })
    ).toThrow("Matricula agendada sem inicio da entrega.");
  });

  it("keeps completed lessons available before other gates", () => {
    expect(
      resolveLessonAvailability({
        isCompleted: true,
        moduleRelease: { kind: "time_locked", availableAt: D8 },
        sequenceAvailable: false,
      })
    ).toEqual({ kind: "available" });
  });

  it("applies time before sequence", () => {
    expect(
      resolveLessonAvailability({
        isCompleted: false,
        moduleRelease: { kind: "time_locked", availableAt: D8 },
        sequenceAvailable: false,
      })
    ).toEqual({ kind: "time_locked", availableAt: D8 });
  });

  it("builds a stable offer snapshot without internal IDs", () => {
    expect(
      buildContentReleaseScheduleSnapshot([
        { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
        { releaseDelayDays: 8, sortOrder: 2, title: "Aplicacao" },
      ])
    ).toEqual({
      clock: "elapsed_24h",
      modules: [
        { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
        { releaseDelayDays: 8, sortOrder: 2, title: "Aplicacao" },
      ],
      version: 1,
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar RED**

Run:

```powershell
bun run test -- src/features/courses/module-content-release.test.ts
```

Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Implementar o contrato mínimo**

Criar `module-content-release.ts` com estes exports e sem dependência de banco/React:

```ts
const MILLISECONDS_PER_DAY = 86_400_000;

export type ContentReleaseMode = "full_access" | "scheduled";

export type ModuleContentRelease =
  | { kind: "available" }
  | { availableAt: Date; kind: "time_locked" };

export type LessonAvailability =
  | { kind: "available" }
  | { availableAt: Date; kind: "time_locked" }
  | { kind: "sequence_locked" };

export interface ContentReleaseScheduleSnapshot {
  clock: "elapsed_24h";
  modules: Array<{
    releaseDelayDays: number;
    sortOrder: number;
    title: string;
  }>;
  version: 1;
}

const assertReleaseDelayDays = (value: number): void => {
  if (!(Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Informe uma quantidade inteira e nao negativa de dias.");
  }
};

export const resolveModuleContentRelease = ({
  mode,
  now,
  releaseDelayDays,
  startedAt,
}: {
  mode: ContentReleaseMode;
  now: Date;
  releaseDelayDays: number;
  startedAt: Date | null;
}): ModuleContentRelease => {
  assertReleaseDelayDays(releaseDelayDays);
  if (mode === "full_access") {
    return { kind: "available" };
  }
  if (!startedAt) {
    throw new Error("Matricula agendada sem inicio da entrega.");
  }
  const availableAt = new Date(
    startedAt.getTime() + releaseDelayDays * MILLISECONDS_PER_DAY
  );
  if (!Number.isFinite(availableAt.getTime())) {
    throw new Error("Data de liberacao do modulo invalida.");
  }
  return now >= availableAt
    ? { kind: "available" }
    : { availableAt, kind: "time_locked" };
};

export const resolveLessonAvailability = ({
  isCompleted,
  moduleRelease,
  sequenceAvailable,
}: {
  isCompleted: boolean;
  moduleRelease: ModuleContentRelease;
  sequenceAvailable: boolean;
}): LessonAvailability => {
  if (isCompleted) {
    return { kind: "available" };
  }
  if (moduleRelease.kind === "time_locked") {
    return moduleRelease;
  }
  return sequenceAvailable
    ? { kind: "available" }
    : { kind: "sequence_locked" };
};

export const buildContentReleaseScheduleSnapshot = (
  modules: ContentReleaseScheduleSnapshot["modules"]
): ContentReleaseScheduleSnapshot => ({
  clock: "elapsed_24h",
  modules: [...modules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((module) => {
      assertReleaseDelayDays(module.releaseDelayDays);
      return {
        releaseDelayDays: module.releaseDelayDays,
        sortOrder: module.sortOrder,
        title: module.title.trim(),
      };
    }),
  version: 1,
});

export const hasDelayedModules = (
  snapshot: ContentReleaseScheduleSnapshot
): boolean =>
  snapshot.modules.some((module) => module.releaseDelayDays > 0);
```

- [ ] **Step 4: Rodar e confirmar GREEN**

Run:

```powershell
bun run test -- src/features/courses/module-content-release.test.ts
```

Expected: PASS.

### Task 1.2: Adicionar schema expand-only

**Files:**

- Modify: `src/db/schema.ts`
- Generate: `src/db/migrations/0070_<generated-name>.sql`
- Generate: `src/db/migrations/meta/0070_snapshot.json`
- Generate: `src/db/migrations/meta/_journal.json`

- [ ] **Step 1: Escrever os campos no schema**

Adicionar:

```ts
export const enrollmentContentReleaseModeEnum = pgEnum(
  "enrollment_content_release_mode",
  ["full_access", "scheduled"]
);
```

Em `modules`:

```ts
releaseDelayDays: integer("release_delay_days").default(0).notNull(),
```

e constraint:

```ts
check(
  "modules_release_delay_days_non_negative",
  sql`${table.releaseDelayDays} >= 0`
),
```

Em `enrollments`:

```ts
contentReleaseMode: enrollmentContentReleaseModeEnum("content_release_mode")
  .default("full_access")
  .notNull(),
contentReleaseStartedAt: timestamp("content_release_started_at", tz),
```

e constraint:

```ts
check(
  "enrollments_content_release_shape",
  sql`(${table.contentReleaseMode} = 'full_access' and ${table.contentReleaseStartedAt} is null)
    or (${table.contentReleaseMode} = 'scheduled' and ${table.contentReleaseStartedAt} is not null)`
),
```

Em `orders`:

```ts
contentReleaseScheduleSnapshot: jsonb(
  "content_release_schedule_snapshot"
)
  .default(
    sql`'{"version":1,"clock":"elapsed_24h","modules":[]}'::jsonb`
  )
  .notNull(),
```

Adicionar ao `enrollmentEventTypeEnum`:

```ts
"content_release_scheduled",
"content_full_access_granted",
```

- [ ] **Step 2: Gerar a migration**

Run:

```powershell
bun run db:generate -- --name relative_module_content_release
```

Expected: um SQL `0070_*`, journal com 71 entradas e snapshot `0070_snapshot.json`.

- [ ] **Step 3: Revisar a migration gerada**

Confirmar no SQL:

- enum criado antes da coluna que o usa;
- novos Módulos recebem `0`;
- Matrículas existentes recebem `full_access` + `null`;
- Pedidos antigos recebem `modules: []`;
- nenhuma tabela é reescrita por backfill manual desnecessário;
- nenhuma coluna existente é removida;
- nenhuma migration anterior foi editada.

- [ ] **Step 4: Verificar cadeia e tipos**

Run:

```powershell
bun run db:migrations:check
bun run typecheck
bun run test -- src/features/courses/module-content-release.test.ts
```

Expected: todos passam.

### Checkpoint Git opcional da Sprint 1

Somente com autorização explícita:

```powershell
git add src/features/courses/module-content-release.ts src/features/courses/module-content-release.test.ts src/db/schema.ts src/db/migrations
git commit -m "feat: add module content release model"
```

### Gate da Sprint 1

- regra pura passa;
- migration expand-only válida;
- nenhum acesso mudou porque todos os Módulos continuam D+0 e Matrículas antigas são
  `full_access`.

---

# Sprint 2 — Tornar a âncora parte da projeção de Matrícula

## Objetivo

Iniciar, preservar ou reiniciar o cronograma dentro da transação que já recompõe a
Matrícula.

### Task 2.1: Modelar a transição como regra pura

**Files:**

- Modify: `src/features/enrollments/rules.ts`
- Modify: `src/features/enrollments/rules.test.ts`

- [ ] **Step 1: Escrever testes vermelhos para cada transição**

Adicionar casos para:

```ts
const NOW = new Date("2026-09-04T17:30:00.000Z");
const ORIGINAL = new Date("2026-08-01T12:00:00.000Z");

expect(
  getEnrollmentContentReleaseTransition({
    hasDelayedModules: true,
    now: NOW,
    preserveExisting: false,
    previous: null,
    wasContinuouslyActive: false,
  })
).toEqual({
  event: "content_release_scheduled",
  mode: "scheduled",
  startedAt: NOW,
});

expect(
  getEnrollmentContentReleaseTransition({
    hasDelayedModules: true,
    now: NOW,
    preserveExisting: false,
    previous: { mode: "scheduled", startedAt: ORIGINAL },
    wasContinuouslyActive: true,
  })
).toEqual({ event: null, mode: "scheduled", startedAt: ORIGINAL });

expect(
  getEnrollmentContentReleaseTransition({
    hasDelayedModules: false,
    now: NOW,
    preserveExisting: false,
    previous: null,
    wasContinuouslyActive: false,
  })
).toEqual({ event: null, mode: "full_access", startedAt: null });
```

Também testar:

- recompra depois de `expired`/`revoked` reinicia;
- `preserveExisting: true` mantém o valor durante extensão/restauração;
- `full_access` anterior permanece `full_access` numa renovação contínua;
- estado `scheduled` sem data lança erro.

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
bun run test -- src/features/enrollments/rules.test.ts
```

Expected: FAIL por export ausente.

- [ ] **Step 3: Implementar a função pura**

Assinatura obrigatória:

```ts
export interface EnrollmentContentReleaseState {
  mode: "full_access" | "scheduled";
  startedAt: Date | null;
}

export interface EnrollmentContentReleaseTransition
  extends EnrollmentContentReleaseState {
  event: "content_release_scheduled" | null;
}

export const getEnrollmentContentReleaseTransition = ({
  hasDelayedModules,
  now,
  preserveExisting,
  previous,
  wasContinuouslyActive,
}: {
  hasDelayedModules: boolean;
  now: Date;
  preserveExisting: boolean;
  previous: EnrollmentContentReleaseState | null;
  wasContinuouslyActive: boolean;
}): EnrollmentContentReleaseTransition => {
  if (previous?.mode === "scheduled" && !previous.startedAt) {
    throw new Error("Matricula agendada sem inicio da entrega.");
  }
  if (previous && (preserveExisting || wasContinuouslyActive)) {
    return { ...previous, event: null };
  }
  return hasDelayedModules
    ? { event: "content_release_scheduled", mode: "scheduled", startedAt: now }
    : { event: null, mode: "full_access", startedAt: null };
};
```

- [ ] **Step 4: Confirmar GREEN**

Run:

```powershell
bun run test -- src/features/enrollments/rules.test.ts
```

Expected: PASS.

### Task 2.2: Aplicar a transição em `rebuildEnrollmentProjection`

**Files:**

- Modify: `src/features/enrollments/server.ts`
- Modify: `src/features/enrollments/server-sql.test.ts`
- Modify: `src/features/enrollments/server-revocation.test.ts`

- [ ] **Step 1: Escrever testes SQL vermelhos**

Exigir que `rebuildEnrollmentProjection`:

- adquira advisory lock transacional por Conta + Curso antes de qualquer leitura;
- bloqueie a linha existente de Matrícula com `for update`;
- leia `content_release_mode`, `content_release_started_at`, `status`, `starts_at`,
  `expires_at` e `revoked_reason`;
- consulte se a publicação possui `release_delay_days > 0`;
- inclua modo/âncora no insert/upsert ativo;
- não limpe modo/âncora quando a projeção vira `expired` ou `revoked`;
- grave `content_release_scheduled` somente quando começa/recomeça.

Teste a presença destes fragmentos sem depender da formatação total:

```ts
expect(source).toContain("content_release_mode");
expect(source).toContain("content_release_started_at");
expect(source).toContain("release_delay_days > 0");
expect(source).toContain("pg_advisory_xact_lock");
expect(source).toContain("for update");
```

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
bun run test -- src/features/enrollments/server-sql.test.ts src/features/enrollments/server-revocation.test.ts
```

Expected: FAIL nos novos contratos.

- [ ] **Step 3: Estender a assinatura sem quebrar callers**

Usar:

```ts
export const rebuildEnrollmentProjection = async ({
  client,
  courseId,
  now = new Date(),
  preserveContentRelease = false,
  userId,
}: {
  client: PoolClient;
  courseId: string;
  now?: Date;
  preserveContentRelease?: boolean;
  userId: string;
}): Promise<void> => {
```

Antes de alterar grants/projeção, serializar inclusive o caso sem linha existente:

```ts
await client.query(
  "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))",
  [userId, courseId]
);
```

Depois buscar a Matrícula existente com `for update`. Calcular
`wasContinuouslyActive` contra `now` usando estado e janela anteriores. Consultar
`hasDelayedModules` na publicação vigente.

No upsert ativo, escrever explicitamente:

```sql
content_release_mode,
content_release_started_at
```

e atualizar ambos por `excluded` no conflito.

- [ ] **Step 4: Preservar nos callers administrativos**

Passar `preserveContentRelease: true` em:

- `extendEnrollmentExpiration`;
- `setEnrollmentExpiration`;
- `restoreEnrollmentAccess`.

Não passar em:

- primeira compra;
- concessão manual nova;
- nova compra após perda total.

`blockEnrollmentAccess` e revogações preservam as colunas porque a projeção terminal
não as sobrescreve.

- [ ] **Step 5: Registrar o evento de início**

Quando a regra pura retornar `event`, chamar `insertEnrollmentEvent` depois do upsert
ativo, usando o `enrollmentId` retornado. Metadado permitido:

```ts
{ startedAt: transition.startedAt?.toISOString() }
```

Não incluir nome, e-mail, preço ou payload de provider.

- [ ] **Step 6: Rodar testes focados**

Run:

```powershell
bun run test -- src/features/enrollments/rules.test.ts src/features/enrollments/server-sql.test.ts src/features/enrollments/server-revocation.test.ts src/features/payments/apply-authoritative-financial-evidence.test.ts
```

Expected: PASS.

### Checkpoint Git opcional da Sprint 2

```powershell
git add src/features/enrollments src/features/payments/apply-authoritative-financial-evidence.test.ts
git commit -m "feat: anchor scheduled content to enrollment access"
```

### Gate da Sprint 2

- primeira ativação inicia uma vez;
- renovação/overlap preservam;
- recompra após interrupção reinicia;
- restore/ajuste preservam;
- nenhuma Matrícula antiga deixa de ser `full_access`.

---

# Sprint 3 — Configurar Módulos e impedir publicação regressiva

## Objetivo

Permitir D+N no rascunho e bloquear qualquer publicação que aumente o atraso efetivo
de Aula existente para Matrículas agendadas.

### Task 3.1: Validar entrada do formulário de Módulo

**Files:**

- Modify: `src/features/admin/authoring.ts`
- Modify: `src/features/admin/authoring.test.ts`

- [ ] **Step 1: Escrever testes vermelhos do parser**

Cobrir:

- `releaseMode=immediate` => `0`, ignorando campo residual;
- `releaseMode=delayed&releaseDelayDays=8` => `8`;
- negativo, decimal, vazio em modo delayed e número não seguro => erro de domínio;
- criação e atualização persistem a coluna.

Mensagem esperada:

```text
Informe uma quantidade inteira e não negativa de dias.
```

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
bun run test -- src/features/admin/authoring.test.ts
```

- [ ] **Step 3: Implementar parser local pequeno**

Adicionar perto dos demais readers:

```ts
const readModuleReleaseDelayDays = (formData: FormData): number => {
  if (readString(formData, "releaseMode") === "immediate") {
    return 0;
  }
  const value = Number(readString(formData, "releaseDelayDays"));
  if (!(Number.isSafeInteger(value) && value >= 0)) {
    throw new Error(
      "Informe uma quantidade inteira e não negativa de dias."
    );
  }
  return value;
};
```

Não reutilizar `LessonAuthoringError`: o discriminador existente aceita somente campos
da Aula. `saveModuleAction` continua usando o tratamento global de erro do formulário.

- [ ] **Step 4: Persistir no `saveModule`**

Adicionar `release_delay_days` ao UPDATE, INSERT e conflito. Incluir o valor na posição
correta do array de parâmetros; atualizar os testes de valores, não apenas source tests.

- [ ] **Step 5: Copiar no clone de publicação**

Em `createCoursePublicationDraft`:

- selecionar `release_delay_days`;
- inserir a mesma coluna no Módulo clonado;
- testar clone de `D+8` sem alteração.

- [ ] **Step 6: Rodar GREEN**

Run:

```powershell
bun run test -- src/features/admin/authoring.test.ts src/features/admin/publication-contract.test.ts
```

Expected: PASS.

### Task 3.2: Expor configuração no Course Builder

**Files:**

- Modify: `src/features/admin/server.ts`
- Modify: `src/features/admin/server-read-projections.test.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx`

- [ ] **Step 1: Estender `AdminModule` e `readModules`**

Adicionar:

```ts
releaseDelayDays: number;
```

Selecionar `m.release_delay_days` em ambos os ramos de `readModules` e mapear para
camelCase. Adicionar a mesma coluna ao `readLessonEditor`, pois ele retorna um
`AdminModule`.

- [ ] **Step 2: Confirmar o read model com teste vermelho/verde**

Run antes da implementação: deve falhar. Run depois:

```powershell
bun run test -- src/features/admin/server-read-projections.test.ts
```

Expected final: PASS e fixture `release_delay_days: 8` mapeada para
`releaseDelayDays: 8`.

- [ ] **Step 3: Adicionar os controles sem estado global**

Dentro de `ModuleForm`, adicionar fieldset semântica:

```tsx
<fieldset className="space-y-3">
  <legend className="font-medium text-sm">Liberação do conteúdo</legend>
  <label className="flex items-center gap-2 text-sm">
    <input
      defaultChecked={(moduleData?.releaseDelayDays ?? 0) === 0}
      name="releaseMode"
      type="radio"
      value="immediate"
    />
    Imediatamente
  </label>
  <label className="flex items-center gap-2 text-sm">
    <input
      defaultChecked={(moduleData?.releaseDelayDays ?? 0) > 0}
      name="releaseMode"
      type="radio"
      value="delayed"
    />
    Após
    <Input
      className="w-24"
      defaultValue={moduleData?.releaseDelayDays || 8}
      min={1}
      name="releaseDelayDays"
      step={1}
      type="number"
    />
    dias
  </label>
  <p className="text-muted-foreground text-xs">
    Cada dia equivale a 24 horas desde o início do acesso da Aluna.
  </p>
</fieldset>
```

Não desabilitar o input pelo cliente: o parser server-side decide qual opção vale.

- [ ] **Step 4: Mostrar o resumo no cabeçalho do Módulo**

Ao lado do status:

```tsx
<Badge variant="outline">
  {moduleData.releaseDelayDays === 0
    ? "Liberação imediata"
    : `Liberação em D+${moduleData.releaseDelayDays}`}
</Badge>
```

- [ ] **Step 5: Testar rótulos, defaults e submissão**

Garantir no teste:

- radio imediato marcado em `0`;
- radio após marcado em `8`;
- input possui `min=1`, `step=1`;
- badge mostra D+8;
- formulário envia os nomes exatos esperados pelo parser.

Run:

```powershell
bun run test -- "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx"
```

Expected: PASS.

### Task 3.3: Criar validação monotônica da publicação

**Files:**

- Create: `src/features/admin/course-publication-release-policy.ts`
- Create: `src/features/admin/course-publication-release-policy.test.ts`
- Modify: `src/features/admin/authoring.ts`
- Modify: `src/features/admin/authoring.test.ts`

- [ ] **Step 1: Escrever o teste puro vermelho**

Usar o tipo:

```ts
interface PublishedLessonRelease {
  curriculumKey: string;
  lessonTitle: string;
  moduleTitle: string;
  releaseDelayDays: number;
}
```

Casos obrigatórios:

- D+8 → D+0 permitido;
- D+8 → D+8 permitido;
- D+0 → D+8 recusado;
- Aula movida de Módulo D+0 para D+8 recusada;
- `curriculumKey` nova em D+30 permitida;
- sem histórico de início programado, qualquer mudança permitida.

- [ ] **Step 2: Implementar retorno de violações, não booleano**

```ts
export interface ContentReleaseRegression {
  curriculumKey: string;
  lessonTitle: string;
  nextDelayDays: number;
  nextModuleTitle: string;
  previousDelayDays: number;
}

export const findContentReleaseRegressions = ({
  hasScheduledReleaseHistory,
  next,
  previous,
}: {
  hasScheduledReleaseHistory: boolean;
  next: PublishedLessonRelease[];
  previous: PublishedLessonRelease[];
}): ContentReleaseRegression[] => {
  if (!hasScheduledReleaseHistory) {
    return [];
  }
  const previousByKey = new Map(
    previous.map((lesson) => [lesson.curriculumKey, lesson])
  );
  const regressions: ContentReleaseRegression[] = [];
  for (const lesson of next) {
    const current = previousByKey.get(lesson.curriculumKey);
    if (current && lesson.releaseDelayDays > current.releaseDelayDays) {
      regressions.push({
        curriculumKey: lesson.curriculumKey,
        lessonTitle: lesson.lessonTitle,
        nextDelayDays: lesson.releaseDelayDays,
        nextModuleTitle: lesson.moduleTitle,
        previousDelayDays: current.releaseDelayDays,
      });
    }
  }
  return regressions;
};
```

- [ ] **Step 3: Confirmar regra pura**

Run:

```powershell
bun run test -- src/features/admin/course-publication-release-policy.test.ts
```

Expected: PASS.

- [ ] **Step 4: Integrar antes de aposentar a publicação vigente**

Em `publishCoursePublication`, ainda dentro da transação e antes de
`publishCourseCover`/updates:

1. consultar se existe `enrollment_events.event_type =
   'content_release_scheduled'` para o Curso;
2. ler Aulas da publicação vigente com `curriculum_key`, títulos e atraso do Módulo;
3. ler o mesmo conjunto do rascunho;
4. chamar `findContentReleaseRegressions`;
5. lançar erro seguro usando somente o primeiro Módulo/Aula;
6. consultar incompatibilidade entre Módulo obrigatório futuro e `expires_at` das
   Matrículas agendadas;
7. fazer tudo antes de qualquer efeito de publicação.

Mensagem recomendada:

```text
Não foi possível publicar: a Aula "X" passaria para D+8 no Módulo "Y". Depois do início das Matrículas, atrasos só podem ser reduzidos.
```

Não usar apenas `enrollments.content_release_mode = 'scheduled'` como guarda histórica:
um override Admin transforma a linha em `full_access`, mas não deve reabrir a
possibilidade de aumentar o cronograma para compras futuras.

- [ ] **Step 5: Provar rollback e ausência de efeito parcial**

No teste, confirmar que após violação:

- não há `update course_publications set status = 'retired'`;
- não há `update course_publications set status = 'published'`;
- `rollback` ocorre;
- capa não é publicada antes da validação.

Run:

```powershell
bun run test -- src/features/admin/authoring.test.ts src/features/admin/course-publication-release-policy.test.ts src/features/admin/publication-contract.test.ts
```

Expected: PASS.

### Task 3.4: Impedir abertura de vendas ou redução de validade incompatível

**Files:**

- Modify: `src/features/courses/availability-server.ts`
- Modify: `src/features/courses/availability-server.test.ts`
- Modify: `src/features/admin/authoring.ts`
- Modify: `src/features/admin/authoring.test.ts`

- [ ] **Step 1: Escrever teste vermelho para abertura de vendas**

Estender `LockedCourseAvailabilityRow` com `access_duration_months` e
`max_release_delay_days`. Para Curso de um mês:

- D+27 permite `preset: "available"`;
- D+28 recusa antes de atualizar `courses` ou enfileirar avisos;
- pausar/arquivar não depende dessa validação.

- [ ] **Step 2: Ler o maior atraso publicado no lock do Curso**

Adicionar ao `readLockedCourse`:

```sql
c.access_duration_months,
coalesce((
  select max(m.release_delay_days)
  from modules m
  join course_publications cp on cp.id = m.course_publication_id
  where cp.course_id = c.id
    and cp.status = 'published'
    and m.status = 'active'
), 0)::int as max_release_delay_days
```

- [ ] **Step 3: Reutilizar a regra pura ao abrir vendas**

No ramo `target.preset === "available"`, construir um snapshot mínimo com o maior
atraso ou extrair uma função pura `assertMaxReleaseDelayFitsAccessDuration`. Não copiar
a fórmula `months * 28` em mais de um módulo.

Erro administrativo:

```text
O cronograma de conteúdo não cabe na duração comercial do Curso.
```

- [ ] **Step 4: Impedir que `saveCourse` reduza a validade de um Curso à venda**

Quando o Curso existente estiver com `sales_status = 'open'`, validar o novo
`accessDurationMonths` contra o maior atraso da publicação vigente antes do UPDATE. A
mesma regra também será repetida no checkout como defesa de última linha.

- [ ] **Step 5: Rodar testes focados**

Run:

```powershell
bun run test -- src/features/courses/availability-server.test.ts src/features/admin/authoring.test.ts src/features/courses/module-content-release.test.ts
```

Expected: PASS e nenhuma mutação/outbox nos casos recusados.

### Checkpoint Git opcional da Sprint 3

```powershell
git add src/features/admin "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx"
git commit -m "feat: configure monotonic module release schedules"
```

### Gate da Sprint 3

- Admin configura apenas Módulo;
- clone preserva atraso;
- reordenação não muda regra;
- aumento/movimentação regressiva falha antes da publicação;
- redução permanece possível.

---

# Sprint 4 — Preservar e apresentar a oferta no checkout

## Objetivo

Garantir que a compradora veja o cronograma antes da mutação financeira e que o Pedido
preserve exatamente esse snapshot.

### Task 4.1: Construir o snapshot no núcleo do checkout

**Files:**

- Modify: `src/features/payments/checkout.ts`
- Modify: `src/features/payments/checkout.test.ts`
- Create: `src/features/courses/module-content-release-digest.ts`
- Create: `src/features/courses/module-content-release-digest.test.ts`

- [ ] **Step 1: Escrever testes vermelhos**

Adicionar fixtures de Módulos publicados:

```ts
const releaseModules = [
  { release_delay_days: 0, sort_order: 1, title: "Comece aqui" },
  { release_delay_days: 8, sort_order: 2, title: "Aplicacao" },
];
```

Exigir:

- leitura somente da publicação `published`;
- snapshot ordenado persistido no INSERT de `orders`;
- tentativa duplicada retorna o Pedido existente sem recalcular/substituir snapshot;
- nenhum ID de Módulo/Aula entra no JSON;
- atraso incompatível com a duração comercial recusa antes de INSERT/provider.
- digest diferente do snapshot vigente recusa antes de INSERT/provider.

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
bun run test -- src/features/payments/checkout.test.ts
```

- [ ] **Step 3: Adicionar `contentReleaseScheduleSnapshot` a `CheckoutOrder`**

Atualizar todas as queries repetidas de Pedido no arquivo. Não deixar um SELECT sem a
nova coluna, pois retries precisam devolver o snapshot original.

Adicionar `expectedContentReleaseScheduleDigest: string` a
`CreateAsaasCheckoutIntentInput`. Validar formato hexadecimal SHA-256 antes de consultar
o banco.

Adicionar `"schedule_changed"` a `CheckoutIntentErrorReason`, mensagem segura “O
cronograma do Curso foi atualizado.” e expor a razão sem parsing de mensagem:

```ts
export class CheckoutIntentError extends Error {
  readonly kind: CheckoutIntentErrorKind;
  readonly reason: CheckoutIntentErrorReason | null;

  constructor(
    kind: CheckoutIntentErrorKind,
    reason?: CheckoutIntentErrorReason
  ) {
    super(
      reason
        ? CHECKOUT_INTENT_REASON_MESSAGES[reason]
        : CHECKOUT_INTENT_ERROR_MESSAGES[kind]
    );
    this.name = "CheckoutIntentError";
    this.kind = kind;
    this.reason = reason ?? null;
  }
}
```

- [ ] **Step 4: Ler Módulos e construir snapshot antes do Pedido**

Depois de validar Curso/publicação e antes do INSERT:

```ts
const releaseModules = await pool.query<{
  release_delay_days: number;
  sort_order: number;
  title: string;
}>(
  `select m.title, m.sort_order, m.release_delay_days
   from modules m
   join course_publications cp on cp.id = m.course_publication_id
   where cp.course_id = $1
     and cp.status = 'published'
     and m.status = 'active'
   order by m.sort_order asc`,
  [course.id]
);
const contentReleaseScheduleSnapshot =
  buildContentReleaseScheduleSnapshot(
    releaseModules.rows.map((module) => ({
      releaseDelayDays: module.release_delay_days,
      sortOrder: module.sort_order,
      title: module.title,
    }))
  );
```

Persistir com `JSON.stringify(contentReleaseScheduleSnapshot)` e cast `::jsonb`.

- [ ] **Step 5: Criar e comparar o digest canônico**

Criar o arquivo server-only:

```ts
import "server-only";
import { createHash } from "node:crypto";
import type { ContentReleaseScheduleSnapshot } from "./module-content-release";

export const getContentReleaseScheduleDigest = (
  snapshot: ContentReleaseScheduleSnapshot
): string =>
  createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
```

Testar estabilidade para o mesmo snapshot e diferença quando título, ordem ou atraso
mudar. Depois de construir o snapshot vigente no checkout:

```ts
if (
  getContentReleaseScheduleDigest(contentReleaseScheduleSnapshot) !==
  input.expectedContentReleaseScheduleDigest
) {
  throw new CheckoutIntentError("conflict", "schedule_changed");
}
```

A comparação ocorre antes de autorizar rate limit, inserir Pedido ou chamar provider.

- [ ] **Step 6: Validar que o cronograma cabe na duração**

Adicionar regra pura no módulo de conteúdo:

```ts
export const assertScheduleFitsAccessDuration = ({
  accessDurationMonths,
  snapshot,
}: {
  accessDurationMonths: number;
  snapshot: ContentReleaseScheduleSnapshot;
}): void => {
  const conservativeAccessDays = accessDurationMonths * 28;
  const maxDelayDays = Math.max(
    0,
    ...snapshot.modules.map((module) => module.releaseDelayDays)
  );
  if (maxDelayDays >= conservativeAccessDays) {
    throw new Error(
      "O cronograma de conteúdo não cabe na duração comercial do Curso."
    );
  }
};
```

Adicionar testes unitários para 1 mês/D+27 permitido e 1 mês/D+28 recusado. No
checkout, converter o erro para `CheckoutIntentError("unavailable",
"course_unavailable")`, sem revelar configuração interna ao público.

- [ ] **Step 7: Confirmar GREEN**

Run:

```powershell
bun run test -- src/features/courses/module-content-release.test.ts src/features/courses/module-content-release-digest.test.ts src/features/payments/checkout.test.ts
```

Expected: PASS.

### Task 4.2: Mostrar o mesmo snapshot no handoff

**Files:**

- Modify: `src/features/payments/purchase-handoff.ts`
- Modify: `src/features/payments/purchase-handoff.test.ts`
- Modify: `src/features/payments/checkout-api.ts`
- Modify: `src/features/payments/checkout-api.test.ts`
- Modify: `src/app/api/checkouts/course/route.ts`
- Modify: `src/app/api/checkouts/course/route.test.ts`
- Modify: `src/app/comprar/[slug]/page.tsx`
- Modify: `src/app/comprar/[slug]/page.test.tsx`
- Modify: `src/app/comprar/[slug]/purchase-handoff-client.tsx`
- Modify: `src/app/comprar/[slug]/purchase-handoff-client.test.tsx`

- [ ] **Step 1: Estender `PurchaseHandoffView.checkout`**

Adicionar:

```ts
releaseSchedule: ContentReleaseScheduleSnapshot;
releaseScheduleDigest: string;
```

O query do handoff deve agregar/ler os mesmos Módulos publicados e chamar o mesmo
builder puro. Não aceitar snapshot vindo do browser.

- [ ] **Step 2: Estender o request público com somente o digest**

Em `checkout-api.ts`, adicionar a chave obrigatória
`expectedContentReleaseScheduleDigest`, validada por `/^[0-9a-f]{64}$/`. O body válido
passa a ter exatamente três chaves: attempt, um identificador de Curso e digest.

Adicionar a `CheckoutApiResponse`:

```ts
| { retryAllowed: false; status: "schedule_changed" }
```

No Route Handler, quando `CheckoutIntentError.reason === "schedule_changed"`, responder
HTTP 409 com esse estado seguro. Os demais conflitos continuam genéricos. Testar que a
rota passa o digest ao serviço e rejeita digest ausente/inválido antes da sessão.

- [ ] **Step 3: Escrever testes vermelhos do fluxo**

Casos:

- todos D+0 => POST automático atual;
- algum D+N => zero POST antes do clique;
- lista mostra `Comece aqui — imediato` e `Aplicacao — após 8 dias`;
- clique “Continuar para pagamento” produz exatamente um POST;
- remount/retry continua reutilizando UUID;
- mudança de digest retorna `schedule_changed`, não cria nova tentativa e oferece
  atualização da página;
- acessibilidade: field/section possui heading e botão alcançável.

- [ ] **Step 4: Introduzir estados `review` e `schedule_changed`**

Adicionar a `HandoffState`:

```ts
| { kind: "review" }
| { kind: "schedule_changed" }
```

Inicializar com `review` quando `hasDelayedModules(releaseSchedule)`. O `useEffect` não
chama `startCheckout` nesse estado. O botão chama `startCheckout(false)`.

Todo POST inclui `expectedContentReleaseScheduleDigest: releaseScheduleDigest`. Quando
o backend devolver `schedule_changed`, limpar timers e mostrar “O cronograma foi
atualizado. Recarregue para revisar antes de continuar.” com um botão que executa
`window.location.reload()`.

- [ ] **Step 5: Renderizar resumo estático**

Passar o snapshot da Server Component para o Client Component. Renderizar somente
título, ordem e atraso; não renderizar IDs. Texto obrigatório:

```text
Parte do conteúdo é liberada progressivamente. Cada dia equivale a 24 horas desde o início do seu acesso.
```

- [ ] **Step 6: Confirmar testes**

Run:

```powershell
bun run test -- src/features/payments/checkout-api.test.ts src/features/payments/purchase-handoff.test.ts "src/app/api/checkouts/course/route.test.ts" "src/app/comprar/[slug]/page.test.tsx" "src/app/comprar/[slug]/purchase-handoff-client.test.tsx" src/features/payments/checkout.test.ts
```

Expected: PASS.

### Checkpoint Git opcional da Sprint 4

```powershell
git add src/features/payments src/app/comprar
git commit -m "feat: disclose and snapshot module release schedule"
```

### Gate da Sprint 4

- cronograma atrasado exige ação explícita antes do checkout;
- snapshot exibido e persistido vem da mesma regra server-side;
- mudança entre render e clique é detectada antes de qualquer efeito;
- retry não altera contrato histórico;
- Curso totalmente imediato mantém fluxo atual.

---

# Sprint 5 — Projetar Módulos futuros sem entregar conteúdo

## Objetivo

Atualizar o overview e a navegação para mostrar Módulos futuros com data, sem vazar
Aulas, mídia, materiais ou comentários.

### Task 5.1: Separar Progresso de disponibilidade temporal

**Files:**

- Modify: `src/features/progress/rules.ts`
- Modify: `src/features/progress/rules.test.ts`
- Modify: `src/features/courses/server.ts`
- Modify: `src/features/courses/server-sql.test.ts`

- [ ] **Step 1: Escrever teste vermelho para próxima Aula elegível**

Adicionar helper puro:

```ts
export const getNextAvailablePendingLessonId = (
  lessons: Array<{
    availability: LessonAvailability;
    id: string;
    isCompleted: boolean;
  }>
): string | null =>
  lessons.find(
    (lesson) =>
      !lesson.isCompleted && lesson.availability.kind === "available"
  )?.id ?? null;
```

Testar que uma Aula D+8 é ignorada e que nenhuma Aula posterior atravessa a sequência.

- [ ] **Step 2: Adicionar campos às rows do overview/workspace**

Selecionar:

```sql
e.content_release_mode,
e.content_release_started_at,
m.release_delay_days
```

em todas as leituras matriculadas de Curso/Aula. Preview Admin não depende da
Matrícula e trata todo Módulo como `available`.

- [ ] **Step 3: Trocar `isAvailable: boolean` por razão discriminada**

No DTO da Aula:

```ts
availability:
  | { kind: "available" }
  | { availableAt: Date; kind: "time_locked" }
  | { kind: "sequence_locked" };
```

Não manter os dois contratos (`isAvailable` e `availability`) em paralelo depois da
migração dos consumidores; isso criaria decisões divergentes.

- [ ] **Step 4: Projetar Módulo bloqueado de forma mínima**

O DTO de Módulo deve conter:

```ts
{
  availableAt: Date | null;
  description: string | null;
  id: string;
  lessonCount: number;
  lessons: LessonSummary[];
  releaseState: "available" | "time_locked";
  sortOrder: number;
  title: string;
  totalDurationSeconds: number;
}
```

Quando `time_locked`:

- `description: null`;
- `lessons: []`;
- preservar apenas título, contagem, duração agregada e `availableAt`.

Calcular `nextReleaseAt` como o menor `availableAt` futuro. Calcular Progresso/total com
as rows internas antes de remover detalhes do DTO.

- [ ] **Step 5: Testar ausência de vazamento**

Fixture com Módulo 1 D+0 e Módulo 2 D+8 deve provar:

```ts
expect(overview?.modules[1]).toMatchObject({
  description: null,
  lessonCount: 2,
  lessons: [],
  releaseState: "time_locked",
});
expect(JSON.stringify(overview?.modules[1])).not.toContain("video");
expect(overview?.nextReleaseAt).toEqual(expectedDate);
```

- [ ] **Step 6: Rodar testes de domínio/read model**

Run:

```powershell
bun run test -- src/features/progress/rules.test.ts src/features/courses/module-content-release.test.ts src/features/courses/server-sql.test.ts
```

Expected: PASS.

### Task 5.2: Renderizar Módulo futuro no overview

**Files:**

- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/page.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/page.test.tsx`

- [ ] **Step 1: Escrever teste de componente vermelho**

Exigir:

- heading do Módulo;
- texto `Disponível em 12/09/2026 às 14:30`;
- `4 aulas`;
- nenhum card/título de Aula do Módulo futuro;
- ícone/cadeado acompanhado de texto, nunca somente cor;
- ausência de link para Módulo futuro.

- [ ] **Step 2: Criar branch de renderização do Módulo**

Antes da lista de Aulas:

```tsx
if (moduleData.releaseState === "time_locked") {
  return (
    <section aria-labelledby={`module-${moduleData.id}`} key={moduleData.id}>
      <h3 id={`module-${moduleData.id}`}>{moduleData.title}</h3>
      <p>
        Disponível em {formatDateTime(moduleData.availableAt)}
      </p>
      <p>{moduleData.lessonCount} aulas</p>
    </section>
  );
}
```

Usar os componentes/classes existentes; o trecho define contrato, não layout final.

- [ ] **Step 3: Corrigir ação primária quando não há próxima Aula**

Quando `nextLessonId === null` e `nextReleaseAt !== null`:

- não criar Link para o Curso atual;
- renderizar botão desabilitado `Próximo módulo em …` ou texto equivalente;
- não usar rótulo “Rever trilha” como se o percurso estivesse concluído.

- [ ] **Step 4: Confirmar testes**

Run:

```powershell
bun run test -- "src/app/(student)/app/cursos/[courseId]/page.test.tsx" src/features/courses/server-sql.test.ts
```

Expected: PASS.

### Checkpoint Git opcional da Sprint 5

```powershell
git add src/features/progress src/features/courses "src/app/(student)/app/cursos/[courseId]"
git commit -m "feat: show scheduled modules without leaking lessons"
```

### Gate da Sprint 5

- Módulo futuro visível e explicável;
- detalhes internos ausentes do DTO entregue;
- Progresso mantém todas as Aulas obrigatórias;
- próxima Aula/data coerentes;
- preview Admin permanece integral.

---

# Sprint 6 — Fechar todos os caminhos de bypass

## Objetivo

Aplicar a mesma decisão a rota direta, progresso, comentários, vídeo e materiais.

### Task 6.1: Retornar decisão detalhada na fronteira de Aula

**Files:**

- Modify: `src/features/enrollments/access.ts`
- Modify: `src/features/enrollments/access.test.ts`
- Modify: `src/features/courses/access-contract.test.ts`

- [ ] **Step 1: Escrever testes vermelhos**

Contrato:

```ts
export type LessonAccessDecision =
  | { courseId: string; kind: "allowed" }
  | { availableAt: Date; courseId: string; kind: "time_locked" }
  | { kind: "denied" };
```

Testar:

- Matrícula full access => allowed;
- scheduled antes do prazo => time_locked;
- exatamente no prazo => allowed;
- Aula concluída anteriormente => allowed;
- status/expiração/publicação inválidos => denied;
- scheduled sem âncora => denied, embora a constraint também impeça o estado.

- [ ] **Step 2: Implementar uma única query parametrizada**

A query deve retornar Curso, modo, âncora, atraso e existência de conclusão pela mesma
`curriculum_key`. Não concatenar input em SQL. Calcular `availableAt` na regra TypeScript
com `now` injetável; o banco não precisa decidir timezone.

Assinatura:

```ts
export const resolveLessonAccess = async ({
  lessonId,
  now = new Date(),
  userId,
}: {
  lessonId: string;
  now?: Date;
  userId: string;
}): Promise<LessonAccessDecision> => {
```

- [ ] **Step 3: Confirmar testes**

Run:

```powershell
bun run test -- src/features/enrollments/access.test.ts src/features/courses/access-contract.test.ts
```

Expected: PASS.

### Task 6.2: Adaptar workspace, página e mutações

**Files:**

- Modify: `src/features/courses/server.ts`
- Modify: `src/features/courses/server-sql.test.ts`
- Modify: `src/app/(student)/app/aulas/[lessonId]/page.tsx`
- Modify: `src/app/(student)/app/actions.ts`
- Modify: `src/app/(student)/app/actions.test.ts`

- [ ] **Step 1: Fazer o workspace distinguir bloqueio temporal**

Retorno público:

```ts
export type StudentLessonWorkspaceResult =
  | { data: StudentLessonData; kind: "available" }
  | { availableAt: Date; courseId: string; kind: "time_locked" }
  | { kind: "unavailable" };
```

Não consultar/sincronizar JMVStream quando a decisão não for `allowed`.

- [ ] **Step 2: Atualizar a página de Aula**

Fluxo:

```ts
const workspace = await getStudentLessonWorkspace({
  lessonId,
  viewer: { role: session.role, userId: session.user.id },
});
if (workspace.kind === "time_locked") {
  redirect(route(`/app/cursos/${workspace.courseId}?module=scheduled`));
}
if (workspace.kind === "unavailable") {
  notFound();
}
const data = workspace.data;
```

`redirect()` deve ficar fora de `try/catch`.

- [ ] **Step 3: Atualizar conclusão e player**

`completeLesson` e `recordLessonWatchProgress` só prosseguem com
`workspace.kind === "available"`. Para os outros estados, lançar:

```text
Aula indisponível para esta matrícula.
```

Não retornar `availableAt` em Server Action pública.

- [ ] **Step 4: Confirmar que player não é chamado**

Adicionar assertion:

```ts
expect(syncJmvstreamLessonPlayer).not.toHaveBeenCalled();
```

para Aula temporalmente bloqueada.

Run:

```powershell
bun run test -- src/features/courses/server-sql.test.ts "src/app/(student)/app/actions.test.ts"
```

Expected: PASS.

### Task 6.3: Proteger comentários e materiais

**Files:**

- Modify: `src/features/comments/server.ts`
- Modify: `src/features/comments/server-sql.test.ts`
- Modify: `src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.ts`
- Modify: `src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.test.ts`
- Modify: `src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.ts`
- Modify: `src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.test.ts`

- [ ] **Step 1: Fazer comentários reutilizarem `resolveLessonAccess`**

Para `student`, chamar a fronteira antes de buscar comentários. Somente `allowed`
prossegue para a sequência existente. Admin preview continua pelo ramo próprio; Support
continua negado.

Não copiar novamente a fórmula `startedAt + delay` para comentários.

- [ ] **Step 2: Adaptar rotas R2 ao retorno discriminado**

Somente `kind === "available"` pode ler `workspace.data.lesson.contentJson` e assinar
URL. Nos outros casos:

```ts
return Response.json({ error: "Material nao encontrado." }, { status: 404 });
```

Nunca assinar primeiro para decidir depois.

- [ ] **Step 3: Testar ausência de efeitos**

Para Aula D+8 bloqueada:

- `createLessonResourceDownloadUrl` não chamado;
- `createR2ObjectReadUrl` não chamado;
- query de comentários não executada depois da negação;
- criação de comentário falha;
- nenhuma informação de data aparece na resposta 404 de material.

Run:

```powershell
bun run test -- src/features/comments/server-sql.test.ts "src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.test.ts" "src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.test.ts"
```

Expected: PASS.

### Task 6.4: Auditar consumidores da Aula

**Files:** all tracked source, read-only audit.

- [ ] **Step 1: Listar todos os consumidores**

Run:

```powershell
git grep -n "getStudentLessonWorkspace\|resolveLessonAccess\|createLessonResourceDownloadUrl\|video_embed_url" -- src
```

Expected: cada superfície encontrada aparece nas Tasks 6.1–6.3 ou é explicitamente
Admin-only.

- [ ] **Step 2: Corrigir somente consumidores omitidos**

Se surgir consumidor Student não listado, aplicar a decisão central e criar um teste de
negação antes de continuar. Se surgir consumidor externo não compreendido, STOP e
reportar; não improvisar uma política.

### Checkpoint Git opcional da Sprint 6

```powershell
git add src/features/enrollments/access.ts src/features/enrollments/access.test.ts src/features/courses src/features/comments "src/app/(student)/app" src/app/api/lessons
git commit -m "feat: enforce scheduled modules across lesson boundaries"
```

### Gate da Sprint 6

- URL conhecida não contorna bloqueio;
- nenhuma mutação grava Progresso;
- nenhum player ou material recebe URL;
- comentário não vaza conteúdo;
- redirecionamento da página é explicável e rotas de arquivo permanecem opacas.

---

# Sprint 7 — Dar visibilidade ao Suporte e override ao Admin

## Objetivo

Permitir diagnóstico sem ampliar permissões e oferecer uma única exceção irreversível
para o episódio atual.

### Task 7.1: Implementar comando transacional de Acesso integral

**Files:**

- Modify: `src/features/admin/enrollment-command-input.ts`
- Modify: `src/features/admin/enrollment-command-input.test.ts`
- Modify: `src/features/enrollments/server.ts`
- Modify: `src/features/enrollments/server-sql.test.ts`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/admin/enrollment-actions.test.ts`

- [ ] **Step 1: Criar parser vermelho**

Export esperado:

```ts
export const parseGrantEnrollmentFullContentAccessInput = (
  formData: FormData
): { enrollmentId: string; reason: string } =>
  z
    .object({
      enrollmentId: requiredEnrollmentId,
      reason: z.string().trim().min(1, "Informe o motivo da liberação."),
    })
    .parse({
      enrollmentId: readString(formData, "enrollmentId"),
      reason: readString(formData, "reason"),
    });
```

Testar vazio, espaços e payload válido.

- [ ] **Step 2: Criar serviço transacional**

Assinatura:

```ts
export const grantEnrollmentFullContentAccess = async ({
  actorUserId,
  enrollmentId,
  reason,
}: {
  actorUserId: string;
  enrollmentId: string;
  reason: string;
}): Promise<{ changed: boolean }> => {
```

Dentro de uma transação:

1. `select id, user_id, course_id, content_release_mode,
   content_release_started_at from enrollments where id = $1 for update`;
2. validar Matrícula existente;
3. se já `full_access`, commit e `{ changed: false }` sem novo evento;
4. atualizar modo para `full_access` e âncora para `null`;
5. inserir `content_full_access_granted` em `enrollment_events`;
6. inserir `enrollment.content_full_access_granted` em `audit_logs`;
7. commit.

Metadados contêm somente motivo normalizado e âncora anterior em ISO.

- [ ] **Step 3: Criar Server Action com permissão correta**

```ts
export const grantEnrollmentFullContentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageEnrollmentAccess");
  const input = parseGrantEnrollmentFullContentAccessInput(formData);
  const { grantEnrollmentFullContentAccess } = await import(
    "@/features/enrollments/server"
  );
  await grantEnrollmentFullContentAccess({
    actorUserId: session.user.id,
    ...input,
  });
  revalidateEnrollmentAdminPaths();
};
```

Não usar `manageEnrollmentSupport`.

- [ ] **Step 4: Testar idempotência e autorização**

Exigir:

- Admin chama serviço;
- Support negado antes do serviço;
- segunda chamada não duplica evento/audit;
- Concessão, expiração e Progresso não aparecem em UPDATE.

Run:

```powershell
bun run test -- src/features/admin/enrollment-command-input.test.ts src/features/admin/enrollment-actions.test.ts src/features/enrollments/server-sql.test.ts
```

Expected: PASS.

### Task 7.2: Expor estado na ficha sem duplicar autoridade

**Files:**

- Modify: `src/features/admin/server.ts`
- Modify: `src/features/admin/support-server.ts`
- Modify: `src/features/admin/support-server.test.ts`
- Modify: `src/components/admin/student-management-types.ts`
- Modify: `src/components/admin/student-management-sheet.tsx`
- Modify: `src/components/admin/student-enrollment-list.tsx`
- Create: `src/components/admin/student-content-release-controls.tsx`
- Create: `src/components/admin/student-content-release-controls.test.tsx`
- Modify: admin/support tables listed in the file map

- [ ] **Step 1: Estender payload da Matrícula**

Adicionar:

```ts
contentReleaseMode: "full_access" | "scheduled";
contentReleaseStartedAt: string | null;
nextModuleReleaseAt: string | null;
```

Calcular `nextModuleReleaseAt` no servidor como o menor instante futuro entre Módulos
ativos publicados. Support apenas recebe dados do Curso em contexto.

- [ ] **Step 2: Adicionar capacidade explícita à UI**

Em `StudentManagementCapabilities`:

```ts
canManageEnrollmentAccess: boolean;
```

Valores:

- telas Admin: `true`;
- tela Support: `false`.

Não reutilizar `canManagePlatformAccess`, apesar de hoje também ser Admin-only; são
responsabilidades diferentes.

- [ ] **Step 3: Renderizar diagnóstico**

Na expansão da Matrícula:

- `Acesso integral` para `full_access`;
- `Liberação programada desde 04/09/2026 às 14:30` para `scheduled`;
- `Próximo Módulo em 12/09/2026 às 14:30` quando existir;
- nenhuma data futura quando todos já estiverem disponíveis.

- [ ] **Step 4: Criar controle Admin**

`StudentContentReleaseControls` deve:

- aparecer somente para `scheduled` e `canManageEnrollmentAccess`;
- exigir abrir disclosure/dialog;
- exigir motivo;
- chamar a Server Action;
- desabilitar durante submissão;
- chamar `onSuccess` após sucesso;
- usar texto claro de irreversibilidade no episódio atual.

Não oferecer “Restaurar cronograma”.

- [ ] **Step 5: Testar a fronteira visual**

Casos:

- Admin vê o botão;
- Support vê datas, mas não botão;
- full access não vê botão;
- motivo vazio não submete;
- sucesso atualiza a ficha;
- controle possui label e foco restaurado após fechar.

Run:

```powershell
bun run test -- src/features/admin/support-server.test.ts src/components/admin/student-content-release-controls.test.tsx src/components/admin/student-management-sheet.test.tsx
```

Expected: PASS.

### Checkpoint Git opcional da Sprint 7

```powershell
git add src/features/admin src/features/enrollments/server.ts src/components/admin "src/app/(admin)"
git commit -m "feat: manage enrollment content release safely"
```

### Gate da Sprint 7

- Support diagnostica sem mutar;
- Admin concede acesso integral com motivo;
- operação é transacional, auditada, idempotente e sem reversão;
- nenhuma permissão existente foi ampliada acidentalmente.

---

# Sprint 8 — Provar jornadas reais e fechar documentação

## Objetivo

Validar banco, compra, acesso, bloqueios, tempo, override e acessibilidade de ponta a
ponta; atualizar autoridades canônicas.

### Task 8.1: Criar integração PostgreSQL da projeção

**Files:**

- Create: `src/features/enrollments/content-release.integration.test.ts`
- Modify: `src/features/payments/asaas-webhook-worker.integration.test.ts`

- [ ] **Step 1: Preparar fixture isolada**

Seguir setup/cleanup de `certificate-issuance.integration.test.ts`. Criar:

- Curso com publicação vigente;
- Módulo 1 D+0;
- Módulo 2 D+8;
- Conta Student;
- Concessões controladas.

Não chamar Asaas real, R2 real ou JMVStream real.

- [ ] **Step 2: Provar transições reais**

Casos na mesma suite serial:

1. primeira Concessão => `scheduled` + âncora fixa;
2. duas primeiras Concessões concorrentes => uma âncora e um evento;
3. retry do mesmo Pedido => mesma âncora e um evento;
4. renovação sobreposta => mesma âncora;
5. refund da primeira com segunda ativa => mesma âncora;
6. refund de todas => Matrícula revogada;
7. nova compra posterior => nova âncora;
8. bloqueio/restauração manual => âncora preservada;
9. override => `full_access` + `null` + um evento/audit.

- [ ] **Step 3: Rodar integração em banco descartável**

Run conforme runbook local/CI:

```powershell
bun run test:certificates:integration
```

Expected: todas as suites `*.integration.test.ts` passam. Se `DATABASE_URL` não apontar
para PostgreSQL descartável autorizado, STOP; não trocar para Neon compartilhado.

- [ ] **Step 4: Provar a entrada financeira real da âncora**

Em `asaas-webhook-worker.integration.test.ts`, estender um caso de pagamento confirmado
para verificar que o worker cria a Matrícula `scheduled` quando a publicação possui
Módulo D+N. Reentregar o mesmo webhook e confirmar que modo, âncora e contagem do evento
permanecem iguais. Não criar um segundo fluxo financeiro paralelo só para esta feature.

### Task 8.2: Atualizar fixture e jornadas E2E

**Files:**

- Modify: `scripts/seed-e2e.ts`
- Modify: `tests/e2e/payment-helpers.ts`
- Modify: `tests/e2e/critical-journeys.spec.ts`

- [ ] **Step 1: Adicionar Módulo futuro à fixture**

Preservar o Módulo/Aula atual em D+0. Criar um segundo Módulo D+8 com uma Aula de texto
e material R2 fixture. Expor IDs somente na fixture E2E local.

Criar:

- uma Matrícula histórica `full_access`;
- uma Matrícula `scheduled` com âncora atual;
- uma Matrícula `scheduled` com âncora anterior a D+8;
- uma compradora sem Matrícula para o handoff.

- [ ] **Step 2: Criar helper tolerante à confirmação de checkout**

```ts
const continueScheduledCheckout = async (page: Page): Promise<void> => {
  const button = page.getByRole("button", {
    name: "Continuar para pagamento",
  });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
};
```

Chamar após navegar para `/comprar/[slug]` em todos os testes que esperam redirect.

- [ ] **Step 3: Testar a oferta antes do POST**

No teste de handoff:

- observar requests;
- confirmar zero POST antes do clique;
- confirmar textos dos Módulos;
- clicar;
- confirmar um POST e redirect;
- depois do webhook, consultar Pedido e comparar snapshot persistido.

- [ ] **Step 4: Testar bloqueio e passagem do tempo sem `wait`**

Para Matrícula recente:

- overview mostra D+8;
- título da Aula futura ausente;
- URL direta redireciona ao Curso;
- material retorna 404;
- tentativa de conclusão não grava Progresso.

Depois, por helper E2E server-only, mover apenas
`content_release_started_at` da fixture para nove dias atrás. Recarregar:

- Módulo e Aula aparecem;
- rota abre;
- material pode ser assinado;
- sequência continua válida.

Não usar `page.waitForTimeout` para simular oito dias.

- [ ] **Step 5: Testar grandfathering e override**

- Matrícula `full_access` abre Módulo D+8 imediatamente;
- Support vê a próxima data sem botão;
- Admin concede acesso integral com motivo;
- reload remove o bloqueio;
- histórico mostra evento sem PII.

- [ ] **Step 6: Rodar desktop, mobile e axe**

Run:

```powershell
bun run test:e2e
```

Expected: desktop e testes `@mobile` passam; nenhuma violação axe moderada ou maior nas
novas superfícies.

### Task 8.3: Atualizar documentação canônica

**Files:**

- Modify: `PRODUCT.md`
- Modify: `CONTEXT.md`
- Modify: `docs/README.md`
- Modify: `docs/decisions.md`
- Modify: `docs/domain/commerce-and-access.md`
- Modify: `docs/domain/learning-content-and-progress.md`
- Modify: `docs/architecture.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/operations/testing-and-ci.md`
- Verify: spec and ADR desta feature

- [ ] **Step 1: Atualizar estado implementado**

Documentar uma única vez cada regra com ID canônico:

- comércio: snapshot do Pedido, início/preservação/reinício da âncora e override;
- aprendizagem: Módulo como unidade temporal, precedência com sequência e
  grandfathering;
- arquitetura: nova função profunda e pontos de enforcement;
- produto: jornada da Aluna e limites antifraude;
- decisões: mudar “ainda não implementada” para “aprovada e implementada” somente
  depois dos testes verdes.

- [ ] **Step 2: Atualizar autoridade de migrations**

Em `database-and-migrations.md`, atualizar:

- `current_migration_tag` para o nome real gerado em 0070;
- `migration_entry_count` para `71`;
- `schema_table_count` permanece `47`, após confirmar pelo verificador.

Não inventar estado de Staging/Production. `release-state.md` só muda depois de uma
implantação observada, fora deste plano.

- [ ] **Step 3: Registrar comandos de teste**

Em `testing-and-ci.md`, acrescentar a integração de liberação temporal entre os
contratos de PostgreSQL. Não alterar ordem de CI se nenhum job novo for necessário.

- [ ] **Step 4: Verificar docs**

Run:

```powershell
bun run docs:check
```

Expected: `Documentação válida` e os totais batem com schema/journal.

### Task 8.4: Executar fechamento completo

**Files:** all changed files.

- [ ] **Step 1: Formatar/autocorrigir deliberadamente**

Run:

```powershell
bun x ultracite fix
```

Expected: exit code `0`. Revisar o diff e reverter manualmente apenas mudanças
claramente não relacionadas; não usar `git checkout --`.

- [ ] **Step 2: Rodar gates rápidos**

```powershell
bun run verify:quick
```

Expected: PASS.

- [ ] **Step 3: Rodar gates completos**

```powershell
bun run verify
```

Expected: docs, migration, types, Ultracite, unit, audit, integração, E2E, build e Knip
passam conforme o runner do projeto.

- [ ] **Step 4: Auditar o diff por escopo**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected:

- nenhuma whitespace error;
- nenhum `.env`, secret, fixture de Production ou artefato temporário;
- nenhum cron/coorte/regra por Aula;
- `skills-lock.json` preservado se a mudança era preexistente.

- [ ] **Step 5: Revisar invariantes manualmente**

Responder “sim” com evidência para cada item:

1. existing enrollment continua full access?
2. checkout scheduled exige confirmação?
3. Pedido guarda o snapshot exibido?
4. primeira concessão inicia exatamente uma vez?
5. renovação/overlap preservam?
6. recompra após perda total reinicia?
7. publicação não aumenta atraso existente?
8. URL/action/comment/resource/video negam bypass?
9. Support não ganhou mutação?
10. Admin override é one-way, transacional e auditado?
11. Certificado não nasce com conteúdo obrigatório futuro?
12. nenhum job decide acesso?

### Checkpoint Git opcional da Sprint 8

Somente depois de `bun run verify` verde e com autorização explícita:

```powershell
git add PRODUCT.md CONTEXT.md docs src scripts tests
git commit -m "feat: release course modules on an enrollment schedule"
```

### Gate da Sprint 8

- fluxo completo comprovado em PostgreSQL e navegador;
- documentação canônica atualizada;
- full verification verde;
- nenhum deploy, migration remota, commit ou push sem autorização própria.

---

## 5. Critérios globais de pronto

- [ ] Módulo aceita `D+0` ou `D+N`; Aula não possui configuração própria.
- [ ] `D+N` equivale exatamente a `N × 24 horas` em UTC.
- [ ] Matrícula distingue `full_access` e `scheduled` com constraint de banco.
- [ ] Matrículas preexistentes permanecem `full_access`.
- [ ] Primeiro episódio agendado cria âncora; continuidade preserva; recompra após
      perda total reinicia.
- [ ] Pedido captura o snapshot exibido antes do checkout.
- [ ] Alteração mais restritiva de Aula existente não pode ser publicada.
- [ ] Módulo futuro mostra título, contagem e data, mas nenhum conteúdo interno.
- [ ] Progresso considera Aulas obrigatórias futuras.
- [ ] Certificado só nasce quando todas as obrigatórias estiverem disponíveis e
      concluídas.
- [ ] Rota direta, progresso, comentários, vídeo e materiais aplicam a mesma decisão.
- [ ] Admin preview ignora tempo sem gravar Progresso.
- [ ] Support diagnostica; somente Admin concede Acesso integral.
- [ ] Override exige motivo, é idempotente, auditado e não reversível no episódio.
- [ ] Nenhum cron, coorte, data absoluta, regra por Aula ou coleta antifraude adicional.
- [ ] `bun run verify` passa integralmente.

## 6. Condições STOP

Interromper e reportar, sem improvisar, se:

- uma migration gerada tentar remover/recriar tabela existente;
- o banco alvo de teste não for descartável;
- não for possível distinguir renovação contínua de recompra após interrupção;
- algum fluxo cria Matrícula fora de `rebuildEnrollmentProjection`;
- um consumidor de mídia entrega URL antes da decisão central;
- o JMVStream exigir mudança contratual para impedir reprodução já iniciada;
- Produto pedir aumento retroativo de atraso;
- aparecer necessidade de dois cronogramas simultâneos para o mesmo Curso;
- a oferta externa não puder comunicar o cronograma antes da compra;
- a validação de duração comercial depender do calendário de forma não determinística;
- qualquer teste precisar de segredo ou provider real;
- a implementação exigir editar migration histórica.

## 7. Ordem recomendada de revisão

1. schema e migration;
2. regra pura de tempo;
3. transições da Matrícula;
4. guarda monotônica de publicação;
5. snapshot do Pedido;
6. ausência de vazamento nos DTOs;
7. enforcement em todas as bordas;
8. permissões Admin/Support;
9. E2E e acessibilidade;
10. documentação e diff final.
