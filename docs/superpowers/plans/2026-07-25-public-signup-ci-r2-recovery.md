# Cadastro Público, Recuperação E2E e Diagnóstico R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastro público seguro sem Matrícula, corrigir a jornada E2E de acesso expirado/revogado e eliminar a causa de imagens R2 que ficam somente no blur.

**Architecture:** O banco cria o perfil `student` por trigger transacional quando Better Auth inserir a Conta; a interface apenas chama o endpoint de autenticação já protegido pelo kill switch. A recuperação E2E usa o erro real do processo Next em uma branch Neon descartável e preserva esse log como artefato. A análise R2 segue o caminho upload privado -> cópia no bucket público -> URL pública -> carregamento de imagem, validando objeto, domínio e resposta HTTP antes de alterar código.

**Tech Stack:** Next.js App Router, React, Better Auth, PostgreSQL/Drizzle, Neon branches, Cloudflare R2, Playwright, Vitest, GitHub Actions, shadcn/ui.

---

## File map

- Create: `src/app/(auth)/cadastro/page.tsx` — redirecionamento de sessão e composição da página pública.
- Create: `src/app/(auth)/cadastro/sign-up-form.tsx` — formulário client-side e mensagem segura.
- Create: `src/app/(auth)/cadastro/sign-up-result.ts` e teste — contrato mínimo da resposta Better Auth.
- Create: `src/db/migrations/0041_public_signup_student_profiles.sql` — trigger transacional idempotente.
- Modify: `scripts/seed-e2e.ts` e bootstrap Admin — upsert explícito de papel após o trigger.
- Modify: `src/app/(auth)/entrar/sign-in-form.tsx` — link de cadastro.
- Modify: `playwright.config.ts` e `.github/workflows/ci.yml` — log do servidor Next anexado em falhas.
- Modify: `src/features/storage/r2.ts`, `src/features/storage/public-media.ts` e testes correspondentes somente se o diagnóstico provar falha de publicação/URL.
- Modify: `docs/domain/identity-and-authorization.md`, `docs/integrations/r2.md`, `docs/operations/testing-and-ci.md` e `.env.example` quando o contrato resultante mudar.

### Task 1: Reproduzir e localizar a exceção da Biblioteca

**Files:**
- Modify: `playwright.config.ts`
- Test: `tests/e2e/critical-journeys.spec.ts`

- [x] **Step 1: Preparar a captura de saída do Next em CI**

Criar um wrapper Node em `scripts/e2e-next-server.ts` que execute `bun run build && bun run start -- --port 3100`, replique stdout/stderr e grave ambos em `test-results/next-server.log`.

```ts
const output = createWriteStream("test-results/next-server.log", { flags: "a" });
child.stdout.pipe(process.stdout);
child.stdout.pipe(output);
child.stderr.pipe(process.stderr);
child.stderr.pipe(output);
```

- [x] **Step 2: Usar o wrapper somente para o web server E2E**

Em `playwright.config.ts`, trocar o comando de CI por:

```ts
const serverCommand = process.env.CI
  ? `${bunCommand} scripts/e2e-next-server.ts`
  : `${bunCommand} run dev -- --port 3100`;
```

- [x] **Step 3: Anexar o log ao artefato do workflow**

Adicionar `test-results/next-server.log` ao `path` do passo `Upload Playwright report`.

- [x] **Step 4: Rodar a jornada isolada contra branch Neon descartável**

Executar a mesma preparação da CI, depois:

```powershell
$env:E2E_DATABASE_URL = '<url pooled da branch descartável>'
$env:DATABASE_URL = $env:E2E_DATABASE_URL
$env:CI = 'true'
bunx playwright test tests/e2e/critical-journeys.spec.ts --grep "expired and revoked access"
```

Resultado: a jornada passou contra uma branch Neon descartável em build de produção; a falha do run
histórico não foi reproduzida, portanto nenhuma correção especulativa foi aplicada.

- [x] **Step 5: Corrigir somente a fonte identificada**

Aplicar uma alteração mínima no carregador da Biblioteca, layout da Aluna ou fixture que a stack apontar. Não capturar exceções para simular “Acesso expirado”. O resultado deve continuar usar `getStudentCatalogAccessPresentation` e `CoursePurchaseForm`.

- [x] **Step 6: Confirmar a regressão**

