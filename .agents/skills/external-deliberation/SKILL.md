---
name: external-deliberation
description: Use when a user explicitly requests independent ChatGPT review, production-readiness adjudication, broad architecture review, or another high-risk technical decision that must be deliberated through the configured browser reviewer.
---

# External Deliberation Orchestrator

This skill is activated only by an explicit user request. Once activated, it
persists for the conversation. It defines the external-deliberation process;
it does not define product behavior, coding standards, documentation policy,
or provider contracts.

`AGENTS.md` remains authoritative for repository, product, code, and canonical
documentation rules. This skill is authoritative only for the orchestration
protocol while it is explicitly active. Do not edit or duplicate `AGENTS.md` to
make this skill work.

## Non-negotiable boundaries

- The external reviewer is the configured ChatGPT Browser Use reviewer. It is
  never replaced by a Codex subagent, another model, or a local approximation.
- The reviewer and Codex produce independent reports against the same immutable
  target SHA. Codex must finish and seal its own report before opening,
  reading, or consuming the external report.
- A comparator may run only when both report slots are `VALID`, sealed, and
  still match their recorded hashes.
- External messages use a new reviewer conversation for every `CASE-ID`.
- The protocol ends in a final report. It never starts implementation and never
  treats consensus or readiness as authorization.
- `AGENTS.md`, secrets, cookies, tokens, headers, local configuration, and raw
  working-tree diff never enter a reviewer brief or a case artifact.

If the temporal information barrier cannot be audited, enter `BLOCKED`. Do not
degrade to a shared review, reuse a conversation, or substitute a reviewer.

## Required loading order

Before opening a case, read:

1. this `SKILL.md` and only the linked references needed for the case;
2. `.codex/external-reviewer.local.md` without copying its values into reports;
3. repository `AGENTS.md`;
4. `docs/README.md`, then `README.md`, `PRODUCT.md`, `CONTEXT.md`, and the
   relevant canonical domain, ADR, and runbook documents.

The local reviewer configuration must contain a base URL, transport, and
limits. It must not contain a fixed conversation URL. It remains ignored.

## Case lifecycle

Create a new case when the repository, target SHA, objective, or scope changes.
Additional evidence for the same immutable target and objective stays in the
same case. Build the ID from repository identity, target SHA, task hash, and a
fresh run ID:

```text
<repository>-<sha>-<task-hash>-<run-id>
```

Persist only under the ignored local directory:

```text
.codex/deliberations/<CASE-ID>/
  state.json
  baseline.md
  external-review.md
  codex-review.md
  synthesis.md
  debate-01.md ... debate-04.md
  final-report.md
```

The state engine in `src/protocol.ts` and `src/case-store.ts` is the executable
gate. `src/runtime.ts` is the case-level adapter that must own persistence,
review-input delivery, report reads, synthesis, and final-report writes. The
complete transition table and invariants are in
`references/state-machine.md`.

Required phases, in uppercase, are:

```text
IDLE -> CASE_OPENED -> BASELINED -> CONTEXT_READY
  -> INDEPENDENT_REVIEWING -> REPORTS_SEALED -> SYNTHESIS
  -> DEBATE (zero or more, max four) -> CONSENSUS_READY
                                      -> CONSENSUS_NOT_READY
                                      -> UNRESOLVED_DISPUTE
  -> FINAL_REPORT_READY -> HUMAN_DECISION_REQUIRED -> CLOSED
```

`BLOCKED` is fail-closed and may produce a diagnostic final report. It never
produces consensus. `UNRESOLVED_DISPUTE` preserves both positions and blocks
implementation. `NOT_READY` is a readiness value, not a disagreement value.

`state.json` must include at least:

- case ID, repository, target SHA, branch, task hash, run ID;
- working-tree status, changed paths, relevant-scope classification, diff hash,
  and secret-scan metadata, never raw diff content;
- opaque reviewer thread/tab identifiers, case ID, reconnect attempts, and the
  maximum of three attempts;
- current phase, both report slots, artifact hashes, debate round/max, verdict,
  agreement, readiness, authorization, and human decision;
- an explicit `implementationStarted: false` until a later human workflow
  changes it outside this protocol.

## Independent review sequence

1. Capture repository, branch, immutable `HEAD`, environment, status, and the
   relevant dirty diff classification in `baseline.md`.
2. Create a new reviewer conversation tied to this `CASE-ID`. Store only an
   opaque thread/tab ID in state. A reused thread is a protocol failure.
