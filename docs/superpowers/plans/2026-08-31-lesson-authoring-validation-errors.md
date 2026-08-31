# Lesson Authoring Validation and Error Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lesson descriptions optional while preserving title/content validation and show safe, actionable save errors instead of the production Server Components message.

**Architecture:** Keep persistence in the existing authoring service, add a small lesson-specific error/result contract for expected failures, and adapt the save Server Action to return serializable results. The lesson editor will consume that result in its existing transition, showing both a toast and a persistent accessible alert; unknown failures will keep a correlation ID and a safe fallback message.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Server Actions, Vitest, PostgreSQL/Neon, existing operational correlation logging.

---

## File map

- Create `src/features/admin/lesson-authoring-errors.ts`: typed lesson validation error, serializable save result, and safe fallback mapper.
- Create `src/features/admin/lesson-authoring-errors.test.ts`: unit tests for direct expected messages and sanitized unexpected failures.
- Modify `src/features/admin/lesson-drafts.ts`: accept blank descriptions and require only module/title.
- Modify `src/features/admin/lesson-drafts.test.ts`: cover nullable description and title-only validation.
- Modify `src/features/admin/authoring.ts`: enforce title server-side, classify safe lesson validation errors, and validate content before upload confirmation.
- Modify `src/features/admin/authoring.test.ts`: cover title/content failures and no side effects on invalid content; update the draft fixture for a blank description.
- Modify `src/features/admin/actions.ts`: return the typed save result and preserve a correlation ID for unexpected failures.
- Modify `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx`: remove the description `required` attribute in “Nova aula” and label it optional.
- Modify `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx`: assert the creation dialog does not require description.
- Modify `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.tsx`: handle result failures without relying on thrown Server Action messages and render an accessible persistent alert.
- Create `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.test.tsx`: verify failure results are surfaced and success is not shown for a rejected save.

## Task 1: Add the safe lesson action contract

**Files:**
- Create: `src/features/admin/lesson-authoring-errors.ts`
- Test: `src/features/admin/lesson-authoring-errors.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create the tests with these behaviors:

```ts
import { describe, expect, it } from "vitest";
import {
  LessonAuthoringError,
  getLessonSaveActionFailure,
} from "./lesson-authoring-errors";

