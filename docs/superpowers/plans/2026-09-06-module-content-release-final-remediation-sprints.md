# Module Content Release Final Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o hardening local em um candidato integrado, testado e operacionalmente aprovado para Production, corrigindo os gaps comprovados sem ampliar o produto para regras por Aula, coortes, scheduler ou tabelas de release materializado.

**Architecture:** A autoridade continua sendo Matrícula + publicação vigente + atraso do Módulo + sequência, calculada no servidor. As correções fecham reservas órfãs de checkout, corridas de reorder/publicação, autorização concorrente de comentários e mídia, validação de autoria, relógios/fixtures, diagnóstico e rollout em duas fases. O plano favorece transações curtas, helpers pequenos e evidência real; não cria um motor genérico de regras.

**Tech Stack:** TypeScript 6, Next.js 16 App Router, React 19, PostgreSQL 18/Neon, `pg`, Drizzle migrations, Bun, Vitest, Playwright, Cloudflare R2, JMVStream, GitHub Actions e Vercel.

---

## Estado desta execução

Implementado e verificado localmente: checkout órfão, locks de reorder e
comentários, validação de atraso, fixture temporal, outline de Aula concluída,
Support `invalid_schedule`, telemetria segura, erros tipados, relógio do banco,
revalidação de mídia, rollout por flag e lock agregado de Certificados.

Ainda exige execução externa: merge com `staging`, PostgreSQL concorrente,
Playwright desktop/mobile, `EXPLAIN` da migration 0071, teste real de TTL/R2,
playback JMVStream, aprovação jurídico/comercial e ensaio de rollback em
Staging. Esses itens permanecem desmarcados nas tasks abaixo.

---

## 1. Regras de execução

- Branch auditado: `codex/module-content-release-hardening` em `961476f`.
- Base local original: `9d0450a`.
- Base remota em 2026-09-06: `origin/staging` em `cb2680d`.
- Nunca usar `staging`, Production ou banco Neon compartilhado para testes destrutivos.
- Não stagear `skills-lock.json` nem alterações não relacionadas.
- Cada task começa com teste falhando, implementação mínima, teste verde e commit.
- Não declarar GO enquanto PostgreSQL, E2E, merge e gates manuais estiverem pendentes.
- Itens fora do escopo: regra por Aula, coorte, data absoluta, scheduler, DRM,
  watermark, re-bloqueio do override e tabela Matrícula × Módulo.

## 2. Mapa de arquivos

| Responsabilidade | Arquivos |
| --- | --- |
| Checkout e recuperação | `src/features/payments/checkout.ts`, `checkout-recovery.ts`, testes correspondentes |
| Autorização de mutação | `src/features/enrollments/access.ts`, `enrollment-aggregate-lock.ts` |
| Comentários | `src/features/comments/server.ts`, `server-sql.test.ts`, integração de conteúdo |
| Regra e autoria | `src/features/courses/module-content-release.ts`, `src/features/admin/authoring.ts` |
| Overview/workspace | `src/features/courses/server.ts`, componentes do Curso |
| Support/telemetria | `src/features/admin/support-server.ts`, `content-release-observability.ts` |
| Materiais | rotas `download/route.ts` e `preview/route.ts` |
| Migrations | `src/db/schema.ts`, `src/db/migrations/0071*`, journal e snapshot |
| PostgreSQL/E2E | fixtures de conteúdo, `scripts/e2e-seed`, `tests/e2e/critical-journeys.spec.ts` |
| Operação | `docs/operations/content-release-rollout.md`, `database-and-migrations.md` |

## Sprint 0 — Formar um candidato real

### Task 0.1 — Integrar o `staging` remoto

**Files:** conflitos identificados pelo merge; nenhum deve ser resolvido por
escolha global automática.

- [ ] **Step 1: atualizar refs sem alterar a árvore**

```powershell
git fetch origin staging
git rev-parse origin/staging
git status --short
```

Expected: SHA `cb2680d...` ou sucessor conhecido; worktree limpo.

- [ ] **Step 2: criar branch de integração recuperável**

```powershell
git switch -c codex/module-content-release-final-integration
git merge --no-commit --no-ff origin/staging
```

Expected: conflitos explícitos; nenhum commit automático.

- [ ] **Step 3: classificar cada conflito**

Use:

```powershell
git diff --name-only --diff-filter=U
git log --oneline HEAD..origin/staging
```

Política obrigatória:

- arquivos estranhos à feature, como Sentry/MFA/readiness geral, preservam
  `origin/staging`;
- documentação de release combina as duas intenções e mantém apenas uma regra
  canônica;
- `PRODUCT.md`, `docs/README.md`, arquitetura, decisões e comércio preservam
  as decisões recentes de `staging` e acrescentam a liberação por Módulo;
- `bun.lock` não é editado manualmente: resolva `package.json`, escolha a base
  remota para o lock e rode `bun install` para regenerar deterministicamente;
