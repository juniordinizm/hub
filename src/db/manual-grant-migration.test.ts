import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("manual grant migrations", () => {
  it("separates manual references from paid order references", async () => {
    const [enumMigration, shapeMigration] = await Promise.all([
      readFile(
        new URL(
          "./migrations/0021_add_manual_grant_source.sql",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "./migrations/0022_manual_enrollment_grants.sql",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

    expect(enumMigration).toContain("'manual'");
    expect(enumMigration).toContain("'manual_access_granted'");
    expect(shapeMigration).toContain("rename column source_id to order_id");
    expect(shapeMigration).toContain("manual_reference");
    expect(shapeMigration).toContain("enrollment_grants_source_shape_check");
    expect(shapeMigration).toContain("source_type::text = 'manual'");
  });
});
