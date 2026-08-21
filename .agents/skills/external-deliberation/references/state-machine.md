# State machine and executable gates

The implementation in `../src/protocol.ts` is the executable contract. State
updates are immutable at the API boundary and are persisted through the case
store with deterministic hashes.

## State meanings

| State | Entry condition | Exit condition |
| --- | --- | --- |
| `IDLE` | No case metadata exists | Case identity is captured |
| `CASE_OPENED` | Case identity is fixed | Baseline is recorded |
| `BASELINED` | SHA, branch, status, and scope are recorded | Skill/config/docs context is loaded |
| `CONTEXT_READY` | Required local context is loaded | Both independent reviews can start |
| `INDEPENDENT_REVIEWING` | Neutral briefs and review inputs are sealed | Both reports validate and seal, or a reviewer blocks |
| `REPORTS_SEALED` | Both report slots are `VALID`, sealed, and hash-matching | Comparator is explicitly allowed |
| `SYNTHESIS` | Reports can be read for the first time | Conflicts enter debate or all findings are adjudicated |
| `DEBATE` | At least one material unilateral/semantic conflict exists | Round resolves or the limit is reached |
| `CONSENSUS_READY` | Agreement is complete and working tree is safe | Final report is sealed |
| `CONSENSUS_NOT_READY` | Agreement exists but readiness is `NOT_READY`, such as an agreed open critical finding | Final report is sealed; authorization stays locked |
| `UNRESOLVED_DISPUTE` | A conflict survives round four or relevant dirty scope blocks proof | Final report preserves both positions |
| `FINAL_REPORT_READY` | `final-report.md` is sealed with `IMPLEMENTATION_LOCKED` | Human decision is requested |
| `HUMAN_DECISION_REQUIRED` | Final report is presented | Explicit case-referenced human decision or rejection |
| `BLOCKED` | Browser, integrity, secret, or scope gate fails | Diagnostic final report or explicit case reopen |
| `CLOSED` | Human decision is recorded | Only an explicit material post-implementation finding can reopen the case |

Normal transitions are:

```text
IDLE -> CASE_OPENED -> BASELINED -> CONTEXT_READY -> INDEPENDENT_REVIEWING
INDEPENDENT_REVIEWING -> REPORTS_SEALED | BLOCKED
REPORTS_SEALED -> SYNTHESIS
SYNTHESIS -> DEBATE | CONSENSUS_READY | CONSENSUS_NOT_READY | UNRESOLVED_DISPUTE | BLOCKED
DEBATE -> SYNTHESIS | UNRESOLVED_DISPUTE | BLOCKED
CONSENSUS_READY -> FINAL_REPORT_READY
CONSENSUS_NOT_READY -> FINAL_REPORT_READY
UNRESOLVED_DISPUTE -> FINAL_REPORT_READY
BLOCKED -> FINAL_REPORT_READY
FINAL_REPORT_READY -> HUMAN_DECISION_REQUIRED -> CLOSED
```

`CLOSED -> CASE_OPENED` is a guarded exception exposed only by
`reopenAfterMaterialFinding`. It preserves the `CASE-ID`, increments the
reopen count, resets report slots, and keeps authorization locked. There is no
implementation state in this machine.

## Hard gates

### Report barrier

`synthesizeReports()` fails unless all of the following are true:

```text
phase == REPORTS_SEALED
external.status == VALID && external.sealed == true
codex.status == VALID && codex.sealed == true
external.hash == hash(external report)
codex.hash == hash(codex report)
```

The external response may have arrived earlier, but it is not readable by the
Codex comparison context before the Codex report has been sealed. A failed
barrier is terminal for that attempted comparison and must not be bypassed by
reordering a caller's arguments.

### Report reissue

`markReportInvalid()` records validation errors and increments only the report's
reissue counter. It does not increment `debate.round`. The same reviewer must
reissue the report; a replacement reviewer is not permitted.

### Debate limit

`beginDebate()` increments the round from zero through four. A non-empty
conflict list after `resolveDebate()` on round four enters
`UNRESOLVED_DISPUTE`; a fifth round throws. Validation failures never reach
this counter.

### Working tree

The fingerprint stores status, changed paths, relevant-scope classification,
diff SHA-256, and secret-scan metadata. It never stores raw diff. An unrelated
dirty tree may continue while its fingerprint remains in state. A relevant
dirty tree makes agreement unresolved and prevents a ready consensus:
`finalizeSynthesis()` enters `CONSENSUS_NOT_READY` with readiness and verdict
`UNRESOLVED`. It cannot silently become `CONSENSUS_READY`; the immutable target
SHA remains the only review source of truth.

### Reviewer availability

Attempts are numbered one through three. Attempt three enters `BLOCKED`.
There is no attempt four and no fallback reviewer.

### Authorization

`finalizeReport()` requires the literal `IMPLEMENTATION_LOCKED` marker and sets
authorization to `LOCKED`. `recordHumanDecision()` accepts an approval only
when the message explicitly references the current `CASE-ID`; unresolved or
blocked cases cannot be approved. The function changes authorization metadata
only. It never executes implementation.

## Integrity

- SHA-256 is the only artifact digest algorithm.
- Markdown is hashed over the exact UTF-8 bytes persisted.
- JSON state is hashed over the package's sorted-key canonical JSON when a JSON
  digest is required.
- State writes use a sibling temporary file and rename; a single logical case
  writer owns updates.
- Verification checks file existence, schema, and current hash before any gate.
- Tamper or parse failure is fail-closed.
- `DeliberationRuntime.synthesize()` verifies the exact persisted Markdown
  bytes and the structured-report hash before pairing findings. A mismatch
  persists `BLOCKED` and does not leave the case usable as `REPORTS_SEALED`.
- The runtime records denied pre-seal external reads in sanitized audit events;
  no event stores report content, diffs, credentials, or browser state.