- testes de workflow preservam todos os asserts do `staging` atual.

- [ ] **Step 4: verificar que nenhum marcador restou**

```powershell
Get-ChildItem -Recurse -File | Select-String -Pattern '^(<<<<<<<|=======|>>>>>>>)'
git diff --check
git status --short
```

Expected: nenhuma ocorrência de marcador; apenas arquivos resolvidos/staged.

- [ ] **Step 5: executar gate rápido antes do commit**

```powershell
bun install --frozen-lockfile
bun run verify:quick
bun run docs:check
```

Expected: exit code 0.

- [ ] **Step 6: commit**

```powershell
git add .github/workflows/verify-production-sentry.yml PRODUCT.md bun.lock docs/README.md docs/architecture.md docs/decisions.md docs/domain/commerce-and-access.md docs/operations/external-readiness-checklist.md docs/operations/observability-and-recovery.md docs/operations/testing-and-ci.md docs/reviews/2026-09-01-production-readiness-requalification.md docs/superpowers/plans/2026-08-23-production-readiness-remediation-sprints.md docs/superpowers/plans/2026-09-03-repository-cleanup-sprints.md src/tooling/release-workflows.test.ts
git commit -m "merge: integrate current staging into module release candidate"
```

### Task 0.2 — Registrar baseline do candidato

**Files:**
- Modify: `docs/reviews/2026-09-06-module-content-release-production-readiness-review.md`

- [ ] Execute e registre SHA e resultados:

```powershell
git rev-parse HEAD
bun run verify
bun audit --production
bun run db:migrations:check
```

Expected: todos com exit code 0. Não registre “PostgreSQL/E2E verde” nesta task.

- [ ] Commit:

```powershell
git add docs/reviews/2026-09-06-module-content-release-production-readiness-review.md
git commit -m "docs: record integrated release baseline"
```

## Sprint 1 — Fechar gaps P1 de lógica

### Task 1.1 — Recuperar reserva pré-provider de checkout

**Files:**
- Modify: `src/features/payments/checkout.ts`
- Modify: `src/features/payments/checkout-recovery.ts`
- Test: `src/features/payments/checkout.test.ts`
- Test: `src/features/payments/checkout-recovery.test.ts`
- Test: `src/features/courses/content-release.integration.test.ts`

- [ ] **Step 1: escrever teste de crash**

Crie um teste que persista um Pedido com:

```ts
{
  checkout_status: "pending",
  checkout_attempt_count: 0,
  checkout_last_attempt_at: null,
  provider_checkout_id: null,
  checkout_url: null,
}
```

Depois repita `createAsaasCheckoutIntent` com mesmo attempt/buyer/Curso. O
resultado esperado não pode ser `processing` eterno: a chamada deve recuperar
a reserva por compare-and-swap ou devolvê-la como falha substituível após um
timeout explícito.

- [ ] **Step 2: confirmar RED**

```powershell
bun run test -- src/features/payments/checkout.test.ts src/features/payments/checkout-recovery.test.ts
```

Expected: FAIL porque `pending` retorna `processing` incondicionalmente.

- [ ] **Step 3: adicionar lease explícito ao read model**

Inclua `created_at`, `checkout_attempt_count` e `checkout_last_attempt_at` em
`CheckoutOrder`. Defina constantes nomeadas:

```ts
const CHECKOUT_RESERVATION_RECOVERY_SECONDS = 30;
const CHECKOUT_PROVIDER_UNCERTAIN_SECONDS = 5 * 60;
```

Não confunda `pending` pré-provider com `creating`, que pode ter chamado o
provider.

- [ ] **Step 4: implementar CAS de recuperação**

Extraia função com contrato:

```ts
type PendingReservationDecision =
  | { kind: "claimable" }
  | { kind: "in_flight" }
  | { kind: "not_pending" };
```

Para uma reserva `pending` sem qualquer ID/URL/provider mutation:

```sql
update orders
set checkout_status = 'creating',
    checkout_attempt_count = checkout_attempt_count + 1,
    checkout_last_attempt_at = $2,
    updated_at = now()
where id = $1
  and checkout_status = 'pending'
  and checkout_attempt_count = 0
  and provider_checkout_id is null
  and checkout_url is null
returning id
```

Somente o vencedor prossegue. Se a autorização/rate limit falhar antes do
provider, delete/reverta apenas a linha ainda sem evidência externa. Se o
estado já for `creating`, não repita o provider sem evidência de idempotência.

- [ ] **Step 5: tornar o status público finito**

`readPublicCheckoutStatus` deve distinguir:

- `pending` recente: `processing`;
- `pending` órfão além do lease: resposta de retry seguro;
- `creating` recente: `processing`;
- `creating` antigo: `processing` com sinal operacional de reconciliação, sem
  chamar provider novamente automaticamente.

- [ ] **Step 6: testar concorrência e crash**