Executar o mesmo comando. Esperado: ambos os estados exibem a ação correta sem a boundary.

### Task 2: Criar perfil de Aluna atomicamente

**Files:**
- Create: `src/db/migrations/0041_public_signup_student_profiles.sql`
- Modify: `scripts/seed-e2e.ts`
- Modify: `src/app/api/auth/dev/bootstrap-admin/route.ts`
- Test: `src/db/migrations/0040_create_student_profile_on_user_insert.test.ts` ou integração PostgreSQL existente

- [x] **Step 1: Escrever o teste de migração que falha**

No banco de teste, inserir uma nova `users` e afirmar que há um `profiles` com `role = 'student'`; inserir em seguida um upsert para `admin` e afirmar que o papel passa a ser `admin`.

```ts
expect(profileRows).toEqual([{ role: "student" }]);
expect(elevatedRows).toEqual([{ role: "admin" }]);
```

- [x] **Step 2: Executar o teste antes da migration**

```powershell
bun x vitest run src/db/migrations/0040_create_student_profile_on_user_insert.test.ts
```

Esperado: falha porque a nova Conta não recebe perfil.

- [x] **Step 3: Criar a migration idempotente**

Criar uma função `public.create_student_profile_for_user()` e trigger `AFTER INSERT ON public.users`:

```sql
insert into public.profiles (user_id, role)
values (new.id, 'student')
on conflict (user_id) do nothing;
```

Os objetos anteriores são removidos com `drop trigger if exists` e `drop function if exists` para suportar reaplicação em banco descartável.

- [x] **Step 4: Adaptar elevação interna de papel**

Substituir inserções simples de perfil em `seed-e2e.ts` e bootstrap por:

```sql
insert into profiles (user_id, role)
values ($1, $2::role)
on conflict (user_id) do update set role = excluded.role, updated_at = now()
```

Isso evita colisão com o trigger e mantém a única elevação explícita do Admin.

- [x] **Step 5: Rodar teste e migrações**

```powershell
bun x vitest run src/db/migrations/0040_create_student_profile_on_user_insert.test.ts
bun run db:migrations:check
```

Esperado: ambos passam.

### Task 3: Expor cadastro público imediato

**Files:**
- Create: `src/app/(auth)/cadastro/page.tsx`
- Create: `src/app/(auth)/cadastro/sign-up-form.tsx`
- Create: `src/app/(auth)/cadastro/sign-up-result.ts`
- Create: `src/app/(auth)/cadastro/sign-up-result.test.ts`
- Modify: `src/app/(auth)/entrar/sign-in-form.tsx`
- Test: `tests/e2e/critical-journeys.spec.ts`

- [x] **Step 1: Escrever o teste unitário de contrato de resposta**

```ts
it("accepts a Better Auth sign-up response with a user", () => {
  expect(isSuccessfulSignUpPayload({ user: { id: "user-1" } })).toBe(true);
});

it("rejects malformed sign-up responses", () => {
  expect(isSuccessfulSignUpPayload({ error: "invalid" })).toBe(false);
});
```

- [x] **Step 2: Executar o teste para confirmar RED**

```powershell
bun x vitest run src/app/(auth)/cadastro/sign-up-result.test.ts
```

Esperado: falha pela ausência do módulo.

- [x] **Step 3: Implementar o formulário mínimo**

O formulário valida senha igual, faz `POST /api/auth/sign-up/email` com `name`, `email`, `password`, trata toda falha como “Não foi possível concluir seu cadastro. Revise os dados e tente novamente.” e chama `/api/auth/redirect` antes de `window.location.assign`.

```ts
if (password !== confirmPassword) {
  setError("As senhas não coincidem.");
  return;
}
```

- [x] **Step 4: Criar a página server-side e link de entrada**

Seguir o mesmo padrão de `/entrar`: `await connection()`, `getCurrentSession()`, redirecionar sessões existentes e renderizar `AuthShell` + `Card`. Em `SignInForm`, adicionar o link `Criar conta` para `/cadastro`.

- [x] **Step 5: Executar o teste unitário GREEN**

```powershell
bun x vitest run src/app/(auth)/cadastro/sign-up-result.test.ts src/lib/auth-policy.test.ts
```

Esperado: passa.

- [x] **Step 6: Acrescentar a jornada E2E pública**

