# Report and artifact schema

The executable schema is represented by `ReviewReport` and `ReviewFinding` in
`../src/protocol.ts`. Markdown remains the human-readable artifact; its hash is
recorded in `state.json`.

## Required report fields

```yaml
schemaVersion: 1
actor: CHATGPT_EXTERNAL_REVIEWER | CODEX_REVIEWER
verdict: READY | NOT_READY | UNRESOLVED
claim: string
evidence: [string, ...]
impact: string
severity: CRITICAL | MAJOR | MINOR | INFO
confidence: HIGH | MEDIUM | LOW
validation: [string, ...]
rollback: [string, ...]
limitations: [string, ...]
coverageLedger:
  examined: [string, ...]
  withoutEvidence: [string, ...]
sources: [string, ...]
commands: [string, ...]
findings: [ReviewFinding, ...]
```

The ledger must state both what was examined and what remained without
evidence. An empty finding list is valid when the report explicitly supports
that result.

## Finding fields

```yaml
localId: EXT-001 | CODEX-001 | ...
equivalenceKey: stable semantic pairing key, not a canonical ID
claim: string
scope: string
evidence: [string, ...]
evidenceKey: stable semantic evidence key
impact: string
severity: CRITICAL | MAJOR | MINOR | INFO
confidence: HIGH | MEDIUM | LOW
priority: integer
validation: [string, ...]
rollback: [string, ...]
lifecycle: OPEN | VERIFIED | REJECTED | NEEDS_EVIDENCE
material: boolean
semantic:
  claimKey: string
  scopeKey: string
  evidenceKey: string
  impactKey: string
  validationKey: string
  rollbackKey: string
```

The semantic keys are reviewer-supplied comparison metadata. Raw prose can
differ while all semantic keys remain equal; that is a textual difference and
does not open debate. A changed semantic key, severity, confidence, priority,
or decisive validation/rollback dimension is a semantic divergence.

## Canonical findings

Local IDs are never reused as canonical IDs. Synthesis creates `F-001`,
`F-002`, and so on, and records the external and Codex local IDs that were
paired. Canonical findings carry:

```yaml
agreement: AGREED | DIVERGENT | UNRESOLVED
lifecycle: OPEN | VERIFIED | REJECTED | NEEDS_EVIDENCE
readiness: READY | NOT_READY | UNRESOLVED
```

`severity` is independent of `lifecycle`; an agreed open critical finding can
produce `agreement: AGREED` and `readiness: NOT_READY` without opening a
debate. A unilateral material finding is `agreement: DIVERGENT` until the
external debate adjudicates it.

## Debate artifact

Each `debate-0N.md` contains only one structured dossier:

```yaml
caseId: string
round: 1..4
conflict: string
codexPosition: string
externalPosition: string
codexEvidence: [string, ...]
externalEvidence: [string, ...]
sourceOfTruth: string
question: string
impact: string
```

Do not attach full state, raw diff, local configuration, cookies, tokens, or
unrelated findings to a debate packet.

## Final report

`final-report.md` is the only user-facing terminal artifact. It contains the
baseline and target SHA, scope, independent review summaries, canonical
findings, accepted/rejected/unilateral findings, resolved disagreements,
uncertainties, verdict, readiness, canonical plan, validation, rollback,
residual risks, and the exact marker:

```text
IMPLEMENTATION_LOCKED
```

It never contains reviewer credentials or a fixed ChatGPT conversation URL.
