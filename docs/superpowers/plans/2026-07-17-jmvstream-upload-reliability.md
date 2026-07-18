# JMVStream Upload Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make JMVStream uploads recoverable and compatible with the current provider contract.

**Architecture:** The provider client gains v2 authentication and focused video/job queries. The server uses those queries for lifecycle reconciliation and expires abandoned sessions. The client presents persisted state with explicit recovery actions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, PostgreSQL, Vitest.

---

### Task 1: Update provider client contract

**Files:**
- Modify: `src/features/jmvstream/client.ts`
- Test: `src/features/jmvstream/client.test.ts`

- [ ] Add failing tests for `/v2/authenticate`, `GET /v1/videos/:hash`, `GET /v1/videos/job-status/:hash`, gallery movement, and parent galleries.
- [ ] Run `bun x vitest run src/features/jmvstream/client.test.ts` and confirm the new assertions fail.
- [ ] Implement the exact request shapes and typed responses.
- [ ] Re-run the client test file and confirm it passes.

### Task 2: Make lifecycle reconciliation durable

**Files:**
- Modify: `src/features/jmvstream/server.ts`
- Modify: `src/app/api/cron/jmvstream/route.ts`
- Test: `src/features/jmvstream/server-sql.test.ts`

- [ ] Add failing tests that require stale upload expiration from the cron path and hash/job reconciliation.
- [ ] Run the server test file and confirm the assertions fail.
- [ ] Implement stale cleanup, job terminal failure, and fair processing ordering.
- [ ] Re-run the server test file and confirm it passes.

### Task 3: Validate safe upload initialization

**Files:**
- Modify: `src/features/jmvstream/upload-config.ts`
- Modify: `src/features/jmvstream/server.ts`
- Test: `src/features/jmvstream/upload-config.test.ts`

- [ ] Add failing tests for file validation and maximum multipart parts.
- [ ] Run the config test file and confirm the assertions fail.
- [ ] Implement validation and a dynamic chunk-size calculation.
- [ ] Re-run the config test file and confirm it passes.

### Task 4: Provide recovery in the lesson editor

**Files:**
- Modify: `src/components/jmvstream-upload-panel.tsx`
- Modify: `src/components/lesson-kind-controls.tsx`
- Test: `src/components/jmvstream-upload-panel-source.test.ts`

- [ ] Add failing source assertions for retry/replacement/discard affordances and semantic upload control.
- [ ] Run the component source test and confirm the assertions fail.
- [ ] Implement recovery actions while preserving the current video until a replacement succeeds.
- [ ] Re-run the component source test and confirm it passes.

### Task 5: Verify the full change

**Files:**
- Verify: modified files and affected tests

- [ ] Run targeted JMVStream tests.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun x ultracite check`.