3. Send the external reviewer a brief built from an explicit allowlist:
   `caseId`, task, target SHA, and pertinent restrictions. Never serialize
   `state.json` into the brief.
4. Start the Codex review from the same neutral baseline. Its allowed inputs are
   task, target SHA, project rules, canonical docs, and the source at that SHA.
   It must not read `external-review.md`, external findings, external tests,
   external recommendations, or a synthesis before sealing `codex-review.md`.
5. Validate and seal both reports. Invalid reports are reissued by the same
   reviewer and do not consume a debate round. A changed byte invalidates the
   corresponding seal.
6. Only after both reports are valid and sealed may Codex read the external
   report, run synthesis, or create canonical finding IDs.

The runtime makes the temporal rule observable: `readReportFor("external",
"CODEX_REVIEW")` fails and records a denied audit event until the Codex report
is valid and sealed. The Codex producer receives only the neutral
`NEUTRAL_BASELINE` input. Do not bypass `DeliberationRuntime` by reading the
case files directly or by calling the pure comparator with unsealed data.

The reports are independent even when the external response arrives first:
arrival is not permission to read it. The Codex report must be sealed first if
the external response is already available.

For a fresh runtime-path smoke, run:

```text
bun .agents/skills/external-deliberation/src/cli.ts smoke
```

The smoke must create a case through `DeliberationRuntime`, deny the early
external read, seal both reports, persist synthesis and the final report, and
leave `implementationStarted` false.

## Report and synthesis rules

The report schema is mandatory and otherwise scope-free. Each report contains
verdict, report claim, evidence, impact, severity, confidence, validation,
rollback, limitations, a coverage ledger, sources, commands, and locally scoped
finding IDs. The finding schema also carries a stable semantic equivalence key
and semantic dimension keys so the comparator can distinguish wording from
meaning. See `references/report-schema.md`.

Each reviewer owns its local IDs. Canonical IDs (`F-001`, `F-002`, ...) are
created only in synthesis. Synthesis must:

- pair equivalent findings;
- record unilateral findings;
- separate fact, inference, and uncertainty;
- apply evidence precedence: target SHA for code/config, provider API/panel
  for provider state, reproducible command/smoke for behavior, and canonical
  project docs for documentation;
- keep `severity`, `lifecycle`, `agreement`, `readiness`, and `authorization`
  as separate dimensions.

Semantic differences in claim, scope, presence, severity, impact, decisive
evidence, confidence, priority, validation, or rollback open debate. A raw
wording difference with equal semantic keys does not. Every material unilateral
finding opens debate automatically.

## Debate

Each round sends the external reviewer only a structured dossier containing:

- the conflict;
- Codex position;
- external position;
- evidence for each position;
- applicable source of truth;
- one objective adjudication question;
- impact of the decision.

There are at most four rounds after the independent review pair. A report
validation failure does not consume a round. If the fourth round ends with a
material unresolved conflict, enter `UNRESOLVED_DISPUTE`, preserve both
positions, and keep authorization `LOCKED`.

If Browser Use fails, retry at most three times. The third failure enters
`BLOCKED`; only diagnosis and evidence collection are allowed. Never use a
Codex subagent or another reviewer as fallback.

## Final report and human decision

`final-report.md` must include baseline/SHA, scope, both independent review
summaries, canonical findings, accepted/rejected/unilateral findings, resolved
disagreements, uncertainty, verdict, readiness, canonical plan, validation,
rollback, residual risks, and the literal state marker:

```text
IMPLEMENTATION_LOCKED
```

The final report does not authorize code changes. A later implementation
request must explicitly reference the case, for example:

```text
Implementar o plano do CASE-ID <id>.
```

`sim`, `pode fazer`, or another ambiguous acknowledgement is rejected. A
request for a different SHA, objective, or scope opens a new case. Material
findings discovered after implementation reopen the same case for a new
independent review; they do not silently amend a sealed report.

## Verification

Run the package-local suite with:

```text
bun x vitest run --config .agents/skills/external-deliberation/vitest.config.ts
```

It must cover the negative gates listed in the user contract: pre-seal
comparison, invalid reissue, unilateral and semantic divergence, textual-only
difference, four-round limit, open critical finding with agreed consensus,
readiness versus consensus, unresolved/blocking states, three reviewer
failures, dirty-tree scope, new conversations, CASE-ID authorization,
post-implementation reopening, tamper detection, secret-canaries, ignored
artifacts, and final-report generation without implementation.

For project-level changes, also follow `AGENTS.md` verification and
documentation rules. Do not commit local configuration or case artifacts.
