# Timezone Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make date and time behavior deterministic across local development, Vercel Staging, and Production while preserving UTC instants in the database.

**Architecture:** Store instants in `timestamptz`/UTC, format instants through shared helpers pinned to `America/Sao_Paulo`, and construct date-only expiration selections in that same IANA timezone. Keep cron schedules and logs explicitly UTC. Remove direct UI formatters that inherit the host timezone.

**Tech Stack:** TypeScript, `Intl.DateTimeFormat`, `@date-fns/tz`, date-fns, Vitest, Bun, Next.js.

---

## Task 1: Establish the contract

- Add the canonical policy to the operations/environment documentation.
- Record the evidence and primary-source research in `docs/reviews/`.
- Keep the fixed application display timezone separate from the browser/request timezone and Vercel compute region.

## Task 2: Add red tests

- Test date, date-time, and HTML date-input formatting for the same instant.
- Test expiration selection conversion under a non-São-Paulo process timezone.
- Test that the selected calendar date remains the end of that date in `America/Sao_Paulo`.

## Task 3: Implement deterministic helpers

- Centralize the application timezone and PostgreSQL day-boundary expressions in
  `src/lib/timezone.ts`; keep presentation helpers in `src/lib/formatters.ts`.
- Use `@date-fns/tz` for date-only calendar-to-instant conversion.
- Replace implicit `Intl.DateTimeFormat` and UTC slicing in admin/student/comment surfaces.

## Task 4: Verify the repository

- Run the focused timezone and enrollment tests.
- Run Ultracite, TypeScript, documentation checks, and the broader test suite where feasible.
- Audit remaining date formatting call sites and report any intentionally UTC-only behavior.
