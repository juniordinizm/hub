# Lesson Authoring Validation and Error Feedback

## Context

The lesson creation dialog still marks the description as required, and the server-side draft parser rejects an empty description. The lesson editor itself labels the description as optional, so the two entry points disagree.

The lesson editor saves through a Server Action that currently throws ordinary `Error` instances. Next.js sanitizes errors thrown from Server Components/Server Actions in production, so the browser receives the generic Server Components render message instead of the safe validation reason already present in the domain code.

## Goals

- Require only the lesson title when creating or saving a lesson.
- Keep the existing content rule: a lesson must contain a video, text with content, or at least one material.
- Return expected lesson-authoring failures as serializable action results instead of throwing them through the client boundary.
- Show the safe reason in a toast and in a persistent alert beside the save action.
- Keep unexpected failures sanitized for the browser while preserving a correlation identifier for operational investigation.
- Avoid confirming uploaded resources or writing lesson data when the title/content validation fails.

## Non-goals

- Do not change course or module description requirements.
- Do not change lesson publication/versioning rules.
- Do not change R2 upload signing, CORS, CSP, or file-size policy.
- Do not expose database, provider, URL, stack-trace, or raw Server Action details to an administrator.
- Do not promote to production until the staging deployment and the lesson flows are validated.

## Proposed behavior

### Inputs

The “Nova aula” form will submit an empty description successfully. The draft normalizer will return `description: null` for blank input. The title remains protected by native form validation and by a server-side validation check.

### Expected validation feedback

The lesson action will use a typed result with an `ok` discriminator. Expected, safe authoring failures will return a message and an optional field/category so the client can display the right context. The content failure will say that the lesson needs at least one video, text with content, or material. A missing title will identify the title field.

### Unexpected failures

Unexpected exceptions will be recorded with the existing operational/correlation observability path and will return only a generic retry message plus a support correlation identifier. The client will never render the exception message or the Next.js digest.

### UI

The editor save control will handle the typed result, show the result message in the existing toast, and keep the same message in an accessible `role="alert"` region until the next successful save or a new attempt. The current tabs, upload flow, and pending state remain unchanged.

## Architecture

Keep the lower-level authoring functions responsible for persistence and domain checks. Introduce a small lesson-specific safe error contract for expected validation/domain failures. The server action adapts thrown expected errors into serializable results and maps unknown errors to a safe fallback with a correlation ID. The client consumes the result rather than relying on production error propagation.

Validation will occur before resource-upload confirmation and persistence. Existing version/publication and upload-consistency errors that are intentionally safe for an administrator will use the same lesson error contract; infrastructure failures remain internal.

## Verification

Automated coverage will assert:

1. blank description is accepted by draft normalization and the creation form has no `required` attribute on description;
2. blank title is rejected server-side with a direct title message;
3. an empty lesson is rejected with the direct content message before upload confirmation;
4. the lesson Server Action returns `{ ok: false, message }` for expected failures and a safe correlation-based fallback for unknown failures;
5. the editor renders the failure alert and does not report success when the action returns `ok: false`.

The focused tests, type-check, repository quality checks, and the relevant build will run before staging deployment. Production promotion will happen only after staging is healthy and the lesson creation/save scenarios are manually confirmed.
