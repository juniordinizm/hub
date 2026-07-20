# AGENTS.md

## Startup

On the first message of a conversation, tell the user:

> AI-Driven Development ON - Date: {current_date}, TZ: {current_timezone}.

## Instruction Priority

When instructions conflict, apply this order:

1. User's explicit request for the current task.
2. Project-specific instructions in this file.
3. More specific local docs under `aidd_docs/`.
4. Tooling output from source-of-truth commands.
5. General coding conventions.

Do not add a new rule until checking whether an existing rule already covers or contradicts it. Merge, delete, or scope overlapping rules instead of creating parallel instructions.

## Operating Principles

* Stay critical. The user can be wrong. Verify claims against the repository before acting.
* Be anti-sycophantic. No flattery, filler, or automatic agreement. Never open with "you are right".
* Challenge weak reasoning and surface tradeoffs with impact.
* Say "I don't know" when unsure, then inspect source, docs, tests, or runtime evidence.
* Do not assume knowledge is current.
* Do not guess APIs, signatures, flags, framework behavior, or file structure. Read source or docs before relying on them.
* Prefer inaction when the requested issue is already fixed or unsupported by evidence.
* Name by intention, not mechanism. Describe responsibility or goal, not file format or implementation detail.

## Communication

* Answer first: result before reason.
* No pleasantries: avoid "sure", "of course", "happy to", and similar filler.
* No preamble or recap. Do not restate the request or summarize visible changes.
* No tool-call narration.
* Evidence over assertion: back "works", "tested", or "fixed" with commands, outputs, or file paths.
* Quote only the shortest decisive error or log line.
* No decorative tables, emoji, or em-dashes unless they carry information.
* Write chat responses for scanning:

  * Fewest words.
  * Fragments over full sentences when clear.
  * Use `=>` for cause/effect.
  * Normal prose only when nuance matters.
* Use full prose for:

  * Security warnings.
  * Irreversible actions.
  * Ordered steps.
  * Explanations where ambiguity would be risky.
* End by stating the single next action you will take, or that nothing is pending.
* Do not provide suggestion menus unless the user asks.

## Execution Discipline

* Make surgical changes. Touch only what the task needs.
* Leave touched code cleaner than you found it.
* Stay focused. Note unrelated issues in one line, but do not detour unless they block the task.
* Solve your own issues first before escalating.
* Ask one sharp question before building only when scope is ambiguous, expensive, or irreversible.
* Batch independent operations in one pass.
* Fan out independent subtasks to parallel subagents only when you own the whole flow and the work is genuinely parallel.
* Do not commit or push unless the user explicitly asks.
* Before changing code, inspect the relevant current files.
* Before patching a bug, try to reproduce or prove it exists.
* After changing code, run the narrowest useful verification command.
* If verification cannot run, state the exact blocker.

## Project Documentation

Canonical project documentation lives in `README.md`, `PRODUCT.md`, `CONTEXT.md`, and `docs/`.

### Required loading

* Start with `docs/README.md` and follow its reading path.
* For behavior changes, read the relevant domain guide and linked ADR/decision before editing code.
* For environment, database, deploy, or provider work, read the matching runbook/integration guide.
* Treat `.0ref/`, `.agents/`, historical Git content, and local tooling as evidence only, not current product authority.
* Update the canonical document in the same change when a contract, rule, variable, integration, migration, cron, or runbook changes.
* Run `bun run docs:check` after documentation changes.

## Next.js Rules

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from training data.

Before writing Next.js code:

1. Read the relevant guide in `node_modules/next/dist/docs/`.
2. Check deprecation notices.
3. Confirm the project’s actual router, runtime, and directory structure.

<!-- END:nextjs-agent-rules -->

## Tooling Source of Truth

This project uses Ultracite, a zero-config preset built on Biome, for formatting and linting.

Use these commands:

* Format and autofix: `bun x ultracite fix`
* Check issues: `bun x ultracite check`
* Diagnose setup: `bun x ultracite doctor`

When code style conflicts with this file, prefer Ultracite/Biome output. Do not manually enforce style rules that the formatter/linter can fix deterministically.

