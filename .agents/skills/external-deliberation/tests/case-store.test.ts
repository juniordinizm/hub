import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaseStore } from "../src/case-store";
import {
  createInitialState,
  createWorkingTreeFingerprint,
  type DeliberationState,
} from "../src/protocol";

const tempRoots: string[] = [];
const ARTIFACT_ERROR_PATTERN = /artifact|path/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const STATE_ERROR_PATTERN = /schema|state/i;

const makeState = (): DeliberationState =>
  createInitialState({
    branch: "main",
    caseId: "CASE-STORE-TEST",
    repository: "hub",
    reviewer: {
      tabId: null,
      threadId: null,
    },
    runId: "run-store",
    targetSha: "a".repeat(40),
    taskHash: "b".repeat(64),
    workingTree: createWorkingTreeFingerprint({
      diff: "",
      relevant: false,
      status: "",
    }),
  });

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("CaseStore", () => {
  it("persists state and markdown artifacts with hashes", async () => {
    const root = await mkdtemp(join(tmpdir(), "external-deliberation-"));
    tempRoots.push(root);
    const store = new CaseStore(root);
    const state = makeState();

    await store.initialize(state);
    const next = await store.writeMarkdown(
      state,
      "baseline.md",
      "# Baseline\n"
    );
    const stored = await store.readState(state.caseId);

    expect(stored.artifacts["baseline.md"]?.status).toBe("SEALED");
    expect(await store.verifyArtifact(stored, "baseline.md")).toBe(true);
    expect(
      await readFile(join(root, state.caseId, "baseline.md"), "utf8")
    ).toBe("# Baseline\n");
    expect(next.artifacts["baseline.md"]?.sha256).toMatch(HASH_PATTERN);
  });

  it("fails closed when a sealed artifact is tampered with", async () => {
    const root = await mkdtemp(join(tmpdir(), "external-deliberation-"));
    tempRoots.push(root);
    const store = new CaseStore(root);
    const state = makeState();
    await store.initialize(state);
    const next = await store.writeMarkdown(
      state,
      "external-review.md",
      "sealed\n"
    );

    await writeFile(
      join(root, state.caseId, "external-review.md"),
      "tampered\n",
      "utf8"
    );

    expect(await store.verifyArtifact(next, "external-review.md")).toBe(false);
  });

  it("rejects path traversal and unknown artifact names", async () => {
    const root = await mkdtemp(join(tmpdir(), "external-deliberation-"));
    tempRoots.push(root);
    const store = new CaseStore(root);
    const state = makeState();
    await store.initialize(state);

    await expect(
      store.writeMarkdown(state, "../secret.md", "nope")
    ).rejects.toThrow(ARTIFACT_ERROR_PATTERN);
    await expect(
      store.writeMarkdown(state, "external-reviewer.local.md", "nope")
    ).rejects.toThrow(ARTIFACT_ERROR_PATTERN);
  });

  it("fails closed when state.json is malformed or has an unknown phase", async () => {
    const root = await mkdtemp(join(tmpdir(), "external-deliberation-"));
    tempRoots.push(root);
    const store = new CaseStore(root);
    const state = makeState();
    await store.initialize(state);

    await writeFile(
      join(root, state.caseId, "state.json"),
      JSON.stringify({ ...state, phase: "UNKNOWN" }),
      "utf8"
    );

    await expect(store.readState(state.caseId)).rejects.toThrow(
      STATE_ERROR_PATTERN
    );
  });
});
