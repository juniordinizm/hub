# JMVStream Course Folder Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify JMVStream organization so each course owns one folder, uploads always target that course folder, and deleted lessons remove their remote videos.

**Architecture:** The app database remains the source of truth for course/module/lesson relationships. JMVStream folders become a visual organization layer at course granularity only; video readiness depends on `video_hash` plus official `playerUrl`, never on folder placement.

**Tech Stack:** Next.js 16 App Router, Server Actions, Postgres, JMVStream REST API, Vitest static regression tests.

---

### Task 1: Lock Course-Folder Behavior With Tests

**Files:**
- Modify: `src/features/jmvstream/server-sql.test.ts`
- Modify: `src/features/admin/actions.ts`

- [ ] Add assertions that upload code calls `requireJmvstreamCourseFolder(lesson.course_id)` and does not call `requireJmvstreamModuleFolder` from `initJmvstreamUpload` or `completeJmvstreamUpload`.
- [ ] Add assertions that course create/update actions call `ensureJmvstreamCourseFolder` after the course row exists.
- [ ] Run `bun run test src/features/jmvstream/server-sql.test.ts`.

### Task 2: Implement Course Folder as Upload Target

**Files:**
- Modify: `src/features/jmvstream/server.ts`
- Modify: `src/features/admin/actions.ts`

- [ ] Add `requireJmvstreamCourseFolder(courseId)` using `ensureJmvstreamCourseFolder`.
- [ ] In upload init/complete/manual sync, replace module-folder target with course-folder target.
- [ ] Rename move helper to course-folder language and make it best-effort.
- [ ] Ensure old module folder records can remain but new uploads no longer create them.

### Task 3: Create Folder When Course Is Created

**Files:**
- Modify: `src/features/admin/actions.ts`

- [ ] After creating a course and after title edits, call `ensureJmvstreamCourseFolder(courseId)`.
- [ ] Do not block course creation if JMV is temporarily unavailable; save the failure in `jmvstream_folders` through existing sync logic.

### Task 4: Lesson Deletion Cleans Remote Video

**Files:**
- Modify: `src/features/admin/actions.ts`
- Modify: `src/features/jmvstream/server.ts`

- [ ] Confirm `deleteLessonAction` calls `deleteJmvstreamAssetsForLesson` before deleting the row.
- [ ] Ensure delete query covers both `lesson_id` and persisted `lessons.video_external_id`.
- [ ] Keep remote video deletion retryable through `delete_status = failed`.
- [ ] Stop deleting course folders merely because a lesson/video was removed; course folder cleanup belongs to course deletion/manual maintenance.

### Task 5: Reconciliation and Docs

**Files:**
- Modify: `docs/JMVSTREAM_SETUP.md`
- Modify: `docs/DEPLOY_CHECKLIST.md`

- [ ] Document that JMV folder organization is per course.
- [ ] Document that modules are represented in local DB and video titles, not remote folder structure.
- [ ] Run final verification: `bun run test`, `bun run typecheck`, `bun x ultracite check`.
