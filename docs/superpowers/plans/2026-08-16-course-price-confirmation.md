# Course Price Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require an explicit AlertDialog confirmation before an Admin persists a changed Course price from the Course settings form.

**Architecture:** Keep `saveCourseAction` and the server-side save lifecycle unchanged. The client form parses the submitted price, saves unchanged amounts immediately, and stores the submitted `FormData` only when the amount differs so the same save path can continue after confirmation.

**Tech Stack:** Next.js 16 App Router, React 19 Client Component, Radix-based `AlertDialog`, TypeScript, Vitest, jsdom, Bun.

---

### Task 1: Add failing interaction tests

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx`

- [x] **Step 1: Configure jsdom and mocks.** Add `/** @vitest-environment jsdom */`, import `act`, `createRoot`, `Root`, `afterEach`, and `beforeEach`, and replace the action mock with a hoisted mock:

```tsx
const saveCourseActionMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/admin/actions", () => ({
  saveCourseAction: saveCourseActionMock,
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));
```

Reset the mock before each test and unmount the React root, remove its container,
and clear `document.body` after each test. Preserve the existing static-markup
tests and the `course` fixture.

- [x] **Step 2: Add real DOM helpers.** Mount `CourseSettingsForm` with
`createRoot` into a new `HTMLDivElement`. Add a `submitSettingsForm` helper that
dispatches a cancelable `submit` event from the mounted form and awaits a
microtask inside `act`.

Use these helpers so every test exercises the same mounted form:

```tsx
let container: HTMLDivElement;
let root: Root;

const renderCourseSettingsForm = (): void => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<CourseSettingsForm course={course} />);
  });
};

const setPrice = (value: string): void => {
  const input = container.querySelector<HTMLInputElement>('input[name="price"]');
  if (!input) {
    throw new Error("Expected price input.");
  }
  input.value = value;
};

const submitSettingsForm = async (): Promise<void> => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected Course settings form.");
  }
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
};

const findButton = (label: string): HTMLButtonElement => {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button: ${label}`);
  }
  return button;
};

const clickButton = (label: string): void => {
  act(() => {
    findButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
};

const clickButtonAsync = async (label: string): Promise<void> => {
  await act(async () => {
    findButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};
```

- [x] **Step 3: Add four failing tests.** Cover these exact behaviors:

```tsx
it("saves an equivalent price without opening confirmation", async () => {
  renderCourseSettingsForm();
  setPrice("19,90");
  await submitSettingsForm();
  expect(saveCourseActionMock).toHaveBeenCalledOnce();
  expect(document.body.textContent).not.toContain(
    "Confirmar alteração de preço?"
  );
});

it("waits for confirmation before saving a changed price", async () => {
  renderCourseSettingsForm();
  setPrice("29,90");
  await submitSettingsForm();
  expect(saveCourseActionMock).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Confirmar alteração de preço?");
  expect(document.body.textContent).toContain("R$ 19,90");
  expect(document.body.textContent).toContain("R$ 29,90");
});

it("does not save when the price confirmation is cancelled", async () => {
  renderCourseSettingsForm();
  setPrice("29,90");
  await submitSettingsForm();
  clickButton("Cancelar");
  expect(saveCourseActionMock).not.toHaveBeenCalled();
});

it("saves the original form snapshot after confirming a changed price", async () => {
  renderCourseSettingsForm();
  setPrice("29,90");
  await submitSettingsForm();
  await clickButtonAsync("Confirmar alteração");
  expect(saveCourseActionMock).toHaveBeenCalledOnce();
  const formData = saveCourseActionMock.mock.calls[0]?.[0];
  expect(formData).toBeInstanceOf(FormData);
  expect(formData.get("price")).toBe("29,90");
});
```

The helpers must throw when the expected form, price input, or button is absent;
they must not hide test failures with optional chaining.

- [x] **Step 4: Verify RED.** Run:

```powershell
bun test -- "src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx"
```

Expected: current static tests pass and the new interaction tests fail because
the form currently calls `saveCourseAction` immediately and has no price dialog.

### Task 2: Implement the price confirmation

**Files:**
- Modify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`

- [x] **Step 1: Import the existing UI primitives and parser.** Add
`AlertCircleIcon`, the required `AlertDialog*` primitives from
`@/components/ui/alert-dialog`, and `parseCoursePriceToCents` from
`@/features/payments/course-price`.

- [x] **Step 2: Add pending state and preserve the save path.** Define:

```tsx
interface PendingPriceChange {
  formData: FormData;
  priceInCents: number;
}
```

Add `useState<PendingPriceChange | null>(null)`. Extract the current toast and
`startTransition` body into `saveCourseSettings(formData: FormData)`, preserving
the exact existing success and error messages. In `handleSubmit`, prevent the
default event, build `FormData`, parse `price` with `parseCoursePriceToCents`,
and submit immediately when parsing fails or the normalized amount is unchanged.
When the normalized amount differs, store `{ formData, priceInCents }` and do
not call the action.

- [x] **Step 3: Render a controlled AlertDialog.** Return a fragment containing
the existing form and a dialog controlled by `pendingPriceChange !== null`.
Use the established `AlertDialogHeader`, `AlertDialogMedia`, `AlertDialogTitle`,
`AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, and
`AlertDialogAction` composition. The dialog must say
`Confirmar alteração de preço?`, show the current and proposed formatted BRL
prices, and expose `Cancelar` and `Confirmar alteração` buttons.

Cancel or any dialog close clears the pending snapshot without invoking the
action. Confirm captures the stored snapshot, clears the pending state, and
passes that exact `FormData` to `saveCourseSettings` once. Do not re-read the
mutable form after the user has confirmed.

- [x] **Step 4: Verify GREEN.** Run the focused test again:

```powershell
bun test -- "src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx"
```

Expected: all existing and new tests pass without warnings.

### Task 3: Verify the touched surface

**Files:**
- Verify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`
- Verify: `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx`
- Verify: `docs/superpowers/specs/2026-08-16-course-price-confirmation-design.md`
- Verify: `docs/superpowers/plans/2026-08-16-course-price-confirmation.md`

- [x] **Step 1: Run TypeScript.** Execute `bun typecheck`; expected exit code `0`.
- [x] **Step 2: Run Ultracite.** Execute `bun x ultracite check`; expected exit code `0`.
- [x] **Step 3: Run docs validation.** Execute `bun run docs:check`; expected exit code `0`.
- [x] **Step 4: Inspect the diff.** Execute `git diff --check` and `git status --short`; expected only the approved spec, plan, component, and focused test are changed, with no generated or unrelated files.
