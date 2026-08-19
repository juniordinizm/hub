# Resend Neuro Capacitar Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task with verification checkpoints. This change updates the single shared Resend catalog; it does not create environment copies.

**Goal:** Replace the six generic Resend Hosted template bodies with a polished Neuro Capacitar/PROTEA-R visual family while preserving every runtime alias, variable, envelope field, URL responsibility, and plain-text contract.

**Architecture:** Resend remains the source of truth for published HTML and plain text. Each template receives a self-contained, table-based HTML document because Hosted Templates do not provide a repository-local shared partial. All six documents reuse the same visual shell: cream canvas, dark teal branded header, official PROTEA-R logo, white reading card, teal CTA, orange accent, and restrained footer. The Hub code remains unchanged; only the external template content and the canonical documentation of the visual system change.

**Tech Stack:** Resend Hosted Templates, Resend integration tools, inline HTML/CSS, table layout for email clients, existing PROTEA-R SVG asset, Bun documentation checks.

---

## Scope and invariants

- Catalog: the existing Resend Team and the six canonical aliases only.
- Aliases: `auth-password-reset`, `access-released`, `access-expiry-warning`, `certificate-issued`, `course-sales-opened`, `support-request`.
- Runtime variables: preserve the exact keys and types already recorded in `docs/integrations/resend-templates.md`.
- Envelope: preserve the current `from`, `replyTo`, and default subjects; the Hub still sends the runtime subject and URLs.
- Logo: use the absolute public asset URL `https://app.neurocapacitar.com.br/protear/logo-negativo.svg`; do not embed a data URI or create a new logo.
- Colors: `#0f2224`, `#326c71`, `#234e52`, `#d97b34`, `#e8f0f0`, `#7fa8aa`, `#f7f3ef`, `#eadfd8`, `#17292b`.
- Email safety: complete HTML document, table layout, inline styles, absolute image URL, explicit image dimensions, `alt`, `bgcolor`, no CSS gradients, no external fonts, no JavaScript, no forms, no `div` layout, no unresolved variables.
- Publication: update draft, inspect draft, run the structural/content checks, then publish explicitly. Never publish before the draft passes inspection.

### Task 1: Verify the brand asset and current remote contract

**Files:**

- Read: `public/protear/logo-negativo.svg`
- Read: `src/app/globals.css`
- Read: `src/features/email/templates-contract.ts`
- Read: `docs/integrations/resend-templates.md`
- External read: Resend aliases through `resend_list_templates` and full metadata through `resend_get_template`.

- [ ] Confirm the production logo URL responds with the SVG content type and a successful status. Current evidence: the URL returns `503` while the Production application is in maintenance; the canonical URL remains in the published HTML and `alt="PROTEA-R"` is present as a fallback.
- [x] Confirm the six remote aliases are still published before editing.
- [x] Record the current variables, `from`, reply-to, and subjects; none were replaced during the update.

Expected evidence: one verified public logo URL and six existing published aliases with contracts matching the repository.

### Task 2: Build the six branded HTML/plain-text payloads

**Files:**

- Source of design: `docs/superpowers/specs/2026-08-19-resend-neurocapacitar-brand-refresh-design.md`
- No runtime source file changes.
- External targets: six Resend templates by canonical alias.

- [x] Use this shell in every HTML payload: `<!DOCTYPE html>`, `lang="pt-BR"`, viewport metadata, cream `body`, dark teal header table, logo image, white content card, footer.
- [x] Keep the body text at 16px–17px with approximately 1.5–1.6 line-height, headlines at 28px–32px with tight line-height, and small labels at 11px–12px with positive tracking.
- [x] Use a teal CTA with a minimum 44px visual/touch height and a clearly distinguishable secondary link where applicable.
- [x] Add a semantic visual variant to each alias:
  - `auth-password-reset`: security label and a warm security note.
  - `access-released`: positive access status and course summary card.
  - `access-expiry-warning`: orange attention accent and large `DAYS_REMAINING` display.
  - `course-sales-opened`: announcement treatment and course highlight.
  - `certificate-issued`: achievement treatment, certificate code panel, and validation CTA.
  - `support-request`: operational label, structured student/course/subject details, and readable message panel.