```powershell
bun run test -- src/features/payments/checkout.test.ts src/features/payments/checkout-recovery.test.ts
```

Assertions obrigatórios: um provider call, uma linha de Pedido, sem PII órfã
em rate limit rejeitado e retry finito para `pending` órfão.

- [ ] **Step 7: commit**

```powershell
git add src/features/payments/checkout.ts src/features/payments/checkout-recovery.ts src/features/payments/checkout.test.ts src/features/payments/checkout-recovery.test.ts src/features/courses/content-release.integration.test.ts
git commit -m "fix: recover orphaned checkout reservations"
```

### Task 1.2 — Tornar criação de comentário atômica com entitlement

**Files:**
- Modify: `src/features/comments/server.ts`
- Modify: `src/features/enrollments/access.ts` somente se precisar expor helper
- Test: `src/features/comments/server-sql.test.ts`
- Test: `src/features/courses/content-release.integration.test.ts`

- [ ] **Step 1: escrever corrida RED**

No PostgreSQL, segure `lockEnrollmentAggregate`, revogue a Matrícula, inicie
`createLessonComment` em outra conexão, confirme a revogação e espere a
operação. Assert:

```sql
select count(*) from lesson_comments
where lesson_id = $1 and author_user_id = $2;
```

Expected final: `0`.

- [ ] **Step 2: confirmar que o teste atual falha**

```powershell
bun run test:certificates:integration -- src/features/courses/content-release.integration.test.ts
```

Expected: FAIL ou prova de que o comando precisa ser executado pelo filtro da
configuração de integração; não troque por mock.

- [ ] **Step 3: implementar uma única transação**

Fluxo obrigatório em `createLessonComment`:

```text
BEGIN
ler courseId da Aula
lockEnrollmentAggregate(client, userId, courseId)
resolveLessonAccessWithClient(client, ...)
validar parent com client.query e FOR SHARE/UPDATE
INSERT lesson_comments
COMMIT
```

Todas as queries da mutação usam o mesmo `PoolClient`. Admin continua usando
capacidade própria; Support continua negado.

- [ ] **Step 4: preservar leitura simples**

`getLessonComments` pode validar no início do request e ler em seguida. Não
segure advisory lock durante renderização; documente que revogação posterior
ao check não “desenvia” bytes já autorizados.

- [ ] **Step 5: testar**

```powershell
bun run test -- src/features/comments/server-sql.test.ts src/features/comments/actions.test.ts
bun run typecheck
```

Expected: exit code 0; integração será executada no Sprint 3.

- [ ] **Step 6: commit**

```powershell
git add src/features/comments/server.ts src/features/comments/server-sql.test.ts src/features/courses/content-release.integration.test.ts
git commit -m "fix: revalidate comment access inside transaction"
```

### Task 1.2A — Serializar reorder com publicação

**Files:**
- Modify: `src/features/admin/actions.ts`
- Modify: helper de reorder/authoring usado pelas actions
- Test: `src/features/admin/actions.test.ts`
- Test: `src/features/courses/content-release.integration.test.ts`

- [ ] **Step 1: escrever duas corridas PostgreSQL RED**

Caso A: conexão 1 inicia reorder de Aula e pausa antes do update; conexão 2
publica o Curso; libere a conexão 1. Caso B: publique primeiro e tente reorder
concorrente. Em ambos, o estado final deve corresponder a uma ordem serial
completa: nenhuma escrita estrutural pode entrar no meio de validação + publish.

- [ ] **Step 2: confirmar o gap**

```powershell
bun run test -- src/features/admin/actions.test.ts
```

Expected: o teste de protocolo falha porque reorder não chama o lock canônico.

- [ ] **Step 3: adquirir o lock na transação de reorder**

Para `reorderLessonsAction` e `reorderModulesAction`:

```text
BEGIN
resolver courseId sob a mesma conexão
lockCourseContentRelease(client, courseId)
reler e validar o estado que será alterado
aplicar todos os updates de posição/módulo
COMMIT
```

Não faça lock fora da transação. Não crie outro advisory key. Se uma Aula for
movida entre Módulos, a validação pós-lock deve considerar a regra herdada do
Módulo destino e a monotonicidade de conteúdo já publicado.

- [ ] **Step 4: testar publish/reorder e reorder/publish**

```powershell
bun run test -- src/features/admin/actions.test.ts
bun run typecheck
```

O teste PostgreSQL fica obrigatório no Sprint 3; o unitário deve provar a
ordem `BEGIN -> lock -> re-read -> update -> COMMIT`.

- [ ] **Step 5: commit**

```powershell
git add src/features/admin/actions.ts src/features/admin/actions.test.ts src/features/courses/content-release.integration.test.ts
git commit -m "fix: serialize content reorder with publication"
```

### Task 1.3 — Rejeitar atraso acima do limite na autoria

**Files:**
- Modify: `src/features/courses/module-content-release.ts`
- Modify: `src/features/admin/authoring.ts`
- Test: `src/features/admin/authoring.test.ts`

