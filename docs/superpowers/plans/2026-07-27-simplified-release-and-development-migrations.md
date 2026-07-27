# Simplified Release and Development Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar verificação, migration de Development e deploy Production simples para uma pessoa desenvolvedora júnior sem reduzir isolamento ou segurança.

**Architecture:** Um orquestrador TypeScript expõe os perfis locais `quick` e `full`. Uma guarda pura valida o hostname antes do novo migrador Development. GitHub Actions deriva sempre o SHA da `main`, prova CI verde e separa migration Development da promoção Production.

**Tech Stack:** Bun 1.3, TypeScript, Vitest, Drizzle ORM, PostgreSQL/Neon e GitHub Actions.

---

### Task 1: Orquestrador de verificação local

**Files:**
- Create: `src/tooling/verification-profiles.ts`
- Create: `src/tooling/verification-profiles.test.ts`
- Create: `scripts/verify.ts`
- Modify: `biome.jsonc`
- Modify: `package.json`

- [x] **Step 1: Escrever o teste vermelho para ordem e fail-fast**

O teste importa `runVerificationProfile`, injeta um executor que registra os
gates e prova os perfis:

```ts
expect(runVerificationProfile("quick", executor)).toBe(0);
expect(executed).toEqual([
  "db:migrations:check",
  "typecheck",
  "check",
  "test",
]);
```

Um segundo executor devolve `1` em `typecheck` e prova que `check` e `test` não
são executados.

- [x] **Step 2: Confirmar o teste vermelho**

Run:

```powershell
bun run test -- src/tooling/verification-profiles.test.ts
```

Expected: falha porque `verification-profiles.ts` ainda não existe.

- [x] **Step 3: Implementar os perfis e o CLI**

`runVerificationProfile(profile, executor)` executa uma lista imutável de nomes
de scripts, para no primeiro status não zero e devolve o status. `verify.ts`
usa `spawnSync("bun", ["run", gate], { stdio: "inherit" })`.

Adicionar:

```json
"verify:quick": "bun scripts/verify.ts quick",
"verify": "bun scripts/verify.ts full"
```

- [x] **Step 4: Confirmar o teste verde e executar o perfil rápido**

Run:

```powershell
bun run test -- src/tooling/verification-profiles.test.ts
bun run verify:quick
```

Expected: testes e gates verdes.

### Task 2: Guarda e migrador de Development

**Files:**
- Create: `src/db/migration-target.ts`
- Create: `src/db/migration-target.test.ts`
- Create: `scripts/migrate-development.ts`
- Modify: `package.json`

- [x] **Step 1: Escrever testes vermelhos da guarda**

Os testes cobrem:

```ts
expect(
  getMigrationTargetProblems(
    {
      DATABASE_URL_DIRECT:
        "postgresql://user:secret@ep-silent-leaf-aclmy5uk-pooler.us-east-2.aws.neon.tech/neondb",
      DEVELOPMENT_DATABASE_HOST:
        "ep-silent-leaf-aclmy5uk.us-east-2.aws.neon.tech",
    },
    "development"
  )
).toEqual([]);
```

Também cobrem URL ausente, URL inválida e compute divergente.

- [x] **Step 2: Confirmar o teste vermelho**

Run:

```powershell
bun run test -- src/db/migration-target.test.ts
```

Expected: falha porque `migration-target.ts` ainda não existe.

- [x] **Step 3: Implementar a guarda e o migrador**

A guarda normaliza apenas o marcador `-pooler.` e compara o hostname completo.
`migrate-development.ts` carrega env, falha antes de abrir conexão quando a
guarda encontra problemas e então reutiliza `runMigrationWithLock` para aplicar
`src/db/migrations`.

Adicionar:

```json
"db:migrate:development": "bun scripts/migrate-development.ts"
```

- [x] **Step 4: Confirmar o teste verde**

Run:

