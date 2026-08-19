# Seven Sprint Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sete fatias reversíveis para corrigir riscos comprovados de release, CI/Neon, acesso, escala administrativa, identidade, operação e autenticação privilegiada.

**Architecture:** Manter o domínio atual e reforçar seams existentes. Cada fatia começa por um teste de contrato ou comportamento, altera somente a superfície necessária e atualiza a documentação canônica relacionada. CI usa um projeto Neon explicitamente dedicado; acesso de conteúdo separa policy de sessão, preview e validação pública; Admin usa projeções paginadas; MFA fica atrás de recovery definido.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL/Neon, Drizzle, Vitest, Playwright, GitHub Actions, Bun e Ultracite.

---

### Task 1: Estado verificável de release e documentação

**Files:**
- Create: `src/tooling/release-state.ts`
- Create: `src/tooling/release-state.test.ts`
- Modify: `scripts/check-docs.ts`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/operations/testing-and-ci.md`

- [ ] **Step 1: Write the failing state contract test**

  Teste o parser/projeção com commit, ambiente, migration e status separados; rejeite estado sem commit ou com migration desconhecida.

- [ ] **Step 2: Run the focused test and confirm RED**

  Run: `bun run test -- src/tooling/release-state.test.ts`

  Expected: FAIL porque `release-state.ts` ainda não existe.

- [ ] **Step 3: Implement the pure release-state parser**

  Exporte tipos literais `deployed`, `verified` e `documented`, valide SHA não vazio e mantenha a função sem acesso a rede.

- [ ] **Step 4: Integrate only documentation checks**

  Faça `check-docs` validar que `last_verified_commit` existe e que o documento não declara deployment sem ambiente/commit explícitos. Não faça workflow alterar documentos automaticamente.

- [ ] **Step 5: Run focused and documentation gates**

  Run: `bun run test -- src/tooling/release-state.test.ts && bun run docs:check`

- [ ] **Step 6: Update release runbooks**

  Remova referências a branches Neon inexistentes e registre claramente o estado atual de `staging`, `main` e migrations.

### Task 2: Isolamento Neon para CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/cleanup-ci-neon-branches.yml`
- Modify: `src/tooling/neon-ci-branch-cleanup.ts`
- Modify: `src/tooling/neon-ci-branch-cleanup.test.ts`
- Modify: `src/tooling/release-workflows.test.ts`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `research/2026-08-19-neon-ci-branch-cleanup-practices.md`

- [ ] **Step 1: Add RED workflow contracts**

  Exija `NEON_CI_PROJECT_ID` e `NEON_CI_PARENT_BRANCH_ID`; rejeite configuração que aponta o parent para Production ou usa o projeto persistente conhecido.

- [ ] **Step 2: Run the workflow contract tests and confirm RED**

  Run: `bun run test -- src/tooling/release-workflows.test.ts src/tooling/neon-ci-branch-cleanup.test.ts`

- [ ] **Step 3: Switch CI jobs to the explicit CI project**

  Use somente `NEON_CI_PROJECT_ID` nas jobs de integração e E2E; falhe fechado quando a variável não existir. Não inclua URLs em logs.

- [ ] **Step 4: Make janitor list all pages safely**

  Consume `pagination`/cursor da API Neon antes de selecionar branches; preserve allowlist, proteção, confirmação e limite máximo.

- [ ] **Step 5: Verify contracts and docs**

  Run: `bun run test -- src/tooling/release-workflows.test.ts src/tooling/neon-ci-branch-cleanup.test.ts && bun run docs:check`

### Task 3: Policy canônica de acesso

**Files:**
- Modify: `src/features/enrollments/access.ts`
- Modify: `src/features/enrollments/access.test.ts`
- Modify: `src/app/api/enrollments/access/route.ts`
- Create/modify: `src/features/enrollments/access-policy.test.ts`
- Modify: `docs/domain/identity-and-authorization.md`
- Modify: `docs/domain/learning-content-and-progress.md`

- [ ] **Step 1: Add failing tests for blocked platform and publication**

  Prove que aluno bloqueado não recebe acesso, que curso sem publicação publicada falha e que validação pública de certificado não usa essa policy.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- src/features/enrollments/access.test.ts src/features/enrollments/access-policy.test.ts`

- [ ] **Step 3: Add the canonical access decision**

  Centralize the SQL/decision used by course and lesson access, preserve preview/admin callers explicitly, and keep public certificate validation outside it.

- [ ] **Step 4: Apply the decision to the API route**

  Return `403` for a blocked student before querying course access; preserve `401` and role checks.

- [ ] **Step 5: Run focused regressions**

  Run: `bun run test -- src/features/enrollments/access.test.ts src/features/courses/server.test.ts`

### Task 4: Paginação administrativa

**Files:**
- Modify: `src/features/admin/server.ts`
- Modify: `src/features/admin/server-read-projections.test.ts`
- Modify: `src/features/admin/students.test.ts`
- Modify: `src/app/(admin)/admin/alunos/page.tsx`
- Modify: `src/app/(admin)/admin/cursos/page.tsx`
- Add migrations only if `EXPLAIN` proves an index is needed.

- [ ] **Step 1: Add RED projection contracts**

  Assert default page size, stable cursor, server-side search and that the student projection never issues an unbounded profile query.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- src/features/admin/server-read-projections.test.ts src/features/admin/students.test.ts`

