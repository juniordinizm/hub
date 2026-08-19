import { describe, expect, it } from "vitest";

import { parseReleaseState } from "./release-state";

describe("release state", () => {
  it("requires independent deployed, verified and documented states", () => {
    expect(
      parseReleaseState({
        deployed: { commit: "abc1234", environment: "staging" },
        documented: { commit: "def5678", environment: "staging" },
        verified: { commit: "abc1234", environment: "staging" },
      })
    ).toEqual({
      documented: { commit: "def5678", environment: "staging" },
      deployed: { commit: "abc1234", environment: "staging" },
      verified: { commit: "abc1234", environment: "staging" },
    });
  });

  it("rejects an unknown environment", () => {
    expect(() =>
      parseReleaseState({
        deployed: { commit: "abc1234", environment: "preview" },
        documented: { commit: "def5678", environment: "staging" },
        verified: { commit: "abc1234", environment: "staging" },
      })
    ).toThrow("deployed.environment is required.");
  });
});
