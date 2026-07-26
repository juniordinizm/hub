# Vercel-first Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar, verificar e documentar o Hub para deployment primário na Vercel Pro.

**Architecture:** A aplicação usa Next.js nativo na Vercel, Neon pooled em São Paulo e uploads diretos ao R2. Jobs usam estado persistente e deadlines, enquanto a CI separa build, migration, deployment candidato e promoção.

**Tech Stack:** Next.js 16, React 19, TypeScript, Bun, PostgreSQL/Neon, Cloudflare R2, GitHub Actions e Vercel Pro.

---

### Task 1: Autoridade documental e contrato de runtime

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/operations/deploy-and-incidents.md`
- Modify: `docs/operations/database-and-migrations.md`
- Create: `docs/operations/vercel-migration-status.md`
- Test: `src/vercel-config.test.ts`
- Test: `src/db/pool-policy.test.ts`

- [x] Escrever testes que exijam região `gru1`, configuração Vercel-first e pool reduzido no runtime Vercel.
- [x] Executar os testes e confirmar falha pelo contrato ausente.
- [x] Implementar configuração e política mínimas.
- [x] Atualizar o status do pacote e documentação canônica.
- [x] Executar testes focados e `bun run docs:check`.

### Task 2: Upload direto de imagens administrativas

**Files:**
- Modify: `src/features/storage/r2.ts`
- Create: `src/features/storage/staged-image-upload.ts`
- Create: `src/app/api/admin/uploads/images/prepare/route.ts`
- Create: `src/app/api/admin/uploads/images/confirm/route.ts`
- Modify: `src/features/admin/actions.ts`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`
- Modify: `src/app/(admin)/admin/configuracoes/banners/banner-edit-modal.tsx`
- Modify: `src/app/(admin)/admin/cursos/page.tsx`
- Test: `src/features/storage/r2-conditional.test.ts`
- Test: `src/features/certificates/template-image-contract.test.ts`
- Test: `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.test.tsx`

- [x] Escrever um teste de preparação que rejeite tipo, tamanho, ator ou finalidade inválidos.
- [x] Implementar URL assinada para chave privada temporária e ownership verificável.
- [x] Escrever um teste de confirmação que valide HEAD e metadados.
- [x] Implementar confirmação e consumo único da chave temporária.
- [x] Migrar Certificado, banner e capa em fatias verticais, removendo `File` dos Server Actions.
- [x] Implementar reconciliação de temporários expirados.
- [x] Atualizar contratos R2/Certificado e status do pacote.