- [ ] **Step 3: Implement bounded reads**

  Add typed query inputs with `limit`, `cursor` and normalized search; use keyset ordering by `(name, user_id)` or `(updated_at, id)` and return `nextCursor`.

- [ ] **Step 4: Adapt pages without changing Sheet semantics**

  Preserve filters and selected-student state; add explicit next-page controls and empty/error states.

- [ ] **Step 5: Verify SQL and UI contracts**

  Run focal tests, `bun run typecheck`, and `bun run check`. Capture `EXPLAIN` only against a disposable database.

### Task 5: E-mail identity equivalence

**Files:**
- Modify: `src/features/payments/buyer-identity.ts`
- Modify: `src/features/payments/buyer-identity.test.ts`
- Modify: `src/features/payments/order-identity.ts`
- Create: `src/features/payments/identity-collision-audit.ts`
- Create: `src/features/payments/identity-collision-audit.test.ts`
- Modify: `docs/domain/identity-and-authorization.md`

- [ ] **Step 1: Add RED collision-audit tests**

  Prove that original addresses are preserved, canonicalization is provider-scoped, and collisions are reported rather than silently merged.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- src/features/payments/buyer-identity.test.ts src/features/payments/identity-collision-audit.test.ts`

- [ ] **Step 3: Implement the read-only audit**

  Return bounded collision groups with canonical key and original addresses; do not mutate users or orders.

- [ ] **Step 4: Document policy and operator action**

  Record provider assumptions, legacy conflict handling and the command’s read-only nature.

- [ ] **Step 5: Verify**

  Run focal tests, `bun run docs:check`, `bun run typecheck` and `bun run check`.

### Task 6: Observability and recovery evidence

**Files:**
- Modify: `src/tooling/verification-profiles.ts`
- Modify: `src/tooling/verification-profiles.test.ts`
- Create: `scripts/observability-recovery-drill.ts`
- Create: `scripts/observability-recovery-drill.test.ts`
- Modify: `docs/operations/observability-and-recovery.md`
- Modify: `docs/operations/testing-and-ci.md`

- [ ] **Step 1: Add RED checks for evidence metadata**

  Require owner, environment, UTC start/end, migration journal and result for a recovery drill; reject credentials, URLs and PII in serialized evidence.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- src/tooling/verification-profiles.test.ts scripts/observability-recovery-drill.test.ts`

- [ ] **Step 3: Implement a dry-run/read-only evidence collector**

  Collect readiness, migration state and configured alert destinations without mutating production; destructive restore remains an explicitly invoked CI/operations procedure.

- [ ] **Step 4: Document quarterly drill and alert ownership**

  Keep current SLO baseline-before-ratification rule and add a machine-readable evidence format.

- [ ] **Step 5: Verify docs and safety**

  Run focal tests, `bun run docs:check`, `bun run typecheck`, `bun run check` and `git diff --check`.

### Task 7: MFA decision and enforcement seam

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth-policy.ts`
- Create: `src/lib/admin-assurance.ts`
- Create: `src/lib/admin-assurance.test.ts`
- Modify: `src/app/(admin)/admin/layout.tsx`
- Modify: `docs/domain/identity-and-authorization.md`
- Modify: `docs/operations/observability-and-recovery.md`

- [ ] **Step 1: Define recovery contract before provider integration**

  Test that Admin/Suporte assurance is `pending`, `verified` or `recovery_required`; student and public certificate flows remain unchanged.

- [ ] **Step 2: Run RED**

  Run: `bun run test -- src/lib/admin-assurance.test.ts`

- [ ] **Step 3: Add server-side assurance seam**

  Require verified assurance only for privileged mutations; do not pretend MFA is active until the Better Auth provider/plugin and recovery flow are configured.

- [ ] **Step 4: Document rollout and lockout recovery**

  Include backup codes, support recovery, audit trail and rollback criteria.

- [ ] **Step 5: Verify**

  Run focal tests, full `bun run verify:quick`, and provider-specific CI tests only after credentials/configuration exist.
