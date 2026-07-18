# JMVStream Upload Reliability Design

## Goal

Make lesson-video uploads recoverable, compatible with JMVStream v2, and clear to the administrator at every lifecycle state.

## Scope

- Authenticate with the documented v2 resource-only endpoint.
- Read a video by hash and its conversion job instead of depending on the first page of the video list.
- Keep abandoned uploads from blocking the lesson by expiring them in the scheduled reconciliation.
- Expose actionable retry, discard, and replacement paths in the lesson editor.
- Validate the upload request before signed URLs are created and choose a safe multipart chunk size for large files.

## Design

The server owns the durable lifecycle. It validates an initialization request, stores an upload session, and reconciles `processing` assets using a single-video lookup plus job status. The cron first expires stale `uploading` sessions, then selects processing assets fairly by their latest reconciliation attempt so old permanent failures cannot starve newer uploads.

The client owns only browser transfer state. It presents persisted lifecycle status and sends explicit actions to retry with a new file or discard the failed/abandoned session. Replacing a video never removes the current usable video until its replacement is linked.

## Error handling

The UI distinguishes a failed browser transfer from provider processing. Transfer failure offers a new upload and cleanup; provider failure exposes the actionable provider message and leaves the old lesson video untouched. A job status of `ERROR` transitions the asset to `failed` rather than polling forever.

## Verification

Tests cover v2 authentication, hash lookup/job status, stale cleanup scheduling, fair reconciliation selection, file/chunk validation, and the UI's recovery affordances. Targeted tests, typecheck, and Ultracite check are required before handoff.