### Task 3: Concorrência e crons serverless

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0042_serverless_job_leases.sql`
- Modify: `src/db/migrations/meta/_journal.json`
- Create: `src/db/migrations/meta/0042_snapshot.json`
- Create: `src/features/operations/job-lease.ts`
- Modify: `src/features/jmvstream/server.ts`
- Modify: `src/features/certificates/templates.ts`
- Modify: `src/features/outbox/runner.ts`
- Modify: `src/app/api/cron/*/route.ts`
- Test: lease, cron, outbox, migration and integration tests

- [x] Escrever teste de lease com aquisição, conflito, expiração e fencing.
- [x] Gerar tabela/migration de leases pelo Drizzle.
- [x] Substituir lock de sessão do JMVStream.
- [x] Substituir lock de sessão da limpeza de assets por reconciliação durável.
- [x] Escrever teste de autenticação, kill switch e deadline dos crons.
- [x] Implementar entrada comum e `maxDuration`.
- [x] Tornar outbox deadline-aware.
- [x] Atualizar runbooks e status do pacote.

### Task 4: CI/CD e ambientes Vercel

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.env.example`
- Modify: `src/lib/production-environment.ts`
- Modify: deployment contract tests
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/deploy-and-incidents.md`

- [x] Escrever teste que exija Vercel CLI fixada, build remoto e gates anteriores.
- [x] Implementar job de candidato sem expor secrets de runtime.
- [x] Implementar job manual de migration/smoke/promoção com SHA verde
  comprovado e Environment isolado.
- [x] Documentar matriz Production/Preview/Development e secrets manuais.
- [x] Atualizar status do pacote.

### Task 5: Verificação integral

**Files:**
- Modify: documentation status and any defect discovered by gates

- [x] Rodar `bun x ultracite fix` e revisar o diff.
- [x] Rodar `bun run docs:check`.
- [x] Rodar `bun run db:migrations:check`.
- [x] Rodar `bun run test`.
- [ ] Rodar `bun run test:certificates:integration` em banco descartável.
- [x] Rodar `bun run typecheck`.
- [x] Rodar `bun run check`.
- [x] Rodar `bun run build`.
- [x] Rodar `bun run knip`.
- [ ] Rodar E2E e build remoto Vercel.
- [ ] Auditar cada critério da spec e registrar riscos externos restantes.

### Task 6: Domínio canônico, Preview dinâmico e identidade de e-mail

**Files:**
- Create: `src/lib/application-origin.ts`
- Create: `src/lib/application-origin.test.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`
- Modify: `src/lib/public-app-config.ts`
- Modify: `src/lib/public-app-config.test.ts`
- Modify: `.env.example`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/vercel-first-launch-checklist.md`
- Modify: `docs/operations/vercel-migration-status.md`

- [x] Escrever testes que exijam origem explícita em Production e derivação de
  `https://${VERCEL_URL}` somente no ambiente Preview da Vercel.
- [x] Executar os testes focados e confirmar falha pela derivação ainda ausente.
- [x] Implementar uma resolução compartilhada das três URLs canônicas, sem
  permitir fallback `*.vercel.app` em Production.
- [x] Executar os testes focados e confirmar que metadata, Better Auth,
  certificados e links transacionais recebem a mesma origem.
- [x] Documentar `app.neurocapacitar.com.br`, o remetente
  `notificacoes@neurocapacitar.com.br`, a caixa real de suporte e os registros
  manuais de Hostinger/Resend.
- [x] Associar o subdomínio ao projeto Vercel depois da verificação TXT manual.
- [x] Cadastrar as variáveis Production que não dependem da validação do
  Resend.
- [x] Rodar `bun run docs:check`, testes focados, suíte integral, typecheck,
  Ultracite, Knip e build.

> Nota de evolução: esta tarefa registrou o primeiro contrato de origem
> dinâmica. A auditoria posterior confirmou Standard Deployment Protection e
> tornou `VERCEL_BRANCH_URL` obrigatório. A Task 7 substitui o contrato
> `VERCEL_URL`-first sem reabrir as entregas de domínio e e-mail.

### Task 7: Contrato fail-closed do Preview limitado

**Files:**
- Create: `src/lib/preview-environment.ts`
- Create: `src/lib/preview-environment.test.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`

- [x] **Step 1: escrever o teste do conjunto mínimo permitido**

Criar `src/lib/preview-environment.test.ts` com um fixture que contenha somente:

```ts
const COMPLETE_PREVIEW_ENVIRONMENT: Record<string, string> = {
  AUTH_PUBLIC_SIGNUP_ENABLED: "false",
  BETTER_AUTH_SECRET: "preview-auth-secret-at-least-thirty-two-characters",
  CLIENT_IP_SOURCE: "x-forwarded-for",
  DATABASE_URL: "postgresql://preview.example/db",
  HEALTHCHECK_SECRET: "preview-health-secret-at-least-thirty-two-characters",
  SCHEDULED_JOBS_ENABLED: "false",
  VERCEL_BRANCH_URL: "hub-git-feature-neuro-capacitar.vercel.app",
  VERCEL_ENV: "preview",
};
```

O primeiro teste deve exigir:

```ts
expect(
  getPreviewEnvironmentProblems(COMPLETE_PREVIEW_ENVIRONMENT)
).toEqual([]);
```

- [x] **Step 2: escrever os testes de recusa**

No mesmo arquivo, testar individualmente:

```ts
expect(
  getPreviewEnvironmentProblems({
    ...COMPLETE_PREVIEW_ENVIRONMENT,
    RESEND_API_KEY: "must-not-be-here",
  })
).toContain("RESEND_API_KEY must not be set in Preview");

expect(
  getPreviewEnvironmentProblems({
    ...COMPLETE_PREVIEW_ENVIRONMENT,
    SCHEDULED_JOBS_ENABLED: "true",
  })
).toContain("SCHEDULED_JOBS_ENABLED must equal false in Preview");

expect(
  getPreviewEnvironmentProblems({
    ...COMPLETE_PREVIEW_ENVIRONMENT,
    VERCEL_BRANCH_URL: "",
    VERCEL_URL: "protected-deployment.vercel.app",
  })
).toContain("VERCEL_BRANCH_URL is required in Preview");
```

Adicionar casos equivalentes para URL direta, bootstrap, variáveis E2E,
cadastro público, URLs canônicas explícitas e cada família de provider:
AbacatePay, JMVStream, R2, Resend e Sentry. As mensagens devem conter somente o
nome da variável, nunca o valor.

- [x] **Step 3: executar o teste e confirmar a falha inicial**

Run:

```bash
bun test src/lib/preview-environment.test.ts
```

Expected: FAIL porque `getPreviewEnvironmentProblems` ainda não existe.

- [x] **Step 4: implementar a autoridade do Preview**

Criar `src/lib/preview-environment.ts` com:

```ts
const REQUIRED_PREVIEW_VARIABLES = [
  "BETTER_AUTH_SECRET",
  "CLIENT_IP_SOURCE",
  "DATABASE_URL",
  "HEALTHCHECK_SECRET",
  "SCHEDULED_JOBS_ENABLED",
  "VERCEL_BRANCH_URL",
] as const;

const FORBIDDEN_PREVIEW_VARIABLES = [
  "ABACATEPAY_API_KEY",
  "ABACATEPAY_WEBHOOK_SECRET",
  "ABACATE_PAY_API_KEY",
  "BETTER_AUTH_URL",
  "CERTIFICATE_CONCURRENCY_DATABASE_URL",
  "CERTIFICATE_PUBLIC_BASE_URL",
  "CRON_SECRET",
  "DATABASE_URL_DIRECT",
  "E2E_DATABASE_URL",
  "E2E_R2_BUCKET_NAME",
  "E2E_TEST_MODE",
  "INTERNAL_BOOTSTRAP_SECRET",
  "JMVSTREAM_API_TOKEN",
  "JMVSTREAM_AUTH_RESOURCE",
  "JMVSTREAM_PLAN_ID",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SENTRY_DSN",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
  "R2_PUBLIC_BUCKET_NAME",
  "R2_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_DSN",
  "SMOKE_DATABASE_URL",
  "SUPPORT_EMAIL",
] as const;

const MINIMUM_SECRET_LENGTH = 32;

const hasValue = (
  environment: Readonly<Record<string, string | undefined>>,
  key: string
): boolean => Boolean(environment[key]?.trim());

export const getPreviewEnvironmentProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] => {
  const problems = REQUIRED_PREVIEW_VARIABLES.filter(
    (key) => !hasValue(environment, key)
  );

  for (const key of FORBIDDEN_PREVIEW_VARIABLES) {
    if (hasValue(environment, key)) {
      problems.push(`${key} must not be set in Preview`);
    }
  }

  if (environment.CLIENT_IP_SOURCE?.trim() !== "x-forwarded-for") {
    problems.push("CLIENT_IP_SOURCE must equal x-forwarded-for in Preview");
  }

  if (environment.SCHEDULED_JOBS_ENABLED?.trim() !== "false") {
    problems.push("SCHEDULED_JOBS_ENABLED must equal false in Preview");
  }

  if (environment.AUTH_PUBLIC_SIGNUP_ENABLED?.trim() === "true") {
    problems.push("AUTH_PUBLIC_SIGNUP_ENABLED must not equal true in Preview");
  }

  for (const key of ["BETTER_AUTH_SECRET", "HEALTHCHECK_SECRET"] as const) {
    const length = environment[key]?.trim().length ?? 0;
    if (length > 0 && length < MINIMUM_SECRET_LENGTH) {
      problems.push(`${key} must contain at least 32 characters`);
    }
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const protocol = new URL(databaseUrl).protocol;
      if (protocol !== "postgres:" && protocol !== "postgresql:") {
        problems.push(
          "DATABASE_URL must use the postgres or postgresql protocol"
        );
      }
    } catch {
      problems.push("DATABASE_URL must be a valid URL");
    }
  }

  return [...new Set(problems)];
};
```

- [x] **Step 5: executar os testes do contrato**

Run:

```bash
bun test src/lib/preview-environment.test.ts
```

Expected: PASS.

- [x] **Step 6: integrar o perfil ao parser do servidor**

Em `src/lib/env.ts`, adicionar ao schema e à origem:

```ts
VERCEL_BRANCH_URL: optionalNonEmptyString,
VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
VERCEL_URL: optionalNonEmptyString,
```

Preservar o ambiente bruto antes de resolver URLs:

```ts
const rawEnvironment = {
  ...process.env,
  VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
};
const sourceEnvironment =
  resolveCanonicalApplicationEnvironment(rawEnvironment);
const env = serverEnvSchema.parse(sourceEnvironment);
validateServerEnvironment(env, rawEnvironment);
```

No início da validação Production, depois das proteções E2E, usar:

```ts
if (env.VERCEL_ENV === "preview") {
  const previewProblems = getPreviewEnvironmentProblems(sourceEnvironment);
  if (previewProblems.length > 0) {
    throw new Error(
      `Preview environment is invalid: ${previewProblems.join(", ")}.`
    );
  }
  return;
}
```

`sourceEnvironment` nesse trecho deve ser o ambiente bruto recebido pela função,
não o objeto que já contém URLs derivadas. Assim, URLs canônicas configuradas
manualmente são detectadas e recusadas.

- [x] **Step 7: provar que Preview mínimo passa e Production continua estrita**

Atualizar `src/lib/env.test.ts` para usar o fixture mínimo, sem providers:

```ts
process.env = {
  AUTH_PUBLIC_SIGNUP_ENABLED: "false",
  BETTER_AUTH_SECRET: "preview-auth-secret-at-least-thirty-two-characters",
  CLIENT_IP_SOURCE: "x-forwarded-for",
  DATABASE_URL: "postgresql://preview.example/db",
  HEALTHCHECK_SECRET: "preview-health-secret-at-least-thirty-two-characters",
  NODE_ENV: "production",
  SCHEDULED_JOBS_ENABLED: "false",
  VERCEL: "1",
  VERCEL_BRANCH_URL: "hub-git-feature-neuro-capacitar.vercel.app",
  VERCEL_ENV: "preview",
};
```

Adicionar uma asserção de que `RESEND_API_KEY` em Preview falha e manter todos
os testes de Production completa e E2E loopback.

- [x] **Step 8: executar a fatia de ambiente**

Run:

```bash
bun test src/lib/preview-environment.test.ts src/lib/env.test.ts src/lib/production-environment.test.ts
```

Expected: PASS.

### Task 8: Origem protegida baseada no alias de branch

**Files:**
- Create: `src/lib/application-origin.test.ts`
- Modify: `src/lib/application-origin.ts`
- Modify: `src/lib/public-app-config.ts`
- Modify: `src/lib/public-app-config.test.ts`
- Modify: `src/lib/env.test.ts`

- [x] **Step 1: escrever os testes de precedência**

Criar `src/lib/application-origin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveCanonicalApplicationEnvironment } from "./application-origin";

describe("canonical application origin", () => {
  it("prefers the protected branch alias in Preview", () => {
    const environment = resolveCanonicalApplicationEnvironment({
      VERCEL_BRANCH_URL: "hub-git-feature.vercel.app",
      VERCEL_ENV: "preview",
      VERCEL_URL: "hub-random-deployment.vercel.app",
    });

    expect(environment.NEXT_PUBLIC_APP_URL).toBe(
      "https://hub-git-feature.vercel.app"
    );
  });

  it("never derives a Production origin from a Vercel hostname", () => {
    const environment = resolveCanonicalApplicationEnvironment({
      VERCEL_BRANCH_URL: "hub-git-main.vercel.app",
      VERCEL_ENV: "production",
      VERCEL_URL: "hub-production.vercel.app",
    });

    expect(environment.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });
});
```

- [x] **Step 2: executar o teste e confirmar a falha**

Run:

```bash
bun test src/lib/application-origin.test.ts
```

Expected: FAIL porque `VERCEL_BRANCH_URL` ainda não participa da resolução.

- [x] **Step 3: implementar a precedência do alias**

Em `src/lib/application-origin.ts`, ampliar a interface:

```ts
VERCEL_BRANCH_URL?: string | undefined;
```

Resolver o hostname assim:

```ts
const deploymentHostname =
  getTrimmedValue(environment.VERCEL_BRANCH_URL) ??
  getTrimmedValue(environment.VERCEL_URL);
```

O fallback permanece no utilitário para deployments Preview desprotegidos. O
contrato da Task 7 exige `VERCEL_BRANCH_URL` no runtime protegido deste projeto.

- [x] **Step 4: propagar o campo à configuração pública**

Em `src/lib/public-app-config.ts`, adicionar
`VERCEL_BRANCH_URL?: string | undefined` a `PublicAppEnvironment`. Atualizar o
teste de Preview para fornecer os dois hostnames e exigir o alias de branch.

- [x] **Step 5: executar os testes de origem e metadata**

Run:

```bash
bun test src/lib/application-origin.test.ts src/lib/public-app-config.test.ts src/lib/env.test.ts
```

Expected: PASS.

### Task 9: Contratos versionados e documentação operacional

**Files:**
- Modify: `.env.example`
- Modify: `src/vercel-deployment-contract.test.ts`
- Modify: `docs/operations/deploy-and-incidents.md`
- Modify: `docs/operations/environment-and-local-development.md`
- Modify: `docs/operations/testing-and-ci.md`
- Modify: `docs/operations/vercel-first-launch-checklist.md`
- Modify: `docs/operations/vercel-migration-status.md`

- [x] **Step 1: documentar as variáveis de sistema sem criar secrets locais**

Adicionar a `.env.example`:

```dotenv
# Definidas automaticamente pela Vercel. Nao preencher em Development.
VERCEL_ENV=
VERCEL_BRANCH_URL=
VERCEL_URL=
```

Manter URLs canônicas locais existentes e registrar que Preview não as recebe
explicitamente.

- [x] **Step 2: fortalecer o teste do workflow**

Em `src/vercel-deployment-contract.test.ts`, exigir que o job Preview:

```ts
expect(source).toContain("name: vercel-preview");
expect(source).toContain("HEALTHCHECK_SECRET");
expect(source).toContain("vercel@57.0.0 curl /api/health/ready");
expect(source).not.toContain("RESEND_API_KEY");
expect(source).not.toContain("R2_SECRET_ACCESS_KEY");
expect(source).not.toContain("DATABASE_URL_DIRECT");
```

Não adicionar providers ao YAML; o runtime Vercel recebe somente o conjunto
limitado cadastrado no painel.

- [x] **Step 3: executar testes de contrato e documentação**

Run:

```bash
bun test src/vercel-deployment-contract.test.ts src/vercel-config.test.ts
bun run docs:check
```

Expected: ambos PASS.

- [x] **Step 4: atualizar o status do Pacote 7**

Em `docs/operations/vercel-migration-status.md`, mudar o status para
“implementado localmente; configuração externa pendente” e registrar:

- validação Preview separada;
- recusa de providers e jobs;
- origem por alias de branch;
- comandos de verificação executados;
- ausência de deployment e de commit.

### Task 10: Configuração externa isolada

**Files:**
- Modify: `docs/operations/vercel-first-launch-checklist.md`
- Modify: `docs/operations/vercel-migration-status.md`

- [x] **Step 1: confirmar novamente a branch Neon Preview**

Usar o conector Neon no projeto `damp-snow-22911188` e confirmar:

- branch `vercel-preview` (`br-cool-leaf-acabyy5q`);
- journal com 44 entradas e topo `0043`;
- ausência de dados de usuários, perfis, cursos, matrículas e certificados;
- endpoint pooled distinto da branch `production`.

Não copiar a connection string para documentação ou chat.

- [x] **Step 2: cadastrar variáveis não compartilhadas na Vercel Preview**

No projeto `neuro-capacitar/hub`, cadastrar somente no escopo Preview:

```text
DATABASE_URL
BETTER_AUTH_SECRET
CLIENT_IP_SOURCE=x-forwarded-for
AUTH_PUBLIC_SIGNUP_ENABLED=false
SCHEDULED_JOBS_ENABLED=false
```

Gerar `BETTER_AUTH_SECRET` com pelo menos 48 bytes aleatórios e inseri-lo
diretamente sem imprimir o valor. Não cadastrar URLs canônicas, `CRON_SECRET`,
R2, Resend, AbacatePay, JMVStream ou Sentry.

- [x] **Step 3: configurar o segredo compartilhado de readiness manualmente**

Como o conector GitHub não administra secrets, solicitar à proprietária:

1. Abra o gerenciador de senhas e gere uma senha aleatória de pelo menos 48
   caracteres.
2. Na Vercel, abra **Neuro Capacitar > hub > Settings > Environment
   Variables**.
3. Crie `HEALTHCHECK_SECRET`, marque **Sensitive** e selecione somente
   **Preview**.
4. Sem fechar o gerenciador, abra GitHub
   **juniordinizm/hub > Settings > Environments**.
5. Crie ou abra `vercel-preview`.
6. Em **Environment secrets**, crie `HEALTHCHECK_SECRET` com exatamente o mesmo
   valor.
7. Apague o valor da área de transferência e salve-o apenas no gerenciador de
   senhas.

- [x] **Step 4: configurar o GitHub Environment Preview manualmente**

No mesmo `vercel-preview`, cadastrar:

```text
secret VERCEL_TOKEN
variable VERCEL_ORG_ID=team_mHFcEG9cedToJWgCu8ikH8VE
variable VERCEL_PROJECT_ID=prj_oHQOBsqhr7wlWpJoGVMTlw7ciyFg
```

`VERCEL_TOKEN` deve ser criado em **Vercel > Account Settings > Tokens**, com
escopo `Neuro Capacitar` e expiração de no máximo 90 dias. A auditoria confirmou
que o time contém somente `hub`, tornando o raio efetivo igual ao projeto. Se um
segundo projeto entrar no time, segregar e rotacionar antes de qualquer deploy.
Não colar o token em chat, arquivo `.env` ou secret do runtime Vercel.

O hardening project-scoped pela CLI foi descartado neste sprint: a sessão OAuth
não cria tokens, o fluxo exige uma credencial ampla intermediária e não reduz o
raio de acesso enquanto só existe `hub`. Revogar imediatamente qualquer token
exposto e criar a credencial final de time diretamente no dashboard.

- [ ] **Step 5: conferir o GitHub Environment Production manualmente**

Criar/abrir `vercel-production`. O repositório é privado e required reviewers
não estão disponíveis nos planos GitHub Free/Pro/Team; a aprovação ocorre pelo
`workflow_dispatch` com SHA completo e confirmação booleana. Cadastrar:

```text
secret VERCEL_TOKEN
secret HEALTHCHECK_SECRET
secret DATABASE_URL_DIRECT
variable VERCEL_ORG_ID=team_mHFcEG9cedToJWgCu8ikH8VE
variable VERCEL_PROJECT_ID=prj_oHQOBsqhr7wlWpJoGVMTlw7ciyFg
```

`HEALTHCHECK_SECRET` deve ser o mesmo de Vercel Production.
`DATABASE_URL_DIRECT` deve ser o endpoint direto da branch Neon `production`,
nunca o pooled e nunca a branch Preview.

- [ ] **Step 6: auditar somente nomes e escopos**

Na Vercel, confirmar que Preview contém apenas os seis nomes aprovados e que
Production preserva seu conjunto completo. No GitHub, confirmar os nomes acima
sem revelar valores. Registrar apenas presença/ausência e ambiente no
checklist.

### Task 11: Verificação integral e primeiro deployment

**Files:**
- Modify: defects discovered by gates only
- Modify: `docs/operations/vercel-migration-status.md`
- Modify: `docs/operations/vercel-first-launch-checklist.md`

- [x] **Step 1: executar a verificação focada**

Run:

```bash
bun test src/lib/application-origin.test.ts src/lib/preview-environment.test.ts src/lib/env.test.ts src/lib/public-app-config.test.ts src/lib/production-environment.test.ts src/vercel-deployment-contract.test.ts
```

Expected: PASS.

- [x] **Step 2: executar os gates locais completos**

Run, nesta ordem:

```bash
bun x ultracite fix
bun run docs:check
bun run db:migrations:check
bun run test
bun run typecheck
bun run check
bun run build
bun run knip
```

Expected: todos com exit code 0. Revisar o diff produzido pelo autofix antes de
aceitá-lo.

- [x] **Step 3: auditar o diff e solicitar autorização Git**

Executar:

```bash
git status --short
git diff --check
git diff --stat
```

Apresentar escopo, testes e riscos. Não criar commit nem push até autorização
explícita da proprietária.

- [ ] **Step 4: commit e push condicionais**

Somente depois da autorização:

```bash
git add --all
git commit -m "feat: prepare Vercel-first production deployment"
git push -u origin codex/vercel-first-migration
```

Confirmar o SHA completo retornado por `git rev-parse HEAD`.

- [ ] **Step 5: acompanhar a CI e o Preview**

Confirmar no run do SHA:

1. Quality gates verdes.
2. PostgreSQL integration verde.
3. Browser journeys verde.
4. Build and dependency audit verde.
5. Vercel preview candidate verde.
6. `/api/health/ready` retornou 200 usando o secret compartilhado.
7. Nenhum provider ou job foi invocado.

- [ ] **Step 6: merge e promoção controlada**

Após revisão do PR e autorização de merge:

1. Fazer merge em `main`.
2. Confirmar que a CI da `main` usa o SHA de merge esperado.
3. Abrir `Deploy Vercel production`, informar o SHA completo em `release_sha`,
   marcar `confirm_production` e executar uma única vez.
4. Confirmar a prova de igualdade com `origin/main` e CI verde.
5. Observar migration e auditoria do journal.
6. Confirmar deployment `--prod --skip-domain`.
7. Confirmar readiness 200.
8. Confirmar `vercel promote` do mesmo deployment.

- [ ] **Step 7: smoke pós-promoção com crons desligados**

Validar em `https://app.neurocapacitar.com.br`:

- login Admin;
- cadastro público de Aluna sem matrícula automática;
- criação/edição básica de Curso;
- upload de capa direto ao R2;
- checkout de teste controlado;
- reprodução JMVStream de um ativo autorizado;
- solicitação de recuperação de senha e entrega Resend/Lark;
- emissão/download/validação de Certificado;
- `/api/health/ready` autenticada;
- quatro crons ainda recusados pelo kill switch.

Se qualquer item falhar, não habilitar jobs. Registrar correlação, deployment e
rollback no runbook.

- [ ] **Step 8: concluir documentação e somente então habilitar jobs**

Atualizar status com SHA, deployment, migration, smoke e riscos. Depois de um
redeploy separado, mudar `SCHEDULED_JOBS_ENABLED=true` somente em Production e
confirmar individualmente os quatro crons. Preview deve permanecer `false`.

- [ ] **Step 9: commit documental final condicionado**

Somente com autorização explícita:

```bash
git add docs/operations/vercel-migration-status.md docs/operations/vercel-first-launch-checklist.md
git commit -m "docs: record first Vercel production release"
git push
```
