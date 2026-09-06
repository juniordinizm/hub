# Refinar a apresentação de conteúdo bloqueado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar módulos e aulas bloqueados com a riqueza visual da trilha e do sidebar, mantendo todos os bloqueios server-side e sem deploy neste ciclo.

**Architecture:** A projeção server-side deixa de remover aulas futuras e passa a carregar apenas seus metadados visuais. A trilha usa a mesma composição de cards para módulos ativos e futuros; o sidebar recebe o estado temporal do módulo para renderizar itens estáticos com lock/date, enquanto links continuam restritos às aulas realmente acessíveis.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, Vitest, Bun.

---

### Task 1: Travar o contrato visual da trilha com testes

**Files:**
- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx`

- [ ] **Step 1: Escrever testes RED para cards futuros visíveis**

Adicionar um caso com módulo `time_locked` contendo uma aula com thumbnail,
duração e `availability: { kind: "time_locked", availableAt: ... }`. Esperar:

```tsx
expect(markup).toContain("Aula futura");
expect(markup).toContain("thumb-futura");
expect(markup).toContain("Bloqueada");
expect(markup).not.toContain('/app/aulas/lesson-future');
```

Também afirmar que a descrição do módulo e o texto de disponibilidade aparecem.

- [ ] **Step 2: Rodar o teste focado e confirmar RED**

Run:

```powershell
bun run test -- "src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx"
```

Expected: FAIL porque a projeção/fixture atual não renderiza aula futura no
ramo bloqueado.

### Task 2: Projetar metadados futuros sem liberar conteúdo

**Files:**
- Modify: `src/features/courses/server.ts`
- Test: `src/features/courses/server-sql.test.ts`
- Test: `src/features/courses/content-release.integration.test.ts`

- [ ] **Step 1: Alterar a projeção do overview**

Em `appendOverviewLesson`, manter `lessonCount` e `totalDurationSeconds`, mas
remover somente o retorno antecipado para `releaseState === "time_locked"`.
Preservar o retorno antecipado para estado `invalid` não concluído. Assim,
`resolveLessonAvailability` produz `time_locked` e o DTO continua sem
`content_json`, player ou material.

Ao criar `moduleData`, preservar `row.module_description` também em
`time_locked`, pois a descrição é metadado do Módulo e não conteúdo rico da
Aula.

- [ ] **Step 2: Adicionar regressão SQL do overview**

No teste de projeção, criar/ajustar fixture para uma aula futura com thumbnail e
afirmar que o overview contém a aula, `thumbnailUrl`, `hasVideo` e
`availability.kind === "time_locked"`, sem `contentJson` ou URL de vídeo.

- [ ] **Step 3: Verificar a integração temporal existente**

Estender o caso de overview em
`src/features/courses/content-release.integration.test.ts` para afirmar que o
Módulo futuro mantém o título da Aula visível, mas `getStudentLessonWorkspace`
continua retornando `time_locked` para uma Aula não concluída.

- [ ] **Step 4: Rodar testes RED/GREEN do contrato server-side**

Run:

```powershell
bun run test -- src/features/courses/server-sql.test.ts src/features/courses/content-release.integration.test.ts
```

Expected: tests verdes após a projeção expor somente os metadados permitidos.

### Task 3: Refinar a trilha do curso

**Files:**
- Modify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- Test: `src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx`

- [ ] **Step 1: Unificar o layout de módulo ativo e bloqueado**

Remover o ramo que renderiza apenas o resumo quando `releaseState !==
"available"`. Renderizar o cabeçalho, descrição, métricas, progresso e faixa de
cards em uma única composição.

- [ ] **Step 2: Adicionar o estado compacto do módulo**

No cabeçalho bloqueado, usar o ícone de lock e um `Badge variant="outline"`
com texto `Bloqueado`. Abaixo ou ao lado da métrica, renderizar a data com
`tabular-nums` e `Disponível em ...`. Aplicar `text-wrap-balance` ao título e
`text-wrap-pretty` à descrição.

- [ ] **Step 3: Tornar cards bloqueados explicitamente estáticos**

Manter `LessonCard status="locked"`, mas envolver o card bloqueado em um
elemento com `aria-disabled="true"`, `aria-label` contextual e
`cursor-default`. Não usar `Link`, `button` ou `onClick`. Cards ativos mantêm o Link atual.

- [ ] **Step 4: Refinar métricas e contraste sem criar nova linguagem visual**

Usar a mesma faixa de cards e espaçamento dos módulos ativos. Para o módulo
bloqueado, aplicar apenas superfície muted, lock badge e os estados já
existentes do `LessonCard`; remover hover de cor/escala nos wrappers bloqueados.
Garantir que data e contadores usem `tabular-nums` e que o lock permaneça
identificável sem depender apenas de grayscale.

- [ ] **Step 5: Rodar testes da trilha**

Run:

```powershell
bun run test -- "src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx"
```

Expected: PASS com aula futura visível e sem link.

### Task 4: Projetar e renderizar o sidebar completo

**Files:**
- Modify: `src/features/courses/server.ts`
- Modify: `src/app/(student)/app/aulas/[lessonId]/page.tsx`
- Test: `src/features/courses/server-sql.test.ts`
- Test: `src/features/courses/lesson-focus-mode.test.ts`

- [ ] **Step 1: Estender `ModuleWithLessons` com estado de release**

Adicionar `releaseState: "available" | "invalid" | "time_locked"` e
`availableAt: Date | null` ao módulo do workspace. O default de `mapModules`
é `available`; a projeção do workspace substitui o estado com a regra temporal.

- [ ] **Step 2: Manter aulas futuras no workspace, mas marcar como indisponíveis**

Quando o módulo for `time_locked`, mapear todas as aulas mantendo título,
duração e `isCompleted`, mas definir `isAvailable: lesson.isCompleted`.
Não filtrar a lista. Em estado `invalid`, manter o fail-closed atual.

- [ ] **Step 3: Passar estado do módulo ao outline desktop/mobile**

Em `LessonCourseOutline`, passar para cada `LessonSidebarItem` o
`moduleReleaseState` e `moduleAvailableAt`. A mesma prop deve ser usada pelas
duas chamadas existentes do outline, garantindo paridade desktop/mobile.

- [ ] **Step 4: Refinar item bloqueado**

Quando `moduleReleaseState === "time_locked"` e a Aula não estiver concluída,
renderizar um `div` estático com lock icon, título, duração e
`Disponível em <data>`. Quando `isAvailable === false` por sequência, manter
`Conclua a aula anterior`. Adicionar `aria-disabled="true"`, remover hover e
não permitir foco ou navegação.

- [ ] **Step 5: Preservar links ativos e item corrente**

Itens acessíveis continuam usando `SidebarMenuLink`, inclusive active state,
preview mode e `getPreviewAwareHref`. Nenhuma alteração deve permitir que o
sidebar bypass a proteção de `getStudentLessonWorkspace`.

- [ ] **Step 6: Rodar testes do workspace/outline**

Run:

```powershell
bun run test -- src/features/courses/server-sql.test.ts src/features/courses/lesson-focus-mode.test.ts
```

Expected: PASS com aulas futuras listadas e links ausentes somente nos itens bloqueados.

### Task 5: Verificação completa e revisão visual estática

**Files:**
- Verify: `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- Verify: `src/app/(student)/app/aulas/[lessonId]/page.tsx`
- Verify: `src/features/courses/server.ts`

- [ ] **Step 1: Rodar suíte focalizada completa**

```powershell
bun run test -- "src/app/(student)/app/cursos/[courseId]/course-overview-client.test.tsx" "src/app/(student)/app/aulas/[lessonId]/page.test.tsx" src/features/courses/server-sql.test.ts src/features/courses/content-release.integration.test.ts
```

- [ ] **Step 2: Rodar verificações estáticas**

```powershell
bun typecheck
bun x ultracite check
bun run docs:check
```

- [ ] **Step 3: Confirmar que o backend de autorização não foi enfraquecido**

```powershell
git diff -- src/features/enrollments src/features/comments src/app/api/lessons
```

Expected: no changes. A mudança fica restrita à projeção visual, aos componentes
da trilha/sidebar e aos testes/documentação do comportamento.

- [ ] **Step 4: Confirmar escopo sem deploy**

```powershell
git status --short
git diff --check
```

Não executar `git push`, `gh pr merge`, `gh workflow run` ou qualquer comando de
deploy nesta tarefa sem solicitação posterior explícita.
