# Refinamento visual de conteúdo bloqueado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar trilha, próximo estado de liberação, sidebar de aulas e radios de edição de módulo, preservando bloqueios server-side e sem deploy.

**Architecture:** Reusar `LessonAvailability` e `releaseState`, separar visualmente bloqueio temporal de bloqueio sequencial, usar o Accordion shadcn em modo múltiplo e o RadioGroup shadcn no formulário admin. Nenhuma regra de autorização, migration ou query de acesso será alterada.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, shadcn/radix-luma, Hugeicons, Vitest, Bun.

Este plano executa somente o polish complementar à implementação registrada em
`2026-09-06-refine-locked-content-ui.md`; o plano anterior permanece histórico e
não deve ser reexecutado.

---

### Task 1: Estados distintos nos cards da trilha

**Files:**
- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- Modify: `src/components/ui/lesson-card.tsx`

- [x] **Step 1: Escrever testes RED** — adicionar fixtures `time_locked` e `sequence_locked`; exigir `Em breve`, `Continue a sequência` e ausência de links para os dois estados.
- [x] **Step 2: Rodar RED** — `bun run test -- "src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx"`; confirmar falha pela copy genérica atual.
- [x] **Step 3: Implementar GREEN** — adicionar `LessonLockReason = "time" | "sequence"` ao `LessonCard`; mapear o motivo pela disponibilidade e preservar wrappers estáticos, thumbnails, progresso e links ativos.
- [x] **Step 4: Rodar GREEN** — repetir o teste focado e confirmar PASS.

### Task 2: Layout da trilha e próxima liberação

**Files:**
- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/page.tsx`
- Modify: `src/app/(student)/app/cursos/[courseId]/page.test.tsx`

- [x] **Step 1: Escrever testes RED** — verificar que módulo temporal não usa o wrapper `rounded-xl bg-muted/10 p-4`, mostra status/data no bloco lateral e não transforma próxima liberação em botão desabilitado.
- [x] **Step 2: Rodar RED** — `bun run test -- "src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx" "src/app/(student)/app/cursos/[courseId]/page.test.tsx"`.
- [x] **Step 3: Implementar GREEN** — remover card/padding especial; manter layout unificado; para `time_locked`, trocar métricas/progresso pelo bloco relógio + `Em breve` + data tabular.
- [x] **Step 4: Implementar status de cabeçalho** — substituir o `Button disabled` por elemento sem ação com `role="status"`, ícone e data; preservar certificado e CTA normal.
- [x] **Step 5: Rodar GREEN** — repetir os testes focados e confirmar PASS.

### Task 3: Sidebar com Accordion múltiplo

**Files:**
- Modify: `src/app/(student)/app/aulas/[lessonId]/page.tsx`
- Modify: `src/features/courses/lesson-focus-mode.test.ts`
- Modify, se necessário: `src/app/(student)/app/aulas/[lessonId]/page.test.tsx`

- [x] **Step 1: Escrever testes RED** — exigir Accordion `type="multiple"`, módulo atual aberto inicialmente, aviso agrupado no cabeçalho e ausência de data repetida em cada aula.
- [x] **Step 2: Rodar RED** — `bun run test -- src/features/courses/lesson-focus-mode.test.ts "src/app/(student)/app/aulas/[lessonId]/page.test.tsx"`.
- [x] **Step 3: Compor shadcn** — usar `Accordion`, `AccordionItem`, `AccordionTrigger` e `AccordionContent` existentes; abrir inicialmente apenas o módulo da aula atual, permitindo vários abertos depois. O trigger mantém foco visível e não usa sublinhado decorativo.
- [x] **Step 4: Agrupar estados** — módulo temporal mostra relógio + data em uma linha, sem repetir `Em breve`; módulo com sequência mostra bloqueio + `Continue a sequência`; aulas bloqueadas exibem somente marcador e título, sem duração, `href`, foco ou texto repetido.
- [x] **Step 5: Preservar paridade** — manter a mesma árvore para desktop/mobile, busca, preview, active state e links ativos.
- [x] **Step 6: Rodar GREEN** — repetir os testes do outline e confirmar PASS.

### Task 4: RadioGroup shadcn no admin

**Files:**
- Create via CLI: `src/components/ui/radio-group.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx`

- [x] **Step 1: Adicionar componente** — executar `bunx --bun shadcn@latest add radio-group`, ler o arquivo e confirmar compatibilidade radix-luma/Hugeicons sem overwrite.
- [x] **Step 2: Escrever testes RED** — verificar `role="radiogroup"`, `role="radio"`, defaults e valores `immediate`/`delayed`.
- [x] **Step 3: Rodar RED** — `bun run test -- "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx"`.
- [x] **Step 4: Implementar GREEN** — substituir somente os radios nativos por `RadioGroup`/`RadioGroupItem`, mantendo `name="releaseMode"`, labels, defaults, input numérico e action existente.
- [x] **Step 5: Rodar GREEN** — repetir o teste admin e confirmar PASS.

### Task 5: Verificação integrada

**Files:**
- Verify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- Verify: `src/app/(student)/app/aulas/[lessonId]/page.tsx`
- Verify: `src/components/ui/lesson-card.tsx`
- Verify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`

- [x] **Step 1: Testes focados** — rodar trilha, página do curso, outline, server SQL e builder admin.
- [x] **Step 2: Qualidade** — rodar `bun type-check`, `bun x ultracite check` e `git diff --check`.
- [x] **Step 3: Segurança visual** — confirmar que não há mudanças em `src/features/enrollments`, `src/features/comments` ou APIs protegidas; bloqueados permanecem sem links e com `aria-disabled`.
- [x] **Step 4: Escopo** — conferir `git status --short`; não executar push, merge, workflow ou deploy.
