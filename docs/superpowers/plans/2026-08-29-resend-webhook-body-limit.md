# Resend Webhook Body Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Apply the existing 256 KiB Resend webhook limit while the request body is being read, without changing valid Svix verification or persistence behavior.

**Architecture:** Keep the change local to the Resend webhook route. Inspect a trustworthy numeric `Content-Length` before reading, then consume `request.body` incrementally and stop at the first byte above the limit; decode only the bounded byte sequence and pass the resulting text unchanged to the Resend SDK. Preserve the existing sanitized response contract and database transaction flow.

**Tech Stack:** Next.js App Router route, Web Streams API, TypeScript, Vitest, Bun.

---

### Task 1: Add failing HTTP boundary tests

**Files:**
- Modify: `src/app/api/webhooks/resend/route.test.ts`
- Reference: `src/app/api/webhooks/resend/route.ts`

- [ ] **Step 1: Add a test for an oversized declared body.**

Create a `Request` with the existing Svix headers, a small body, and a
`content-length` header equal to `262145`. Spy on the request body reader (or
use a body stream whose `getReader` method is spied on) and assert:

```typescript
expect(response.status).toBe(413);
expect(await response.json()).toEqual({ error: "payload_too_large" });
expect(dependencies.verify).not.toHaveBeenCalled();
expect(dependencies.connect).not.toHaveBeenCalled();
```

The test must prove that the declared size is rejected before the SDK or
database is reached.

- [ ] **Step 2: Add a test for a chunked body that exceeds the limit.**

Build a `ReadableStream<Uint8Array>` that enqueues one chunk of exactly
`262144` bytes and a second one-byte chunk, with no `Content-Length` header.
Pass it to `Request` using `duplex: "half"`. Assert the same `413` response and
zero calls to `verify`, `connect`, and `persistResendWebhookEvent`.

- [ ] **Step 3: Update the valid-body test to assert the public contract.**

Remove the assertion that `request.text()` is called, because the production
route will consume the Web Stream. Keep the assertions that the response is
`200`, the SDK receives the exact `rawBody`, the Svix header object contains
only `id`, `signature`, and `timestamp`, and the normalized event is persisted.

- [ ] **Step 4: Run the focused test and verify RED.**

Run:

```text
bun run test src/app/api/webhooks/resend/route.test.ts
```

Expected result: the existing six tests may pass, but the two new overflow
tests must fail because `request.text()` currently materializes the complete
body before the limit is checked. If either new test passes before the route is
changed, correct the test so it exercises the missing bounded-read behavior.

### Task 2: Implement bounded body consumption

**Files:**
- Modify: `src/app/api/webhooks/resend/route.ts`
- Test: `src/app/api/webhooks/resend/route.test.ts`

- [ ] **Step 1: Add a local bounded-reader result type and helper.**

Keep the helper in the route file because it has one consumer. The helper must:

1. Read `content-length` with `Number`, accepting only a finite safe integer.
2. Return `too_large` when that number is greater than
   `MAXIMUM_WEBHOOK_BODY_BYTES` without touching the body stream.
3. Return an empty successful body when `request.body` is `null` so the SDK
   retains the existing invalid-signature behavior for an empty payload.
4. Use `request.body.getReader()` otherwise.
5. Track `Uint8Array.byteLength`, store only chunks whose accumulated size is at
   most the limit, and cancel the reader when the next chunk would exceed it.
6. Convert the bounded bytes to text once, after reading completes.
7. Return `invalid` when stream reading fails.

Use this shape:

```typescript
type LimitedBodyResult =
  | { kind: "ok"; body: string }
  | { kind: "too_large" }
  | { kind: "invalid" };
```

When cancellation itself fails, ignore that cancellation error and still return
`too_large`; the response must not become a `503` merely because a client
closed an oversized stream.

- [ ] **Step 2: Replace the unbounded `request.text()` call.**

Call the helper after environment validation and before SDK verification:

```typescript
const bodyResult = await readLimitedBody(request);
if (bodyResult.kind === "too_large") {
  return jsonError("payload_too_large", 413);
}
if (bodyResult.kind === "invalid") {
  return jsonError("invalid_payload", 400);
}
const rawBody = bodyResult.body;
```

Do not move environment validation, signature-header validation, SDK
verification, normalization, or the transaction flow. The SDK must continue to
receive the exact bounded `rawBody` text for valid UTF-8 requests.

- [ ] **Step 3: Run the focused test and verify GREEN.**

Run:

```text
bun run test src/app/api/webhooks/resend/route.test.ts
```

Expected result: all tests pass, including both overflow tests. No database
connection is acquired for either oversized request.

### Task 3: Run repository verification

**Files:**
- No additional files.

- [ ] **Step 1: Run formatter/linter checks.**

```text
bun x ultracite check
bun run typecheck
```

Expected result: both commands exit `0` with no new diagnostics.

- [ ] **Step 2: Run the complete test suite and audit.**

```text
bun run test
bun audit --production
```

Expected result: all tests pass and the production audit prints an empty
advisory object (`{}`).

- [ ] **Step 3: Run documentation and migration checks.**

```text
bun run docs:check
bun run db:migrations:check
```

Expected result: canonical documentation is valid and migrations are valid;
no migration is expected for this change.

- [ ] **Step 4: Commit the bounded-read slice.**

```text
git add src/app/api/webhooks/resend/route.ts src/app/api/webhooks/resend/route.test.ts
git commit -m "fix(webhooks): bound resend request body reads"
```

The commit must contain only the route and its direct tests. Do not change
Production configuration, workflow bypasses, Neon retention, Sentry settings,
DMARC policy, or unrelated route coverage in this slice.

### Done criteria

- A declared body above 256 KiB is rejected before stream consumption.
- A missing or under-declared `Content-Length` cannot cause unbounded body
  materialization; the reader is cancelled at the first byte over the limit.
- Valid signed payloads still verify and persist with the exact raw text.
- Existing error statuses and transaction behavior remain unchanged.
- Focused tests, full tests, typecheck, Ultracite, docs check, migrations check,
  and production audit pass.
