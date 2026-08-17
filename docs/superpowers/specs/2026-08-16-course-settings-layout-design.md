# Course Settings Layout — Revised Design

**Date:** 2026-08-16
**Status:** Approved for implementation
**Scope:** Admin course detail, Configurações tab

## Problem

The current identity grid reserves `240px` for a cover uploader that renders at
`280px` from the `sm` breakpoint onward. At desktop widths the uploader crosses
into the title and subtitle column. The description is outside that grid, so it
is visually detached from the rest of the course identity.

The current payment ordering exposes the installment ceiling before the Admin
selects card payments. The card checkbox is uncontrolled, so disabling card
does not update the installment input. The public checkout action also opens a
route that cannot be used safely from an Admin or Support session.

## Decision

Keep the single settings Card, but simplify its contents around the order in
which an Admin makes decisions.

1. **Header action:** expose one compact `Link público` copy button. Do not
   expose an action to open the public checkout from this authenticated
   surface. Use the project's Sonner toast for copy success and manual Ctrl+C
   fallback feedback.
2. **Identidade do curso:** use a `280px` cover column at `lg`, matching the
   uploader's existing width. Title, subtitle, and description stay together
   in the adjacent column. Below `lg`, cover and fields stack.
3. **Acesso e publicação:** render workload first and access duration second as
   equivalent fields. Move status to the save footer, beside the save action.
   Workload is a compact full-width dialog trigger showing only the resolved
   hour count. Its dialog offers `Automático` and `Manual`; the manual hours
   field remains disabled until `Manual` is selected, while the automatic
   count stays visible as help text.
4. **Oferta de pagamento:** render price first, then payment methods. Render
   the installment ceiling as a visible select from `1x` to `12x`. Keep it
   visible but disabled when card is disabled. Disable options whose per-
   installment minimum is incompatible with the current price, including a
   price being edited, and preserve the last chosen ceiling when card is
   re-enabled. Prevent the Admin from disabling the final enabled payment
   method.

## Interaction contract

- The stable `/comprar/[slug]` link remains copyable by Admin and is not opened
  within an authenticated Admin/Support session.
- Copy success and manual-copy fallback use Sonner toasts; the fallback input
  remains screen-reader labelled and is selected for Ctrl+C when needed.
- Price remains common to Pix and card and keeps its existing confirmation
  dialog before persistence.
- Pix, card, or both remain valid. At least one method is always enabled in
  the UI and is still validated by `parseCoursePaymentOffer` on the server.
- Installments are meaningful only for card: the select stays visible but is
  disabled when card is disabled, restored when card is enabled again, and
  normalized to `1x` by the existing server rule when the disabled control is
  omitted.
- Workload changes remain local until the existing final save action.

## Implementation boundaries

- Reuse existing Card, Field, Checkbox, Dialog, Input, Button, and Separator
  primitives. No new colors, typography, motion, or shared primitive.
- Preserve server field names and the `saveCourseAction` FormData contract.
- Preserve the price confirmation snapshot, payment warning calculation, and
  all current status options.
- Remove only the public-checkout navigation action; do not change public
  purchase routing or provider behavior.

## Verification contract

- Purchase-link tests assert copy-only behavior and no public checkout anchor.
- Settings-form tests assert identity layout classes without the width mismatch,
  compact workload trigger, conditional installments, protected final payment
  method, restored installment value, and existing price confirmation.
- Run focused tests, Ultracite, typecheck, docs check, full tests, and
  `git diff --check`.
