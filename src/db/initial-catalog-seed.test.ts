import { describe, expect, it } from "vitest";
import { runInitialCatalogSeed } from "./initial-catalog-seed";

interface QueryCall {
  statement: string;
  values: unknown[] | undefined;
}

const createSeedClient = () => {
  const calls: QueryCall[] = [];
  let generatedId = 0;

  return {
    calls,
    client: {
      query: (statement: string, values?: unknown[]) => {
        calls.push({ statement, values });
        generatedId += 1;
        return Promise.resolve({ rows: [{ id: `id-${generatedId}` }] });
      },
    },
  };
};

describe("runInitialCatalogSeed", () => {
  it("uses only columns that exist in the current catalog schema", async () => {
    const { calls, client } = createSeedClient();

    await runInitialCatalogSeed(client);

    const statements = calls.map((call) => call.statement).join("\n");

    expect(statements).not.toContain("lesson_type");
    expect(statements).not.toContain("color");
    expect(statements).not.toContain("category");
    expect(statements).toContain("video_duration_seconds");
    expect(statements).toContain("is_published");
  });

  it("uses domain keys and a transaction lock to make catalog rows idempotent", async () => {
    const { calls, client } = createSeedClient();

    await runInitialCatalogSeed(client);

    const statements = calls.map((call) => call.statement).join("\n");

    expect(statements).toContain("on conflict (slug) do update");
    expect(statements).toContain("pg_advisory_xact_lock");
    expect(statements).toContain("where course_id = $1 and title = $2");
    expect(statements).toContain("where module_id = $1 and title = $2");
    expect(statements).not.toContain("on conflict (course_id, sort_order)");
    expect(statements).not.toContain("on conflict (module_id, sort_order)");
  });

  it("does not duplicate FAQ rows when the schema has no FAQ unique constraint", async () => {
    const { calls, client } = createSeedClient();

    await runInitialCatalogSeed(client);

    const statements = calls.map((call) => call.statement).join("\n");

    expect(statements).toContain("where not exists");
    expect(statements).toContain("question = candidate.question");
  });
});