Adicionar teste que visita `/cadastro`, preenche dados exclusivos, submete, confirma URL `/app`, vê “Biblioteca de cursos” e não vê botão de curso liberado. Rodar:

```powershell
bunx playwright test tests/e2e/critical-journeys.spec.ts --grep "public sign-up"
```

Esperado: passa com `AUTH_PUBLIC_SIGNUP_ENABLED=true` no ambiente da jornada.

### Task 4: Diagnosticar e corrigir imagens públicas R2

**Files:**
- Modify only after evidence: `src/features/storage/r2.ts`, `src/features/storage/public-media.ts`, `src/features/banners/banner-image.tsx`, `src/features/courses/course-cover-image.tsx`
- Test: `src/features/storage/public-media.test.ts`, `src/features/storage/r2.test.ts`, E2E de banner/capa quando aplicável
- Modify: `docs/integrations/r2.md`

- [x] **Step 1: Inspecionar configuração sem revelar segredos**

No Coolify, conferir apenas presença e host de `R2_PUBLIC_BASE_URL`, e os nomes de `R2_BUCKET_NAME`/`R2_PUBLIC_BUCKET_NAME`. Confirmar que a base pública aponta ao domínio associado ao bucket público, não ao endpoint S3 nem ao bucket privado.

- [x] **Step 2: Correlacionar um banner real**

Consultar `dashboard_banners.image_url`, verificar com `HeadObject` o objeto no bucket privado e no bucket público, e fazer `HEAD` à URL construída. Registrar somente status HTTP, `Content-Type`, `Content-Length` e prefixo da chave.

- [x] **Step 3: Isolar a camada com falha**

Interpretar os resultados:

```text
privado 200 + público 404 => CopyObject/publicação falhou
público 200 + URL 404/403 => R2_PUBLIC_BASE_URL/domínio público incorreto
URL 200 + imagem invisível => componente, CSP ou Content-Type incorreto
```

- [x] **Step 4: Escrever o teste que reproduz a causa comprovada**

Se a URL estiver errada, testar `buildPublicMediaUrl`. Se a cópia estiver errada, testar que `CopyObjectCommand.input.CopySource` preserva separadores de chave, por exemplo:

```ts
expect(command.input.CopySource).toBe("/private-bucket/banners/example.webp");
```

- [x] **Step 5: Aplicar a correção mínima e testar**

Não alterar CSP, `unoptimized` ou placeholders sem evidência. Executar o teste focado e a jornada que salva/publica banner ou capa.

- [x] **Step 6: Documentar a configuração operacional confirmada**

Atualizar `docs/integrations/r2.md` com os dois buckets, domínio público esperado, teste HTTP seguro e o procedimento de recuperação de objeto órfão.

### Task 5: Verificação integrada e operação

**Files:**
- Modify: `docs/domain/identity-and-authorization.md`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `.env.example`

- [x] **Step 1: Atualizar contratos e variável**

Documentar cadastro público com `AUTH_PUBLIC_SIGNUP_ENABLED=true`, perfil transacional `student`, ausência de Matrícula e log Next como artefato privado de falha.

- [x] **Step 2: Rodar gates locais**

```powershell
bun run docs:check
bun run db:migrations:check
bun run typecheck
bun x ultracite check
bun run test
bun run build
```

Esperado: todos passam.

- [x] **Step 3: Rodar integração e E2E na branch Neon descartável**

```powershell
bun run test:certificates:integration
bun run test:e2e
```

Esperado: fluxo de cadastro, expirado, revogado, banner/capa aplicável e jornadas existentes passam.

- [ ] **Step 4: Configurar Coolify antes do deploy**

Adicionar `AUTH_PUBLIC_SIGNUP_ENABLED=true` no ambiente de produção do app e fazer redeploy somente depois de a imagem SHA aprovada pelo CI existir. Não registrar valores sensíveis no repositório.

## Plan self-review

- Cobertura: cadastro imediato, perfil `student`, nenhuma Matrícula, falha E2E, observabilidade de CI e investigação R2 estão mapeados a tarefas.
- Sem placeholders: cada alteração tem arquivo, comportamento e comando de verificação.
- Consistência: a trigger cria somente `student`; a elevação administrativa usa upsert; a UI não recebe papel nem Curso.
