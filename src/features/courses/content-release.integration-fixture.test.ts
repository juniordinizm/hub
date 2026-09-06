import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  createContentReleaseFixture,
  createContentReleaseFixtureRegistry,
} from "./content-release.integration-fixture";

const MILLISECONDS_PER_DAY = 86_400_000;
const FUTURE_RELEASE_DELAY_DAYS = 8;
const ACCESS_DURATION_DAYS = 365;

describe("content release integration fixture", () => {
  it("derives future boundaries from the received anchor", async () => {
    const now = new Date("2035-06-01T12:00:00.000Z");
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const fixture = await createContentReleaseFixture({
      now,
      pool: { query } as unknown as Pool,
      registry: createContentReleaseFixtureRegistry(),
    });

    expect(fixture.expiresAt).toEqual(
      new Date(now.getTime() + ACCESS_DURATION_DAYS * MILLISECONDS_PER_DAY)
    );
    expect(fixture.futureAvailableAt).toEqual(
      new Date(now.getTime() + FUTURE_RELEASE_DELAY_DAYS * MILLISECONDS_PER_DAY)
    );
  });
});