- [x] Keep every variable in triple-brace syntax supported by Resend and use no variables outside the existing contract.
- [x] Write equivalent plain text with the same semantic order, links, and important values.

### Task 3: Update each Resend draft without changing the contract

**External operation:** call `mcp__codex_apps__resend_update_template` once per alias with only the new `html` and `text` fields unless metadata must be preserved explicitly.

- [x] Update `auth-password-reset`.
- [x] Update `access-released`.
- [x] Update `access-expiry-warning`.
- [x] Update `certificate-issued`.
- [x] Update `course-sales-opened`.
- [x] Update `support-request`.
- [x] Retrieve the templates after update/publication and confirm aliases, envelope and variables remain intact. The integration exposes the published version after the draft update, so the final inspection was performed immediately after explicit publication.

Expected evidence: six drafts contain the new branded shell, logo reference, expected color tokens, semantic content, and no contract drift.

### Task 4: Validate the drafts before publishing

**External read:** `resend_get_template` for each alias.

- [x] Confirm every published template contains the logo URL exactly once, with `alt`, explicit `width`, explicit `height`, `border="0"`, and `display:block`.
- [x] Confirm every published template contains the required metadata and table attributes.
- [x] Confirm no published template contains unresolved variables, external font imports, JavaScript, or relative image URLs.
- [x] Confirm each variable set is exactly the contract for its alias.
- [x] Confirm each plain-text version includes the important dynamic values and every action URL.
- [x] Confirm `from`, reply-to, alias, and subjects are unchanged from Task 1.

If any check fails, update only the affected draft and repeat this task before publishing.

### Task 5: Publish the validated versions

**External operation:** call `mcp__codex_apps__resend_publish_template` once per alias.

- [x] Publish only after all six payloads passed the local contract checks.
- [x] Retrieve all six templates after publication.
- [x] Confirm every alias reports `published` and no accidental environment-specific alias was created.

### Task 6: Update canonical documentation

**Files:**

- Modify: `docs/integrations/resend-templates.md`
- Modify only if required by the docs checker: `docs/README.md` is already linked.

- [x] Add the approved visual ownership section: Resend owns the branded HTML/plain text, the Hub owns envelope and variables, and the logo URL is the canonical public asset.
- [x] Record the shared visual tokens and the rule that all six aliases use the same family with semantic variants.
- [x] Record that a published template must be revalidated after any editorial change.
- [x] Keep the document clear that there is one shared catalog and no environment copies.
- [x] Run `bun run docs:check`.

### Task 7: Controlled branded smoke test

**Files:**

- Read-only runtime target: `src/features/email/server.ts`
- Read-only contract target: `src/features/email/templates-contract.ts`

- [x] Send one controlled sample through each existing wrapper to the already approved mailbox `juniordiniz56@gmail.com`, using synthetic but representative values.
- [x] Confirm Resend records six new messages with `delivered` status.
- [x] Retrieve the six messages and confirm they include the branded HTML, plain text, logo URL, new semantic sections, no unresolved variables, correct `from`, and expected `Reply-To`.
- [x] Confirm the local server and provider code remain unchanged by this visual-only operation.

### Task 8: Final verification and handoff

- [x] The administrative checker key was not available in the execution shell; six direct Resend metadata/content inspections were used as explicit external verification.
- [x] Run `bun run docs:check` after documentation changes.
- [x] No application source or contract files changed, so the visual-only update required no new application test.
- [x] Report the six aliases, publication status, smoke message status, modified documentation path, and remaining risk: the canonical logo URL currently returns `503` during Production maintenance.

## Plan self-review

- Spec coverage: branding evidence, shell, typography, semantic variants, compatibility, contracts, acceptance criteria, publication workflow, and smoke validation are mapped to Tasks 1–8.
- Placeholder scan: no unfinished marker or vague implementation step is present.
- Type/contract consistency: every alias and variable name matches `templates-contract.ts` and `docs/integrations/resend-templates.md`; `DAYS_REMAINING` remains a string.
- Scope: no code-path, environment topology, Team, domain, or runtime envelope changes are planned.
