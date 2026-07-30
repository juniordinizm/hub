import type { PoolClient } from "pg";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  type LocalOrderIdentityError,
  type OrderIdentityQueryClient,
  resolveLocalOrderIdentity,
} from "./order-identity";

const ORDER_LINK_CAS_PATTERN = /update orders[\s\S]*user_id is null/i;
const IDENTITY_MUTATION_PATTERN = /update users|email_verified\s*=|password/;
const UNVERIFIED_USER_INSERT_PATTERN =
  /insert into users[\s\S]*email_verified[\s\S]*false[\s\S]*on conflict \(lower\(email\)\) do nothing/i;
const STUDENT_PROFILE_INSERT_PATTERN =
  /insert into profiles[\s\S]*'student'[\s\S]*on conflict \(user_id\) do nothing/i;

describe("local order identity", () => {
  it("accepts a PostgreSQL transaction client through its narrow interface", () => {
    expectTypeOf<PoolClient>().toExtend<OrderIdentityQueryClient>();
  });

  it("links a public order to an existing account without overwriting identity", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "user-existing" }] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-existing" }] })
      .mockResolvedValueOnce({ rows: [{ id: "credential-1" }] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: {
          customerEmail: "  Student@Example.test ",
          customerName: "Checkout Name",
          orderId: "order-1",
          userId: null,
        },
      })
    ).resolves.toEqual({
      activationRequired: false,
      userId: "user-existing",
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("where lower(email) = $1"),
      ["student@example.test"]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(ORDER_LINK_CAS_PATTERN),
      ["order-1", "user-existing"]
    );
    expect(query.mock.calls.join("\n")).not.toMatch(IDENTITY_MUTATION_PATTERN);
  });

  it("creates an unverified student account with expression-conflict convergence", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "user-winner" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: "user-winner" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: {
          customerEmail: "NEW@Example.test",
          customerName: "New Student",
          orderId: "order-2",
          userId: null,
        },
      })
    ).resolves.toEqual({
      activationRequired: true,
      userId: "user-winner",
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(UNVERIFIED_USER_INSERT_PATTERN),
      [expect.any(String), "New Student", "new@example.test"]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("where lower(email) = $1"),
      ["new@example.test"]
    );
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringMatching(STUDENT_PROFILE_INSERT_PATTERN),
      ["user-winner"]
    );
  });

  it("uses the authenticated account id and ignores checkout identity", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "session-user" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: {
          customerEmail: "attacker@example.test",
          customerName: "Attacker",
          orderId: "order-3",
          userId: "session-user",
        },
      })
    ).resolves.toEqual({
      activationRequired: true,
      userId: "session-user",
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.join("\n")).not.toContain("attacker@example.test");
  });

  it("fails safely when the authenticated account does not exist", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: {
          customerEmail: null,
          customerName: null,
          orderId: "order-missing-user",
          userId: "missing-user",
        },
      })
    ).rejects.toMatchObject({
      code: "order_user_not_found",
      message: "order_user_not_found",
    });
  });

  it("requires local buyer snapshots for a public order", async () => {
    const query = vi.fn();

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: {
          customerEmail: "student@example.test",
          customerName: null,
          orderId: "order-incomplete",
          userId: null,
        },
      })
    ).rejects.toMatchObject({
      code: "order_identity_incomplete",
      message: "order_identity_incomplete",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("fails safely when the order cannot be linked to the resolved account", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "user-existing" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: {
          customerEmail: "student@example.test",
          customerName: "Student",
          orderId: "order-conflict",
          userId: null,
        },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<LocalOrderIdentityError>>({
        code: "order_identity_conflict",
      })
    );
  });
});
