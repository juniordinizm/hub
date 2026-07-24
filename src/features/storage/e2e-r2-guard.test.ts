import { describe, expect, it } from "vitest";
import { requireIsolatedE2eR2Bucket } from "./e2e-r2-guard";

describe("requireIsolatedE2eR2Bucket", () => {
  it("accepts an explicitly confirmed E2E bucket", () => {
    expect(
      requireIsolatedE2eR2Bucket({
        E2E_R2_BUCKET_NAME: "hub-e2e-private",
        R2_BUCKET_NAME: "hub-e2e-private",
      })
    ).toBe("hub-e2e-private");
  });

  it.each([
    [{ R2_BUCKET_NAME: "hub-e2e-private" }, "E2E_R2_BUCKET_NAME"],
    [{ E2E_R2_BUCKET_NAME: "hub-e2e-private" }, "R2_BUCKET_NAME"],
    [
      {
        E2E_R2_BUCKET_NAME: "hub-e2e-private",
        R2_BUCKET_NAME: "hub-production-private",
      },
      "must exactly match",
    ],
  ])("rejects an unsafe bucket environment", (environment, message) => {
    expect(() => requireIsolatedE2eR2Bucket(environment)).toThrow(message);
  });
});
