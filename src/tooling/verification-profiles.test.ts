import { describe, expect, it, vi } from "vitest";
import {
  getVerificationEnvironmentOverrides,
  runVerificationProfile,
  type VerificationGate,
} from "./verification-profiles";

describe("runVerificationProfile", () => {
  it("runs the quick verification gates in order", () => {
    const executed: VerificationGate[] = [];
    const executor = vi.fn((gate: VerificationGate) => {
      executed.push(gate);
      return 0;
    });

    expect(runVerificationProfile("quick", executor)).toBe(0);
    expect(executed).toEqual([
      "db:migrations:check",
      "typecheck",
      "check",
      "test",
    ]);
  });

  it("adds documentation, build, and dependency gates to the full profile", () => {
    const executed: VerificationGate[] = [];

    expect(
      runVerificationProfile("full", (gate) => {
        executed.push(gate);
        return 0;
      })
    ).toBe(0);
    expect(executed).toEqual([
      "docs:check",
      "db:migrations:check",
      "typecheck",
      "check",
      "test",
      "build",
      "knip",
    ]);
  });

  it("stops at the first failing gate and returns its status", () => {
    const executed: VerificationGate[] = [];

    expect(
      runVerificationProfile("quick", (gate) => {
        executed.push(gate);
        return gate === "typecheck" ? 7 : 0;
      })
    ).toBe(7);
    expect(executed).toEqual(["db:migrations:check", "typecheck"]);
  });

  it("uses isolated synthetic application values only for the build gate", () => {
    expect(getVerificationEnvironmentOverrides("test")).toEqual({});
    expect(getVerificationEnvironmentOverrides("build")).toEqual({
      BETTER_AUTH_SECRET: "verification-build-secret-not-for-deployment",
      BETTER_AUTH_URL: "https://verification-build.invalid",
      CERTIFICATE_PUBLIC_BASE_URL: "https://verification-build.invalid",
      NEXT_PUBLIC_APP_URL: "https://verification-build.invalid",
    });
  });
});