- [ ] **Step 1: escrever teste RED**

Monte FormData com:

```ts
formData.set("releaseMode", "delayed");
formData.set("releaseDelayDays", String(MAX_RELEASE_DELAY_DAYS + 1));
```

Expected: `saveModule` rejeita antes de qualquer `insert/update modules`.

- [ ] **Step 2: confirmar RED**

```powershell
bun run test -- src/features/admin/authoring.test.ts
```

- [ ] **Step 3: expor um validador canônico**

Em `module-content-release.ts`:

```ts
export const assertValidReleaseDelayDays = (
  releaseDelayDays: number
): void => {
  if (
    !Number.isSafeInteger(releaseDelayDays) ||
    releaseDelayDays < 0 ||
    releaseDelayDays > MAX_RELEASE_DELAY_DAYS
  ) {
    throw new Error("Atraso de liberação inválido.");
  }
};
```

Substitua o validador privado e chame-o no parser da autoria.

- [ ] **Step 4: testar zero, máximo e máximo+1**

```powershell
bun run test -- src/features/courses/module-content-release.test.ts src/features/admin/authoring.test.ts
```

Expected: zero/máximo passam; máximo+1 e negativos falham antes do SQL.

- [ ] **Step 5: commit**

```powershell
git add src/features/courses/module-content-release.ts src/features/admin/authoring.ts src/features/admin/authoring.test.ts
git commit -m "fix: enforce release delay limit during authoring"
```

### Task 1.4 — Remover datas perecíveis das fixtures PostgreSQL

**Files:**
- Modify: `src/features/courses/content-release.integration-fixture.ts`
- Modify: `src/features/courses/content-release.integration.test.ts`

- [ ] Substitua datas absolutas por relógio capturado uma vez:

```ts
const anchor = new Date();
const expiresAt = new Date(
  anchor.getTime() + 365 * MILLISECONDS_PER_DAY
);
```

- [ ] Use `anchor` em todos os caminhos que não aceitam relógio injetado. Para
testes exatos de borda, continue usando as funções puras com `now` explícito.

- [ ] Adicione teste que verifica:

```ts
expect(fixture.expiresAt.getTime()).toBeGreaterThan(Date.now());
expect(fixture.futureAvailableAt.getTime()).toBeGreaterThan(Date.now());
```

- [ ] Execute:

```powershell
bun run typecheck
bun run check
```

- [ ] Commit:

```powershell
git add src/features/courses/content-release.integration-fixture.ts src/features/courses/content-release.integration.test.ts
git commit -m "test: make scheduled integration fixtures time independent"
```

## Sprint 2 — Coerência de leitura, Support e mídia

### Task 2.1 — Manter Aula concluída no outline autorizado

**Files:**
- Modify: `src/features/courses/server.ts`
- Test: `src/features/courses/server-sql.test.ts`
- Test: `tests/e2e/critical-journeys.spec.ts`

- [ ] Escreva teste com Aula concluída em Módulo D+8, antes do prazo.
Expected: workspace disponível; outline contém somente essa Aula concluída do
Módulo futuro; nenhuma Aula pendente futura aparece; next/previous não usa
índice `-1`.

- [ ] Altere a projeção de `visibleModules`:

```ts
if (release.kind === "time_locked") {
  return {
    ...moduleData,
    lessons: moduleData.lessons.filter((lesson) => lesson.isCompleted),
  };
}
```

- [ ] Calcule anterior/próxima com a lista autorizada e trate explicitamente
`lessonIndex < 0` como `null`, nunca como primeiro item.

- [ ] Execute:

```powershell
bun run test -- src/features/courses/server-sql.test.ts
```

- [ ] Commit:

```powershell
git add src/features/courses/server.ts src/features/courses/server-sql.test.ts tests/e2e/critical-journeys.spec.ts
git commit -m "fix: preserve completed future lessons in workspace outline"
```

### Task 2.2 — Expor diagnóstico sanitizado para Support

**Files:**
- Modify: `src/features/admin/support-server.ts`
- Modify: `src/components/admin/student-management-types.ts`
- Modify: componente que renderiza `supportContext`
- Test: `src/features/admin/support-server.test.ts`

- [ ] Adicione tipo:

```ts
type ContentReleaseSupportState = "valid" | "invalid_schedule";
```

- [ ] Calcule `invalid_schedule` quando `scheduled` não possuir âncora válida
ou quando atraso/data não puder ser resolvido. Não devolva stack, SQL, título
de Aula, e-mail ou URL.

- [ ] Mostre ao Support: “Cronograma inválido. Encaminhe para Engenharia.”
Support não recebe botão de override.

- [ ] Teste DTO e UI:

```powershell
bun run test -- src/features/admin/support-server.test.ts src/components/admin/student-management-sheet.test.tsx
```

- [ ] Commit:

