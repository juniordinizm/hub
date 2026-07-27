import { describe, expect, it } from "vitest";
import { getMigrationTargetProblems } from "./migration-target";

const DEVELOPMENT_HOST = "ep-silent-leaf-aclmy5uk.us-east-2.aws.neon.tech";

describe("getMigrationTargetProblems", () => {
  it("accepts the expected Development compute with a pooled host alias", () => {
    expect(
      getMigrationTargetProblems(
        {
          DATABASE_URL_DIRECT:
            "postgresql://user:secret@ep-silent-leaf-aclmy5uk-pooler.us-east-2.aws.neon.tech/neondb",
          DEVELOPMENT_DATABASE_HOST: DEVELOPMENT_HOST,
        },
        "development"
      )
    ).toEqual([]);
  });

  it("requires the direct URL and expected Development host", () => {
    expect(getMigrationTargetProblems({}, "development")).toEqual([
      "DATABASE_URL_DIRECT is required",
      "DEVELOPMENT_DATABASE_HOST is required",
    ]);
  });

  it("rejects an invalid PostgreSQL URL", () => {
    expect(
      getMigrationTargetProblems(
        {
          DATABASE_URL_DIRECT: "https://example.com/database",
          DEVELOPMENT_DATABASE_HOST: DEVELOPMENT_HOST,
        },
        "development"
      )
    ).toContain("DATABASE_URL_DIRECT must be a valid PostgreSQL URL");
  });

  it("rejects a different Neon compute", () => {
    expect(
      getMigrationTargetProblems(
        {
          DATABASE_URL_DIRECT:
            "postgresql://user:secret@ep-another-compute.us-east-2.aws.neon.tech/neondb",
          DEVELOPMENT_DATABASE_HOST: DEVELOPMENT_HOST,
        },
        "development"
      )
    ).toContain("DATABASE_URL_DIRECT must target DEVELOPMENT_DATABASE_HOST");
  });

  it("rejects the known Production compute even when configured as expected", () => {
    const productionHost = "ep-hidden-tooth-ac843qc2.us-east-2.aws.neon.tech";

    expect(
      getMigrationTargetProblems(
        {
          DATABASE_URL_DIRECT: `postgresql://user:secret@${productionHost}/neondb`,
          DEVELOPMENT_DATABASE_HOST: productionHost,
        },
        "development"
      )
    ).toContain(
      "DATABASE_URL_DIRECT must not target the Production Neon compute"
    );
  });
});
