# UI trust and auth continuity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make video-processing feedback self-updating, remove deceptive notifications, and keep authentication screens visually continuous.

**Architecture:** Keep the lesson page server-rendered and add a narrowly scoped client component that periodically calls `router.refresh()` while JMVStream processing is pending. Replace the three duplicated authentication page shells with a shared presentational server component. Remove the notification control from the shared authenticated shell until it has a real data source and actions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Vitest.

---

### Task 1: Refresh a processing lesson safely

**Files:**

- Create: `src/components/lesson-video-processing.tsx`
- Create: `src/components/lesson-video-processing.test.tsx`
- Modify: `src/app/(student)/app/aulas/[lessonId]/page.tsx`

- [x] Write a failing component test that advances the polling interval, expects `router.refresh()` to run, and verifies the manual `Verificar agora` action.
- [x] Run `bun x vitest run src/components/lesson-video-processing.test.tsx` and confirm the missing component causes failure.
- [x] Implement a client component with a bounded 15-second refresh interval, a manual refresh button, and copy that says processing may take a few minutes.
- [x] Render it only in the existing JMVStream `videoProcessing` branch, preserving the server page and its ready-player branch.
- [x] Run the focused test and confirm it passes.

### Task 2: Stop displaying fabricated notifications

**Files:**

- Modify: `src/components/panel-layout.tsx`
- Delete: `src/components/notifications-button.tsx`
- Create: `src/components/panel-layout-source.test.ts`

- [x] Write a failing source test asserting `PanelLayout` does not import or render `NotificationsButton`.
- [x] Run `bun x vitest run src/components/panel-layout-source.test.ts` and confirm it fails against the current global header.
- [x] Remove the notification import and render call, then delete the hard-coded notification component.
- [x] Run the focused source test and confirm it passes.

### Task 3: Share the authentication shell

**Files:**

- Create: `src/components/auth-shell.tsx`
- Modify: `src/app/(auth)/entrar/page.tsx`
- Modify: `src/app/(auth)/recuperar-senha/page.tsx`
- Modify: `src/app/(auth)/redefinir-senha/page.tsx`
- Create: `src/components/auth-shell-source.test.ts`

- [x] Write a failing source test asserting all three routes import and use `AuthShell`.
- [x] Run `bun x vitest run src/components/auth-shell-source.test.ts` and confirm it fails.
- [x] Implement `AuthShell` as a server-compatible presentational wrapper with the existing PROTEA-R image treatment on large screens and a slot for each route's `Card`.
- [x] Replace only the repeated outer `<main>`/image wrappers in the three auth pages; retain each route's existing form, metadata, copy and navigation.
- [x] Run the focused source test and confirm it passes.

### Task 4: Verify the integration

**Files:**

- Verify only.

- [x] Run `bun x vitest run src/components/lesson-video-processing.test.tsx src/components/panel-layout-source.test.ts src/components/auth-shell-source.test.ts`.
- [x] Run `bun run typecheck` and `bun x ultracite check`.
- [x] Run `git diff --check`.

**Done criteria:** A processing lesson refreshes without a manual browser reload, its copy does not promise an immediate result, the shared header has no fabricated notification affordance, and every auth route uses the same shell. No commit is created unless the user requests one.
