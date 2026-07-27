import { describe, expect, it } from "vitest";
import { assertSharedDevelopmentDatabase } from "./shared-development-database";

describe("shared Development database target", () => {
  it("accepts the explicitly confirmed Development Neon host", () => {
    expect(
      assertSharedDevelopmentDatabase({
        confirmation: "development",
        databaseUrl:
          "postgresql://owner:secret@ep-development-pooler.sa-east-1.aws.neon.tech/neondb",
        expectedHost: "ep-development.sa-east-1.aws.neon.tech",
      })
    ).toEqual({
      databaseName: "neondb",
      host: "ep-development.sa-east-1.aws.neon.tech",
    });
  });

  it("rejects the Production compute without exposing credentials", () => {
    const databaseUrl =
      "postgresql://owner:super-secret@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb";

    expect(() =>
      assertSharedDevelopmentDatabase({
        confirmation: "development",
        databaseUrl,
        expectedHost: "ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Shared Development seed refuses the Production Neon compute.");

    try {
      assertSharedDevelopmentDatabase({
        confirmation: "development",
        databaseUrl,
        expectedHost: "ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech",
      });
    } catch (error) {
      expect((error as Error).message).not.toContain("super-secret");
    }
  });

  it("rejects a hostname that differs from the explicit confirmation", () => {
    expect(() =>
      assertSharedDevelopmentDatabase({
        confirmation: "development",
        databaseUrl:
          "postgresql://owner:secret@ep-other.sa-east-1.aws.neon.tech/neondb",
        expectedHost: "ep-development.sa-east-1.aws.neon.tech",
      })
    ).toThrow(
      "Shared Development database host does not match DEVELOPMENT_DATABASE_HOST."
    );
  });

  it("rejects a missing confirmation", () => {
    expect(() =>
      assertSharedDevelopmentDatabase({
        confirmation: undefined,
        databaseUrl:
          "postgresql://owner:secret@ep-development.sa-east-1.aws.neon.tech/neondb",
        expectedHost: "ep-development.sa-east-1.aws.neon.tech",
      })
    ).toThrow(
      "Set SHARED_DEVELOPMENT_SEED_CONFIRMATION=development to run this seed."
    );
  });

  it("rejects localhost because this command is only for the shared Neon branch", () => {
    expect(() =>
      assertSharedDevelopmentDatabase({
        confirmation: "development",
        databaseUrl: "postgresql://owner:secret@localhost:5432/neondb",
        expectedHost: "localhost",
      })
    ).toThrow("Shared Development seed requires a remote Neon host.");
  });
});