```powershell
bun run test -- src/db/migration-target.test.ts src/db/migration-lock.test.ts
```

Expected: todos os testes passam sem acessar banco remoto.

### Task 3: Contratos dos workflows

**Files:**
- Create: `src/tooling/release-workflows.test.ts`
- Modify: `.github/workflows/deploy-vercel.yml`
- Create: `.github/workflows/migrate-development.yml`

- [x] **Step 1: Escrever teste estrutural vermelho**

O teste lê os YAMLs como texto e prova:

- Production não contém `release_sha`;
- Production faz checkout explícito de `main`;
- Production deriva SHA com `git rev-parse HEAD`;
- Development usa Environment `neon-development`;
- Development exige confirmação, `DEVELOPMENT_DATABASE_HOST` e
  `DATABASE_URL_DIRECT`;
- Development executa `db:migrate:development` e auditoria;
- ambos usam `cancel-in-progress: false`.

- [x] **Step 2: Confirmar o teste vermelho**

Run:

```powershell
bun run test -- src/tooling/release-workflows.test.ts
```

Expected: falha porque o workflow Development não existe e Production ainda
solicita `release_sha`.

- [x] **Step 3: Simplificar Production**

Manter somente `confirm_production`. Fazer checkout com `ref: main`, resolver
`RELEASE_SHA="$(git rev-parse HEAD)"`, comparar com `origin/main` e consultar a
API GitHub por CI verde. Passar o SHA resolvido como metadata do deployment.

- [x] **Step 4: Criar migration Development**

Criar workflow manual com:

```yaml
concurrency:
  group: neon-development-migrations
  cancel-in-progress: false
```

O job usa `environment: neon-development`, prova confirmação e CI verde da
`main`, valida configuração, executa `bun run db:migrate:development` e depois
`bun run db:migrations:inspect -- --environment=neon-development`.

- [x] **Step 5: Confirmar o teste verde**

Run:

```powershell
bun run test -- src/tooling/release-workflows.test.ts
```

Expected: todos os contratos estruturais passam.

### Task 4: Documentação operacional

**Files:**
- Modify: `docs/operations/shared-development-and-release-guide.md`
- Modify: `docs/operations/database-and-migrations.md`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `docs/operations/deploy-and-incidents.md`

- [x] **Step 1: Atualizar verificação local**

Documentar `bun run verify:quick` durante o trabalho e `bun run verify` antes do
PR, preservando a lista de gates executados.

- [x] **Step 2: Atualizar migrations por ambiente**

Registrar que gerar/commitar não aplica migration; cada branch Neon mantém
journal próprio. Documentar o workflow `Migrate Neon development` e os
requisitos do Environment.

- [x] **Step 3: Atualizar Preview**

Registrar que o Preview persistente não recebe migration de PR e que CI
PostgreSQL/E2E é a prova isolada para mudanças de schema.

- [x] **Step 4: Atualizar deploy Production**

Remover instruções de copiar SHA. O procedimento passa a ser selecionar
`main`, marcar confirmação e executar uma vez.

- [x] **Step 5: Verificar documentação**

Run:

```powershell
bun run docs:check
```

Expected: documentação válida.

### Task 5: Verificação e auditoria final

**Files:**
- Review: todos os arquivos anteriores

- [x] **Step 1: Rodar testes focados**

```powershell
bun run test -- src/tooling/verification-profiles.test.ts src/db/migration-target.test.ts src/tooling/release-workflows.test.ts src/db/migration-lock.test.ts
```

- [x] **Step 2: Rodar formatter e gates completos**

```powershell
bun x ultracite fix
bun run verify
```

- [x] **Step 3: Auditar o diff**

```powershell
git status --short
git diff --check
git diff
```

Confirmar cobertura de cada requisito da especificação e registrar como risco
externo somente a configuração do GitHub Environment `neon-development`, que
não pertence ao código versionado.

> Commits e push não fazem parte deste plano até autorização explícita do
> usuário.
