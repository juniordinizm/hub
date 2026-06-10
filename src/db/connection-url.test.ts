import { describe, expect, it } from "vitest";
import { withVerifiedSslMode } from "./connection-url";

describe("withVerifiedSslMode", () => {
  it("adds verify-full when sslmode is missing", () => {
    expect(withVerifiedSslMode("postgres://user:pass@localhost:5432/app")).toBe(
      "postgres://user:pass@localhost:5432/app?sslmode=verify-full"
    );
  });

  it("replaces sslmode require to avoid pg connection string warnings", () => {
    expect(
      withVerifiedSslMode(
        "postgres://user:pass@localhost:5432/app?sslmode=require"
      )
    ).toBe("postgres://user:pass@localhost:5432/app?sslmode=verify-full");
  });

  it("keeps explicit non-warning ssl modes", () => {
    expect(
      withVerifiedSslMode(
        "postgres://user:pass@localhost:5432/app?sslmode=disable"
      )
    ).toBe("postgres://user:pass@localhost:5432/app?sslmode=disable");
  });
});