Run `bun x ultracite fix` before committing when commits are requested.

## Code Standards

Write code that is accessible, performant, type-safe, and maintainable. Prefer clarity and explicit intent over clever brevity.

### TypeScript

* Use explicit types for function parameters and return values when they improve clarity.
* Prefer `unknown` over `any` when the type is genuinely unknown.
* Use type narrowing instead of unsafe assertions.
* Use `as const` for immutable literal values.
* Extract magic numbers into named constants.
* Use meaningful names for variables, functions, and types.

### JavaScript and TypeScript Style

* Use `const` by default.
* Use `let` only for reassignment.
* Never use `var`.
* Prefer `for...of` over `.forEach()` and indexed loops.
* Use optional chaining and nullish coalescing where appropriate.
* Prefer template literals over string concatenation.
* Use destructuring when it improves clarity.
* Use arrow functions for callbacks and short functions.

### Async Code

* Always await promises in async functions unless intentionally returning the promise.
* Prefer `async/await` over promise chains.
* Handle async errors meaningfully.
* Do not use async functions as Promise executors.

### React and JSX

* Use function components.
* Do not define components inside other components.
* Call hooks only at the top level.
* Specify hook dependencies correctly.
* Use stable unique keys for iterable elements. Avoid array indices unless no stable key exists.
* Put children between opening and closing tags instead of passing them as props.
* Use semantic HTML before ARIA.
* Provide meaningful alt text for images.
* Preserve heading hierarchy.
* Label form inputs.
* Include keyboard support with mouse interactions.
* Use semantic elements such as `<button>` and `<nav>` instead of divs with roles.

### React 19+

* Use `ref` as a prop instead of `React.forwardRef`.

### Solid, Svelte, Vue, and Qwik

* Use `class` and `for`, not `className` or `htmlFor`.

### Next.js

* Use Next.js `<Image>` for images.
* Use `next/head` or App Router metadata API for head elements, depending on the project’s router.
* Use Server Components for async data fetching instead of async Client Components when supported by the project structure.

### Error Handling and Debugging

* Remove `console.log`, `debugger`, and `alert` from production code.
* Throw `Error` objects with descriptive messages.
* Do not throw strings.
* Do not catch errors only to rethrow them.
* Prefer early returns over nested conditionals.

### Code Organization

* Keep functions focused.
* Keep cognitive complexity low.
* Extract complex conditions into named booleans.
* Group related code together.
* Separate concerns.
* Prefer simple conditionals over nested ternaries.
* Avoid barrel files that re-export everything.

### Security

* Add `rel="noopener"` when using `target="_blank"`.
* Avoid `dangerouslySetInnerHTML` unless required and reviewed.
* Do not use `eval()`.
* Do not assign directly to `document.cookie`.
* Validate and sanitize user input.

### Performance

* Avoid spread syntax in loop accumulators.
* Use top-level regex literals instead of creating regexes in loops.
* Prefer specific imports over namespace imports.
* Prefer framework image components over raw `<img>` when applicable.

## Testing

* Write assertions inside `it()` or `test()` blocks.
* Use `async/await` instead of `done` callbacks.
* Do not commit `.only` or `.skip`.
* Keep test suites reasonably flat.
* Prefer tests that prove user-visible behavior or business logic.
* For bug fixes, add or run a test that reproduces the failure when practical.
* Run the narrowest relevant test first, then broader checks when needed.

## Human Review Areas

Biome and Ultracite catch formatting and many mechanical issues. Spend human attention on:

* Business logic correctness.
* Naming and intent.
* Architecture and data flow.
* Edge cases.
* Accessibility.
* Performance.
* Security.
* User experience.
* Comments for complex logic only; prefer self-documenting code.

## Verification Standard

A task is not "done" until one of these is true:

* The relevant check/test/build command passed.
* The change is documentation-only and was reviewed for consistency.
* Verification could not run, and the blocker is stated explicitly.

When reporting completion, include:

* Files changed.
* Commands run.
* Decisive result.
* Remaining risk, if any.
