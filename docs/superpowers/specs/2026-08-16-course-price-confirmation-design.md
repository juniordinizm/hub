# Course Price Confirmation — Design

**Date:** 2026-08-16
**Status:** Approved for implementation
**Scope:** Admin Course settings form and price-edit confirmation flow

## Outcome

When an Admin submits the Course settings form with a different price, the Hub
will show an explicit confirmation dialog before persisting the complete settings
form. Saving other Course settings without changing the price will keep the
current behavior. The confirmation is a user-interface safeguard only; it does
not add password reauthentication, a new permission, a migration, or a new
server-side authorization contract.

## Existing pattern

The Admin UI already uses `AlertDialog` for impactful actions such as blocking
platform access, blocking Course access, deleting FAQ items, and removing
uploaded media. The common interaction is an explicit trigger, a cancel action,
and a confirm action that continues the original operation. The Course settings
form currently owns its submit handler and calls `saveCourseAction` directly, so
the price confirmation must preserve that existing action and its toast/error
behavior.

## Decisions

- The confirmation belongs to `CourseSettingsForm`, the edit form rendered in
  `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`.
- The form compares the submitted price with the current Course price in cents,
  using the existing price parser so equivalent representations do not create a
  false confirmation.
- An invalid price is sent through the existing server validation path and does
  not open a confirmation for an amount that cannot be displayed reliably.
- When the price differs, the form stores the submitted `FormData` snapshot and
  opens an `AlertDialog` with the current and proposed prices.
- `Cancelar` clears the pending snapshot and does not call `saveCourseAction`.
- `Confirmar alteração` submits the stored snapshot exactly once through the
  existing save flow. The current loading, success, error, and server-side
  revalidation behavior remains unchanged.
- The dialog uses accessible title, description, cancel, and confirm controls.
- Course creation forms are unchanged; the safeguard applies to changing the
  price of an existing Course in its settings.

## Alternatives rejected

1. Confirm every settings save. This would interrupt title, description, workload,
   access, status, and payment-offer edits even when the price is unchanged.
2. Split price into a separate Server Action and form. This would duplicate the
   current settings lifecycle and could allow partial Course configuration saves.
3. Add password confirmation or a new server-side token. The requested behavior
   is the existing UI confirmation pattern, not financial reauthentication.

## Data flow

1. The existing form submit validates the browser form and creates `FormData`.
2. If the parsed price is unchanged, the current save handler runs immediately.
3. If the parsed price differs, the handler stores the `FormData` snapshot and
   opens the confirmation dialog.
4. Cancel removes the snapshot.
5. Confirm invokes the same save handler with the snapshot, then clears it.

No database or provider call is made before confirmation. The existing server
action remains the final authority for price parsing, minimum-price validation,
authorization, persistence, audit, and revalidation.

## Verification contract

Tests will cover:

- dialog copy and accessible controls are rendered;
- unchanged price saves without opening the confirmation;
- changed price opens the confirmation and does not call the action early;
- cancel leaves the action uncalled;
- confirm calls the existing action once with the original submitted fields;
- the existing installment and workload settings contracts remain intact.

No canonical domain or operational documentation needs a rule update because the
change does not alter Course pricing rules, authorization, persistence, provider
behavior, or an operational procedure.