```powershell
git add src/features/admin/support-server.ts src/components/admin/student-management-types.ts src/components/admin/student-management-sheet.tsx src/features/admin/support-server.test.ts
git commit -m "fix: expose sanitized invalid schedule diagnostics"
```

### Task 2.3 — Tornar telemetria não bloqueante e correlacionável

**Files:**
- Modify: `src/features/courses/content-release-observability.ts`
- Modify: callers em checkout e Admin actions
- Test: `content-release-observability.test.ts`
- Modify: `docs/operations/observability-and-recovery.md`

- [ ] Escreva teste em que o writer lança. A operação de domínio deve manter o
erro original ou o sucesso já commitado.

- [ ] Envolva somente o sink:

```ts
export const safelyReportContentReleaseEvent = (event: Input): void => {
  try {
    reportContentReleaseOperationalEvent(event);
  } catch {
    // Observability must not change authorization or a committed mutation.
  }
};
```

- [ ] Propague o `x-correlation-id` das Route Handlers/Server Actions para
digest conflict e override; não gere correlação independente quando já existe.

- [ ] Defina no runbook alertas para aumento de:
  `content_release_invalid_state`, `content_release_digest_conflict` e
  `content_release_override_rejected`.

- [ ] Teste e commit:

```powershell
bun run test -- src/features/courses/content-release-observability.test.ts
bun run docs:check
git add src/features/courses/content-release-observability.ts src/features/courses/content-release-observability.test.ts src/features/payments/checkout.ts src/features/admin/actions.ts docs/operations/observability-and-recovery.md
git commit -m "fix: make release telemetry safe and correlated"
```

### Task 2.4 — Evitar cache do redirect de material

**Files:**
- Modify: rotas de download e preview de recursos
- Test: testes das duas rotas

- [ ] Escreva assertions:

```ts
expect(response.headers.get("cache-control")).toBe("private, no-store");
```

- [ ] Aplique o header tanto no 302 autorizado quanto no 404 e recovery
dependentes de entitlement. Não altere o TTL assinado do R2 nesta task.

- [ ] Execute:

```powershell
bun run test -- 'src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.test.ts' 'src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.test.ts'
```

- [ ] Commit:

```powershell
git add 'src/app/api/lessons/[lessonId]/resources/[resourceId]/download' 'src/app/api/lessons/[lessonId]/resources/[resourceId]/preview'
git commit -m "fix: prevent caching of protected resource redirects"
```

### Task 2.4A — Reduzir a janela de revogação na emissão de mídia

**Files:**
- Modify: rotas de download/preview de recursos
- Modify: caminho server-side que solicita playback JMVStream
- Modify: helper de autorização somente se necessário
- Test: testes de rota/provider
- Test: `src/features/courses/content-release.integration.test.ts`

- [ ] Escreva teste PostgreSQL que pause a emissão depois da primeira leitura,
revogue a Matrícula em outra conexão e confirme que nenhuma nova URL R2 é
assinada após a revogação.

- [ ] Para R2, faça a revalidação final em transação curta, usando o relógio
autoritativo da operação. Encerre a transação antes de devolver a resposta.

- [ ] Para JMVStream, não mantenha transação/advisory lock durante chamada de
rede. Revalide imediatamente antes do provider, encerre a transação e trate o
token já emitido como capacidade válida apenas pelo TTL documentado.

- [ ] Teste que revogação anterior à revalidação impede o provider e que falha
do provider não deixa transação aberta.

- [ ] Execute:

```powershell
bun run test -- 'src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.test.ts' 'src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.test.ts'
bun run typecheck
```

- [ ] Commit:

```powershell
git add src/app/api src/features/courses src/features/videos
git commit -m "fix: revalidate media access before token issuance"
```

### Task 2.5 — Decidir migration 0071 com evidência

**Files:**
- Potentially remove/regenerate: `src/db/migrations/0071*`, journal, snapshot,
  migration marker and schema index
- Modify: `docs/operations/database-and-migrations.md`

