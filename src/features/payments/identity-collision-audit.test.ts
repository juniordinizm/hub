import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
const MUTATION_SQL_PATTERN = /insert|update|delete/i;

vi.mock("@/db", () => ({ getPool: () => ({ query }) }));

import {
  findBuyerIdentityCollisions,
  scanBuyerIdentityCollisions,
} from "./identity-collision-audit";

beforeEach(() => {
  query.mockReset();
});

describe("buyer identity collision audit", () => {
  it("reports canonical collisions without changing original addresses", () => {
    expect(
      findBuyerIdentityCollisions([
        { email: "First.Last+course@gmail.com", userId: "user-1" },
        { email: "firstlast@gmail.com", userId: "user-2" },
        { email: "unique@example.com", userId: "user-3" },
      ])
    ).toEqual([
      {
        canonicalEmail: "firstlast@gmail.com",
        originalEmails: ["First.Last+course@gmail.com", "firstlast@gmail.com"],
        userIds: ["user-1", "user-2"],
      },
    ]);
  });

  it("scans users in bounded keyset batches without mutating them", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { email: "one@example.com", user_id: "user-1" },
          { email: "two@example.com", user_id: "user-2" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { email: "First.Last+course@gmail.com", user_id: "user-3" },
          { email: "firstlast@gmail.com", user_id: "user-4" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      scanBuyerIdentityCollisions({ batchSize: 2 })
    ).resolves.toEqual([
      {
        canonicalEmail: "firstlast@gmail.com",
        originalEmails: ["First.Last+course@gmail.com", "firstlast@gmail.com"],
        userIds: ["user-3", "user-4"],
      },
    ]);

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0]?.[1]).toEqual(["", 2]);
    expect(query.mock.calls[1]?.[1]).toEqual(["user-2", 2]);
    expect(String(query.mock.calls[0]?.[0])).toContain("order by id::text asc");
    expect(String(query.mock.calls[0]?.[0])).not.toMatch(MUTATION_SQL_PATTERN);
  });
});