describe("lesson authoring errors", () => {
  it("returns the safe message and field for expected validation failures", () => {
    expect(
      getLessonSaveActionFailure(
        new LessonAuthoringError("Informe o título da aula.", "title"),
        "correlation-1"
      )
    ).toEqual({
      field: "title",
      message: "Informe o título da aula.",
      ok: false,
    });
  });

  it("does not expose an unexpected exception to the browser", () => {
    const result = getLessonSaveActionFailure(
      new Error("select password from users where token = secret"),
      "correlation-2"
    );

    expect(result).toEqual({
      field: "general",
      message: expect.stringContaining("correlation-2"),
      ok: false,
    });
    expect(result.message).not.toContain("password");
    expect(result.message).not.toContain("secret");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```text
pnpm test -- src/features/admin/lesson-authoring-errors.test.ts
```

Expected: FAIL because the error contract module does not exist yet.

- [ ] **Step 3: Implement the smallest safe contract**

Create the field union, error class, result union, and mapper. The implementation must keep expected messages only when the error is the lesson-specific class and must use this fallback for every other exception:

```ts
export type LessonAuthoringErrorField = "content" | "general" | "title";

export class LessonAuthoringError extends Error {
  readonly field: LessonAuthoringErrorField;

  constructor(
    message: string,
    field: LessonAuthoringErrorField = "general"
  ) {
    super(message);
    this.name = "LessonAuthoringError";
    this.field = field;
  }
}

export type LessonSaveActionResult =
  | { ok: true }
  | {
      field: LessonAuthoringErrorField;
      message: string;
      ok: false;
    };

export const getLessonSaveActionFailure = (
  error: unknown,
  correlationId: string
): Extract<LessonSaveActionResult, { ok: false }> => {
  if (error instanceof LessonAuthoringError) {
    return { field: error.field, message: error.message, ok: false };
  }

  return {
    field: "general",
    message: `Não foi possível salvar a aula. Tente novamente. Se o problema continuar, informe o código de suporte ${correlationId}.`,
    ok: false,
  };
};
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run the same `pnpm test -- src/features/admin/lesson-authoring-errors.test.ts` command. Expected: 2 tests pass.

- [ ] **Step 5: Commit the contract**

```text
git add src/features/admin/lesson-authoring-errors.ts src/features/admin/lesson-authoring-errors.test.ts
git commit -m "feat(authoring): add safe lesson action errors"
```

## Task 2: Make description optional at creation

**Files:**
- Modify: `src/features/admin/lesson-drafts.ts:1-31`
- Modify: `src/features/admin/lesson-drafts.test.ts:1-39`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx:395-427`
- Test: `src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx`

- [ ] **Step 1: Add failing coverage for a title-only draft and optional UI field**

Change the normalization test to omit `description` and expect:

```ts
expect(normalizeLessonDraftInput(formData)).toEqual({
  description: null,
  moduleId: "module-1",
  sortOrder: 3,
  title: "Aula inicial",
});
```

Add a creation-form assertion that parses the rendered HTML and verifies the description textarea is not required while the title input is required:

```ts
const document = new DOMParser().parseFromString(
  renderToStaticMarkup(
    <CreateLessonDraftForm moduleId={moduleData.id} nextSortOrder={2} />
  ),
  "text/html"
);

expect(document.querySelector('textarea[name="description"]')).not.toHaveAttribute(
  "required"
);
expect(document.querySelector('input[name="title"]')).toHaveAttribute(
  "required"
);
```

Update the existing invalid-input expectation to require only module and title.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```text
pnpm test -- src/features/admin/lesson-drafts.test.ts "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx"
```

Expected: FAIL because the server still rejects blank descriptions and the textarea still has `required`.

- [ ] **Step 3: Implement title-only draft validation**

In `LessonDraftInput`, change `description` to `string | null`. Normalize blank input with `readString(...) || null`, validate module and title independently, and throw `LessonAuthoringError` for the missing title. The normalizer must return:

```ts
{
  description,
  moduleId,
  sortOrder: readNumber(formData, "sortOrder", 1),
  title,
}
```

In `CreateLessonDraftForm`, remove `required` from the description textarea and render the label as `Descrição (opcional)`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run the same focused command. Expected: all lesson-draft and course-builder tests pass.

- [ ] **Step 5: Commit the input change**

```text
git add src/features/admin/lesson-drafts.ts src/features/admin/lesson-drafts.test.ts "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.tsx" "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx"
git commit -m "fix(authoring): make lesson description optional"
```

## Task 3: Validate lesson save before side effects

**Files:**
- Modify: `src/features/admin/authoring.ts:1-40,300-370,914-960,1408-1570`
- Test: `src/features/admin/authoring.test.ts:496-530` and new validation cases near the save tests

- [ ] **Step 1: Add failing service tests**

Add a test with a valid draft module and no title that expects `LessonAuthoringError` with field `title` and asserts no upload confirmation occurs:

```ts
await expect(
  saveLesson({ actorUserId: "admin-1", formData })
).rejects.toMatchObject({
  field: "title",
  message: "Informe o título da aula.",
});
expect(confirmLessonResourceUpload).not.toHaveBeenCalled();
```

Add a test with a title, an empty text document, no video, and no resources that expects the content error and verifies `confirmLessonResourceUpload` and the `update lessons`/`insert into lessons` queries did not run:

```ts
await expect(
  saveLesson({ actorUserId: "admin-1", formData })
).rejects.toMatchObject({
  field: "content",
  message:
    "A aula não pode ser salva sem conteúdo. Adicione pelo menos um vídeo, um texto com conteúdo ou um material anexado.",
});
expect(confirmLessonResourceUpload).not.toHaveBeenCalled();
expect(
  query.mock.calls.some(([sql]) => /(?:insert|update) lessons/i.test(String(sql)))
).toBe(false);
```

Update the minimal-lesson creation test to omit description and assert the insert receives `null` at the description position.

- [ ] **Step 2: Run the focused service tests to verify they fail**

Run:

```text
pnpm test -- src/features/admin/authoring.test.ts
```

Expected: FAIL because empty title is not server-validated, the content error is a plain `Error`, and validation currently happens after upload confirmation.

- [ ] **Step 3: Implement safe validation ordering**

Import `LessonAuthoringError` in `authoring.ts`. In `saveLesson`, read and validate the trimmed title before persistence:

```ts
const existingLessonId = readString(formData, "lessonId");
const title = readString(formData, "title");

if (!title) {
  throw new LessonAuthoringError("Informe o título da aula.", "title");
}
```

Normalize lesson content inside a boundary that converts the content module’s controlled validation messages into `LessonAuthoringError` with field `content`. Resolve the video form state, then reject an empty lesson with the explicit content message. Only after those checks should the function read previous R2 keys and call `confirmLessonResourceUploads`. Replace the persisted title expression with the validated `title` variable.

Use `LessonAuthoringError` for the safe lesson-domain failures already in this path: invalid draft module/publication, invalid lesson module, missing lesson upload association, and unconfirmed lesson material. Leave database/provider failures as ordinary unknown exceptions so the action mapper sanitizes them.

- [ ] **Step 4: Run the focused service tests to verify they pass**

Run the same `pnpm test -- src/features/admin/authoring.test.ts` command. Expected: all authoring tests pass, including the existing resource-only lesson behavior.

- [ ] **Step 5: Commit the validation change**

```text
git add src/features/admin/authoring.ts src/features/admin/authoring.test.ts
git commit -m "fix(authoring): validate lesson requirements before save"
```

## Task 4: Return and render save failures safely

**Files:**
- Modify: `src/features/admin/actions.ts:267-278`
- Modify: `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.tsx:1-90`
- Test: `src/features/admin/lesson-authoring-errors.test.ts`
- Create: `src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.test.tsx`

- [ ] **Step 1: Add failing action/UI coverage**

Extend the error-contract test to verify the typed result has `ok: false` for expected errors and the fallback has the correlation code without the original exception.

Create a client component test with mocked `saveLessonAction`, `sonner`, `Button`, and `Select` dependencies. Make the action resolve to:

```ts
{
  field: "content",
  message:
    "A aula não pode ser salva sem conteúdo. Adicione pelo menos um vídeo, um texto com conteúdo ou um material anexado.",
  ok: false,
}
```

Submit the rendered save control and assert that `toast.error` receives the message, an element with `role="alert"` contains the message, and `toast.success` is not called. Add a success case that asserts the success toast is called and the alert is cleared.

- [ ] **Step 2: Run the focused action/UI tests to verify they fail**

Run:

```text
pnpm test -- src/features/admin/lesson-authoring-errors.test.ts "src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.test.tsx"
```

Expected: FAIL because `saveLessonAction` still returns `void` and the sidebar does not handle a result or render an alert.

- [ ] **Step 3: Adapt the Server Action to return a serializable result**

Import `getLessonSaveActionFailure`, `LessonSaveActionResult`, and the existing correlation helper. Implement the action around the existing authoring call:

```ts
export const saveLessonAction = async (
  formData: FormData
): Promise<LessonSaveActionResult> => {
  const correlationId = await getActionCorrelationId();
  const submittedLessonId = String(formData.get("lessonId") ?? "").trim();

  try {
    const saved = await observeOperation({
      aggregateId: submittedLessonId || undefined,
      correlationId,
      execute: async () => {
        const session = await requireRole(["admin"]);
        return await saveLesson({ actorUserId: session.user.id, formData });
      },
      failureErrorCode: "lesson_save_failed",
      operation: "admin.lesson.save",
      provider: "database",
    });

    revalidateAdmin();
    if (saved.lessonId && saved.courseId) {
      revalidatePath(
        buildAdminLessonEditPath({
          courseId: saved.courseId,
          lessonId: saved.lessonId,
        })
      );
    }
    return { ok: true };
  } catch (error) {
    return getLessonSaveActionFailure(error, correlationId);
  }
};
```

The final implementation must revalidate the returned `{ courseId, lessonId }` only after the save succeeds. Expected errors return safe messages; unknown errors return the correlation-based fallback.

- [ ] **Step 4: Update the sidebar feedback**

Keep the current native `checkValidity`, pending transition, and toast loading behavior. Add `errorMessage` state, clear it before each attempt and after success, then branch on the action result:

```ts
const result = await saveLessonAction(formData);
if (!result.ok) {
  setErrorMessage(result.message);
  toast.error(result.message, { id: toastId });
  return;
}

setErrorMessage(null);
toast.success("Aula salva com sucesso!", { id: toastId });
```

For a transport-level exception outside the Server Action result, show only `Não foi possível salvar a aula. Tente novamente.`. Render the error below the controls with `role="alert"` and `aria-live="assertive"`; do not render an exception message or a Next.js digest.

- [ ] **Step 5: Run the focused action/UI tests to verify they pass**

Run the same focused command. Expected: all contract and sidebar feedback tests pass.

- [ ] **Step 6: Commit the action/UI change**

```text
git add src/features/admin/actions.ts src/features/admin/lesson-authoring-errors.test.ts "src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.tsx" "src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.test.tsx"
git commit -m "fix(authoring): show lesson save validation errors"
```

## Task 5: Full verification and staging rollout

**Files:**
- No source changes unless a verification failure identifies a required correction.

- [ ] **Step 1: Run all focused regression tests**

```text
pnpm test -- src/features/admin/lesson-authoring-errors.test.ts src/features/admin/lesson-drafts.test.ts src/features/admin/authoring.test.ts "src/app/(admin)/admin/cursos/[courseId]/course-builder-components.test.tsx" "src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/lesson-sidebar-actions.test.tsx"
```

Expected: all selected suites pass.

- [ ] **Step 2: Run repository type and quality checks**

```text
pnpm type-check
pnpm run check
```

Expected: both commands exit successfully without TypeScript or formatting/lint diagnostics.

- [ ] **Step 3: Inspect the diff and branch state**

```text
git diff --check
git status --short --branch
git log --oneline --decorate -8
```

Expected: no whitespace errors, only the intended commits/files, and the branch is based on the current staging merge that contains the R2 CSP fix.

- [ ] **Step 4: Push the branch and open a staging PR**

```text
git push -u origin fix/lesson-authoring-validation-errors-20260831
gh pr create --base staging --head fix/lesson-authoring-validation-errors-20260831 --title "fix(authoring): make lesson validation actionable" --body "Torna a descrição opcional, mantém título/conteúdo obrigatórios e retorna erros de salvamento de aula de forma segura."
```

Expected: a PR targeting `staging` is created; do not target `main`.

- [ ] **Step 5: Wait for CI and merge only the green staging PR**

```text
$stagingPrNumber = gh pr view --json number --jq .number
gh pr checks $stagingPrNumber --watch
gh pr merge $stagingPrNumber --squash --delete-branch
```

Expected: all required checks pass before merge. Use the actual PR number returned by GitHub; do not invent one.

- [ ] **Step 6: Deploy the merged staging ref through the repository workflow**

Dispatch the exact staging workflow against the `staging` ref and wait for its run:

```text
gh workflow run deploy-staging.yml --ref staging
$stagingRunId = gh run list --workflow deploy-staging.yml --branch staging --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $stagingRunId
```

Inspect the resulting Vercel deployment. Avoid a manual Vercel redeploy and avoid the stale default-branch `workflow_run` path that previously created unnecessary Neon staging backups.

- [ ] **Step 7: Verify staging before production**

Check the deployment state and runtime logs for the exact deployment. Manually verify with an authenticated staging administrator:

1. create a lesson with title and no description;
2. open an existing lesson with no video/text/material and save it;
3. confirm the explicit content message appears in the toast and persistent alert, with no Server Components error;
4. add a video, text, or material and confirm save success;
5. verify a normal description still saves.

Expected: staging is `READY`, health checks pass, no new runtime error is emitted, and all five flows behave as specified.

## Task 6: Promote staging to production after verification

**Files:**
- No source changes.

- [ ] **Step 1: Confirm the staging branch contains the validated merge**

```text
git fetch origin staging main
git log --oneline origin/staging -5
git log --oneline origin/main -5
```

Expected: the lesson-authoring fix is in `origin/staging` and production is still unchanged.

- [ ] **Step 2: Open and pass the staging-to-production PR**

```text
gh pr create --base main --head staging --title "release: promote validated staging" --body "Promove para produção o staging validado, incluindo a correção de validação e mensagens do editor de aulas."
$releasePrNumber = gh pr list --base main --head staging --state open --json number --jq '.[0].number'
gh pr checks $releasePrNumber --watch
```

Expected: required release checks pass; do not merge if a deployment, database, or integration check is red.

- [ ] **Step 3: Merge the release PR and use the production release workflow**

```text
gh pr merge $releasePrNumber --merge --delete-branch=false
```

Dispatch the production workflow for the merged 40-character `main` SHA, preserving its production backup/recovery gate:

```text
$repository = gh repo view --json nameWithOwner --jq .nameWithOwner
$productionReleaseSha = gh api "repos/$repository/git/ref/heads/main" --jq .object.sha
gh workflow run deploy-vercel.yml --ref main -f release_sha=$productionReleaseSha -f confirmation=DEPLOY_PRODUCTION_MAINTENANCE -f confirm_production=true
$productionRunId = gh run list --workflow deploy-vercel.yml --branch main --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $productionRunId
```

Do not redeploy manually from the Vercel dashboard.

- [ ] **Step 4: Verify production and report evidence**

Confirm the production Vercel deployment is `READY`, the application health endpoints respond, and the deployment/runtime logs do not show new lesson-save errors. Report the final commit/deployment identifiers and the staging/production test outcome before claiming completion.