- [ ] Em clone descartável com volume semelhante a Production, execute antes:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT EXISTS (
  SELECT 1 FROM enrollment_events
  WHERE course_id = (
    SELECT course_id
    FROM enrollment_events
    WHERE event_type = 'content_release_scheduled'
    ORDER BY occurred_at DESC
    LIMIT 1
  )
    AND event_type = 'content_release_scheduled'
);
```

- [ ] Registre linhas da tabela, plano, tempo e buffers sem PII.

- [ ] Se o índice não trouxer ganho relevante, remova-o **antes de qualquer
ambiente aplicar 0071**, regenere journal/snapshot pelo Drizzle e mantenha a
consulta sem índice.

- [ ] Se o índice for necessário, escolha uma opção explícita:

1. tabela pequena + janela protegida: manter `CREATE INDEX` transacional e
   medir duração do lock;
2. tabela grande/ativa: criar procedimento operacional separado com `CREATE
   INDEX CONCURRENTLY`, pois ele não pode rodar dentro da transação do migrador
   Drizzle.

- [ ] Execute:

```powershell
bun run db:migrations:check
bun run test -- src/db/migration-state.test.ts
bun run docs:check
```

- [ ] Commit com uma das mensagens:

```powershell
git commit -m "chore: remove unproven release history index"
# ou
git commit -m "perf: document measured release history index rollout"
```

## Sprint 3 — Provas reais e UX comportamental

### Task 3.1 — Completar testes de override e acessibilidade

**Files:**
- Modify: `src/features/enrollments/content-release.integration.test.ts`
- Modify: `src/components/admin/student-content-release-controls.test.tsx`

- [ ] PostgreSQL: testar override ativo, revogado, expirado, futuro e replay.
Para todos os inativos, assert zero evento/audit/update.

- [ ] UI com ambiente DOM: rejeite a Server Action, clique no botão e espere:

```ts
expect(screen.getByRole("alert")).toHaveTextContent(
  "Não foi possível liberar o conteúdo."
);
expect(textarea).toHaveAttribute("aria-describedby", alert.id);
```

- [ ] Testar teclado e foco após erro; o botão deve expor `aria-busy=true`
durante a promise pendente.

- [ ] Execute unitários e deixe integração para a Task 3.3.

### Task 3.2 — Testar relógio de borda consistente

**Files:**
- Modify: resolver/read models conforme decisão
- Test: regras e integração

- [ ] Escolha uma referência única por operação. Para mutações críticas,
prefira `select now() as decision_now` no mesmo `PoolClient` e passe esse Date
ao resolver. Não misture `Date.now()` e `now()` na mesma decisão.

- [ ] Testar um segundo antes, exatamente no limite e um segundo depois.

- [ ] Testar clock skew simulado entre aplicação e banco; a decisão deve seguir
a referência escolhida.

- [ ] Commit:

```powershell
git commit -m "fix: use one authoritative release clock per operation"
```

### Task 3.3 — Rodar PostgreSQL e Playwright no SHA final

**Files:** nenhum, salvo correções descobertas.

- [ ] Push do branch integrado:

```powershell
git push -u origin codex/module-content-release-final-integration
```

- [ ] Criar/atualizar PR para `staging` e executar workflow CI manualmente se
o evento não iniciar automaticamente.

- [ ] O run deve provar, no mesmo SHA:

```text
install frozen
docs
migrations
typecheck
Ultracite
unitários
audit
PostgreSQL integration
Playwright desktop/mobile
build
Knip
```

- [ ] Inspecione o log da suíte `content-release.integration.test.ts`; não
aceite “0 tests”, skip ou execução apenas por mock.

- [ ] Confirme que as garantias de reorder/publicação, comentário/revogação,
checkout CAS e emissão de mídia são asserts de comportamento em PostgreSQL,
não apenas buscas de texto-fonte em `server-sql.test.ts`.

- [ ] Baixe o artefato Playwright e confirme ausência de retries escondendo
falha determinística.

- [ ] Registre URL do run e SHA no relatório de readiness.

## Sprint 4 — Homologação operacional

### Task 4.0 — Adicionar trava temporária de publicação D+N

**Files:**
- Modify: `src/lib/env.ts`
- Modify: fronteira server-side de publicação de Curso
- Test: testes de env e publicação
- Modify: `docs/operations/content-release-rollout.md`

Esta flag controla somente **novas publicações com atraso**. O runtime deve
sempre interpretar e aplicar D+N já persistido, inclusive quando a flag está
desligada. Assim, desligá-la nunca libera conteúdo.

- [ ] Adicione `CONTENT_RELEASE_DELAYED_PUBLISHING_ENABLED` com default seguro
`false` e parsing booleano estrito. Não use a flag em reads/resolvers.

- [ ] Escreva três testes antes da implementação:

1. flag ausente/false + todos os Módulos D+0 => publicação permitida;
2. flag ausente/false + qualquer Módulo D+N => publicação negada antes da
   gravação e com mensagem operacional explícita;
3. flag true + D+N válido => fluxo normal, incluindo monotonicidade e digest.

- [ ] Documente quem pode habilitar, como provar o valor efetivo em Staging e
Production e como desligar novamente. Nunca registre segredo; a flag não é
credencial.

- [ ] Execute:

```powershell
bun run test -- src/lib/env.test.ts src/features/admin/actions.test.ts
bun run docs:check
bun run typecheck
```

- [ ] Commit:

```powershell
git add src/lib/env.ts src/lib/env.test.ts src/features/admin/actions.ts src/features/admin/actions.test.ts docs/operations/content-release-rollout.md
git commit -m "feat: gate delayed publishing during phased rollout"
```

### Task 4.1 — Piloto D+0/D+1/D+8 em Staging

Siga `docs/operations/content-release-rollout.md` e registre somente IDs de
fixture e horários, nunca tokens/URLs assinadas.

- [ ] aplicar migrations pelo workflow protegido de Staging;
- [ ] criar Curso piloto com Módulos D+0, D+1 e D+8;
- [ ] ativar nova Matrícula de teste;
- [ ] confirmar overview, dashboard, URL direta, comentário, watch, conclusão,
  certificado, download e preview;
- [ ] simular digest alterado e override Admin;
- [ ] confirmar que Support diagnostica sem mutar.

Expected: nenhum título, conteúdo, thumbnail, embed, chave R2 ou comentário de
Aula futura no DOM, RSC payload ou resposta de rede.

### Task 4.2 — Validar R2

- [ ] emitir URL de objeto de fixture autorizado;
- [ ] conferir operação/chave e TTL;
- [ ] testar URL alterada e expirada;
- [ ] revogar Matrícula após emissão e medir a janela residual;
- [ ] confirmar `private, no-store` no redirect do Hub;
- [ ] confirmar CORS limitado ao origin esperado.

Expected: o Hub não emite nova URL após revogação; URL antiga funciona apenas
até o TTL documentado.

### Task 4.3 — Validar JMVStream

Com suporte/documentação do plano contratado, registre respostas para:

1. playback é assinado?
2. qual TTL?
3. há restrição por domínio/origin/referer?
4. player aberto continua após revogação?
5. URL copiada toca fora do Hub?

Se qualquer resposta crítica for desconhecida, classifique como risco residual
e não anuncie “proteção contra pirataria”. Se a URL for pública/permanente,
Production permanece NO-GO para a promessa de revogação forte, embora o drip
possa ser lançado com disclosure explícito de proteção limitada.

### Task 4.4 — Aprovação jurídica/comercial

- [ ] Jurídico revisa CDC art. 49, Decreto 7.962/2013, cronograma, âncora,
  confirmação durável e canal de cancelamento.
- [ ] Comercial confirma que landing/checkout não promete acesso integral
  imediato.
- [ ] Produto confirma que “24 horas” e fuso estão claros.
- [ ] Guardar aprovação no sistema documental da empresa, não no banco da
  aplicação.

### Task 4.5 — Rollout em duas fases e ensaio de recuperação

**Fase 1 — runtime compatível, D+N desabilitado:**

- [ ] publicar schema aditivo e runtime que entende/aplica todas as regras;
- [ ] manter publicação de novos D+N desabilitada pela flag server-side;
rascunhos podem ser configurados, mas Módulos publicados continuam D+0;
- [ ] exercitar D+0, leitura de linhas antigas, migrations e observabilidade;
- [ ] ensaiar rollback para a versão imediatamente anterior enquanto nenhum
D+N existe; confirmar que schema aditivo é tolerado;
- [ ] guardar o SHA compatível aprovado como baseline de recuperação.

**Fase 2 — habilitar D+N:**

- [ ] somente depois da janela de observação da Fase 1, habilitar publicação
D+N;
- [ ] publicar piloto D+0/D+1/D+8 e repetir a homologação;
- [ ] marcar explicitamente o runtime pré-feature como **proibido para
rollback**, pois ele liberaria conteúdo futuro;
- [ ] ensaiar recuperação promovendo o baseline compatível ou um forward-fix;
- [ ] ensaiar escape funcional publicando todos os Módulos do piloto em D+0,
uma decisão deliberada que libera conteúdo e precisa de aprovação do Produto;
- [ ] confirmar que não existe migration destrutiva de reversão.

Expected: após o primeiro D+N ativo, nenhum procedimento aponta para runtime
que ignore `release_mode`/`release_delay_days`.

## Sprint 5 — Decisão final

### Task 5.1 — Requalificar o candidato

Atualize o relatório somente com evidência do SHA final.

Critérios cumulativos para GO:

- [ ] branch integrado sem conflitos;
- [ ] CI completo verde no SHA final;
- [ ] nenhuma reserva de checkout fica indefinidamente pendente;
- [ ] comentário concorrente não atravessa revogação;
- [ ] reorder e publicação produzem uma ordem serial completa;
- [ ] emissão de mídia revalida antes de criar novo token;
- [ ] autoria rejeita atraso inválido;
- [ ] fixture não depende de data absoluta;
- [ ] Support diagnostica estado inválido;
- [ ] índice 0071 tem decisão baseada em medição;
- [ ] R2/JMVStream têm evidência e risco residual documentado;
- [ ] jurídico/comercial aprovou a oferta;
- [ ] piloto e rollout/recuperação em duas fases passaram.

Se qualquer item faltar, manter NO-GO e listar o dono da pendência. Não usar
“verde local” como substituto de PostgreSQL, E2E ou Staging.

## Sprint 6 — Refinamentos pós-lançamento, não bloqueantes

Execute apenas depois do GO, em commits pequenos. Este sprint não pode atrasar
uma correção P0/P1 nem virar refactor amplo da feature.

### Task 6.1 — Substituir classificação por mensagem por erro tipado

**Files:**
- Modify: `src/features/courses/module-content-release.ts`
- Modify: `src/features/courses/content-release-observability.ts`
- Modify: callers em `src/features/courses/server.ts` e
  `src/features/enrollments/access.ts`
- Test: testes das regras e observabilidade

- [ ] Crie `ContentReleaseDomainError` com `code` discriminado somente para os
casos hoje reconhecidos: cronograma inválido, âncora ausente/inválida e atraso
fora do limite. Não exponha a mensagem interna ao cliente.

- [ ] Primeiro escreva testes que mudem a mensagem, mas preservem o `code`; a
classificação deve continuar estável. Confirme RED com a implementação atual.

- [ ] Faça `classifyContentReleaseError` priorizar `instanceof` + `code` e
manter fallback `unknown`, removendo comparações com texto em português.

- [ ] Execute:

```powershell
bun run test -- src/features/courses/module-content-release.test.ts src/features/courses/content-release-observability.test.ts
bun run typecheck
```

- [ ] Commit:

```powershell
git add src/features/courses/module-content-release.ts src/features/courses/content-release-observability.ts src/features/courses/content-release-observability.test.ts src/features/courses/server.ts src/features/enrollments/access.ts
git commit -m "refactor: classify release errors by domain code"
```

### Task 6.2 — Unificar o lock Conta + Curso

**Files:**
- Modify: `src/features/certificates/server.ts`
- Modify: `src/features/enrollments/enrollment-aggregate-lock.ts`
- Test: `src/features/certificates/server.test.ts`
- Test: `src/features/enrollments/server-sql.test.ts`

- [ ] Escreva teste de contrato garantindo que Certificado chama
`lockEnrollmentAggregate(client, userId, courseId)` e não contém SQL duplicado.

- [ ] Reuse o helper existente sem mudar chave, ordem de parâmetros ou ordem
global Curso -> Conta+Curso. Uma troca desses detalhes criaria dois locks
diferentes e anularia a proteção.

- [ ] Execute:

```powershell
bun run test -- src/features/certificates/server.test.ts src/features/enrollments/server-sql.test.ts
bun run typecheck
```

- [ ] Commit:

```powershell
git add src/features/certificates/server.ts src/features/certificates/server.test.ts src/features/enrollments/enrollment-aggregate-lock.ts src/features/enrollments/server-sql.test.ts
git commit -m "refactor: reuse enrollment aggregate lock"
```

### Task 6.3 — Extrair somente a projeção de disponibilidade

**Files:**
- Create: `src/features/courses/lesson-availability-projection.ts`
- Modify: `src/features/courses/server.ts`
- Test: `src/features/courses/lesson-availability-projection.test.ts`

- [ ] Antes de mover código, escreva testes sobre entrada/saída da projeção:
Módulo D+0, D+N, sequência, Aula concluída futura e navegação sem índice `-1`.

- [ ] Extraia função pura que recebe dados já carregados + `decisionNow` e
devolve módulos visíveis, razões de bloqueio e IDs anterior/próximo. Não mova
SQL, autenticação, transações nem Certificado para o novo arquivo.

- [ ] Compare snapshots/objetos antes e depois; nenhum DTO público pode mudar.

- [ ] Execute:

```powershell
bun run test -- src/features/courses/lesson-availability-projection.test.ts src/features/courses/server-sql.test.ts
bun run verify:quick
```

- [ ] Commit:

```powershell
git add src/features/courses/lesson-availability-projection.ts src/features/courses/lesson-availability-projection.test.ts src/features/courses/server.ts
git commit -m "refactor: isolate lesson availability projection"
```

## Self-review

### Cobertura

- Candidato/merge/CI: Sprint 0 e 3.
- Checkout órfão: Task 1.1.
- Comentários: Task 1.2.
- Reorder/publicação: Task 1.2A.
- Limite de autoria: Task 1.3.
- Fixture temporal: Task 1.4.
- Workspace de concluída futura: Task 2.1.
- Support/telemetria/R2: Tasks 2.2–2.4A.
- Índice: Task 2.5.
- Relógio e testes reais: Sprint 3.
- Mídia, jurídico e rollout/recuperação: Sprints 2 e 4.
- Decisão final: Sprint 5.
- Erros tipados, lock duplicado e extração limitada: Sprint 6 pós-lançamento.

### Consistência de tipos

- `ContentReleaseMode` continua canônico em `module-content-release.ts`.
- `LessonAvailability` mantém `available | time_locked | sequence_locked`.
- `invalid_schedule` é diagnóstico de Support, não novo estado de autorização.
- Snapshot continua versão 1 e `elapsed_24h`.
- Nenhuma task torna o navegador autoridade.

### YAGNI

O plano não adiciona scheduler, coorte, chave de Módulo, tabela materializada,
override por Módulo ou DRM. Cada abstração proposta fecha um finding concreto.
