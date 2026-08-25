import { describe, expect, it } from "vitest";

import { parseReleaseState, parseReleaseStateDocument } from "./release-state";

describe("release state", () => {
  it("requires independent deployed, verified and documented states", () => {
    const deployedCommit = "a".repeat(40);
    const documentedCommit = "b".repeat(40);
    expect(
      parseReleaseState({
        deployed: { commit: deployedCommit, environment: "staging" },
        documented: { commit: documentedCommit, environment: "staging" },
        verified: { commit: deployedCommit, environment: "staging" },
      })
    ).toEqual({
      documented: { commit: documentedCommit, environment: "staging" },
      deployed: { commit: deployedCommit, environment: "staging" },
      verified: { commit: deployedCommit, environment: "staging" },
    });
  });

  it("rejects an unknown environment", () => {
    expect(() =>
      parseReleaseState({
        deployed: { commit: "a".repeat(40), environment: "preview" },
        documented: { commit: "b".repeat(40), environment: "staging" },
        verified: { commit: "a".repeat(40), environment: "staging" },
      })
    ).toThrow("deployed.environment is required.");
  });

  it("rejects abbreviated and malformed commit identifiers", () => {
    expect(() =>
      parseReleaseState({
        deployed: { commit: "abc1234", environment: "staging" },
        documented: { commit: "b".repeat(40), environment: "staging" },
        verified: { commit: "a".repeat(40), environment: "staging" },
      })
    ).toThrow("deployed.commit must be a full Git SHA.");
  });

  it("reads the three checkpoints from release-state frontmatter", () => {
    const commit = "a".repeat(40);
    expect(
      parseReleaseStateDocument(`---
deployed_commit: ${commit}
deployed_environment: production
verified_commit: ${commit}
verified_environment: staging
documented_commit: ${commit}
documented_environment: development
---`)
    ).toEqual({
      deployed: { commit, environment: "production" },
      documented: { commit, environment: "development" },
      verified: { commit, environment: "staging" },
    });
  });
});
