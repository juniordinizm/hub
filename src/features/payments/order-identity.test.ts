import type { PoolClient } from "pg";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  type LocalOrderIdentityError,
  type OrderIdentityQueryClient,
  resolveLocalOrderIdentity,
} from "./order-identity";

const COURSE_ID = "course-1";
const ELIGIBLE_STUDENT = {
  course_revoked: false,
  id: "student-1",
  platform_blocked_at: null,
  role: "student",
};
const ORDER_LINK_CAS_PATTERN =
  /update orders[\s\S]*buyer_identity_status\s*=\s*'resolved'[\s\S]*user_id is null[\s\S]*buyer_identity_status\s*=\s*'pending'/i;
const IDENTITY_MUTATION_PATTERN = /update users|email_verified\s*=|password/;
const UNVERIFIED_USER_INSERT_PATTERN =
  /insert into users[\s\S]*email_verified[\s\S]*false[\s\S]*on conflict \(lower\(email\)\) do nothing[\s\S]*returning id/i;
const STUDENT_PROFILE_INSERT_PATTERN =
  /insert into profiles[\s\S]*'student'[\s\S]*on conflict \(user_id\) do nothing/i;
const PROFILE_JOIN_PATTERN = /left join profiles/i;
const COURSE_REVOCATION_PARAMETER_PATTERN = /e\.course_id\s*=\s*\$2/i;
const USER_ID_LOOKUP_PATTERN = /where u\.id\s*=\s*\$1/i;

const publicOrder = (overrides: Record<string, unknown> = {}) => ({
  buyerIdentityStatus: "pending" as const,
  courseId: COURSE_ID,
  customerEmail: "student@example.test",
  customerName: "Student",
  orderId: "order-1",
  userId: null,
  ...overrides,
});

describe("local order identity", () => {
  it("accepts a PostgreSQL transaction client through its narrow interface", () => {
    expectTypeOf<PoolClient>().toExtend<OrderIdentityQueryClient>();
  });

  it("links an eligible existing Student without overwriting identity", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [ELIGIBLE_STUDENT] })
      .mockResolvedValueOnce({ rows: [{ user_id: "student-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "credential-1" }] });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).resolves.toEqual({ activationRequired: false, userId: "student-1" });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(PROFILE_JOIN_PATTERN),
      ["student@example.test", COURSE_ID]
    );
    expect(query.mock.calls[0]?.[0]).toMatch(
      COURSE_REVOCATION_PARAMETER_PATTERN
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(ORDER_LINK_CAS_PATTERN),
      ["order-1", "student-1"]
    );
    expect(query.mock.calls.join("\n")).not.toMatch(IDENTITY_MUTATION_PATTERN);
  });

  it("creates an unverified Student and validates it before linking", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "student-new" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...ELIGIBLE_STUDENT, id: "student-new" }],
      })
      .mockResolvedValueOnce({ rows: [{ user_id: "student-new" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: publicOrder({
          customerEmail: " NEW@Example.test ",
          customerName: " New Student ",
          orderId: "order-new",
        }),
      })
    ).resolves.toEqual({ activationRequired: true, userId: "student-new" });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(UNVERIFIED_USER_INSERT_PATTERN),
      [expect.any(String), "New Student", "new@example.test"]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(STUDENT_PROFILE_INSERT_PATTERN),
      ["student-new"]
    );
  });

  it("creates the user with the same canonical Gmail identity used by Better Auth", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "student-gmail" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...ELIGIBLE_STUDENT, id: "student-gmail" }],
      })
      .mockResolvedValueOnce({ rows: [{ user_id: "student-gmail" }] })
      .mockResolvedValueOnce({ rows: [] });

    await resolveLocalOrderIdentity({
      client: { query },
      order: publicOrder({
        customerEmail: " First.Last+course@googlemail.com ",
      }),
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(UNVERIFIED_USER_INSERT_PATTERN),
      [expect.any(String), "Student", "firstlast@gmail.com"]
    );
  });

  it.each([
    null,
    "admin",
    "support",
  ])("rejects existing non-Student profile role %s", async (role) => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ ...ELIGIBLE_STUDENT, role }],
    });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).rejects.toMatchObject({ code: "buyer_identity_team_account" });
    expect(query).toHaveBeenCalledOnce();
  });

  it("rejects a platform-blocked Student", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ ...ELIGIBLE_STUDENT, platform_blocked_at: new Date() }],
    });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).rejects.toMatchObject({ code: "buyer_identity_platform_blocked" });
  });

  it("rejects a Student revoked from this Course", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ ...ELIGIBLE_STUDENT, course_revoked: true }],
    });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).rejects.toMatchObject({ code: "buyer_identity_course_revoked" });
  });

  it("allows revocation in another Course", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [ELIGIBLE_STUDENT] })
      .mockResolvedValueOnce({ rows: [{ user_id: "student-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).resolves.toEqual({ activationRequired: true, userId: "student-1" });
    expect(query.mock.calls[0]?.[1]).toEqual([
      "student@example.test",
      COURSE_ID,
    ]);
  });

  it("fails closed when an email race converges to an ineligible account", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...ELIGIBLE_STUDENT, id: "race-user", role: "support" }],
      });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).rejects.toMatchObject({ code: "buyer_identity_team_account" });
    expect(query.mock.calls.join("\n")).not.toMatch(
      STUDENT_PROFILE_INSERT_PATTERN
    );
  });

  it("validates an authenticated resolved Student by id without customer PII", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [ELIGIBLE_STUDENT] })
      .mockResolvedValueOnce({ rows: [{ id: "credential-1" }] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: publicOrder({
          buyerIdentityStatus: "resolved",
          customerEmail: "attacker@example.test",
          customerName: "Attacker",
          userId: "student-1",
        }),
      })
    ).resolves.toEqual({ activationRequired: false, userId: "student-1" });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(USER_ID_LOOKUP_PATTERN),
      ["student-1", COURSE_ID]
    );
    expect(query.mock.calls.join("\n")).not.toContain("attacker@example.test");
  });

  it.each([
    ["buyer_identity_team_account", { ...ELIGIBLE_STUDENT, role: "admin" }],
    [
      "buyer_identity_platform_blocked",
      { ...ELIGIBLE_STUDENT, platform_blocked_at: new Date() },
    ],
    [
      "buyer_identity_course_revoked",
      { ...ELIGIBLE_STUDENT, course_revoked: true },
    ],
  ] as const)("rejects authenticated identity with %s", async (code, row) => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [row] });

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: publicOrder({
          buyerIdentityStatus: "resolved",
          userId: "student-1",
        }),
      })
    ).rejects.toMatchObject({ code });
  });

  it("accepts an identical CAS retry without overwriting the linked account", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [ELIGIBLE_STUDENT] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ buyer_identity_status: "resolved", user_id: "student-1" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).resolves.toEqual({ activationRequired: true, userId: "student-1" });
  });

  it("rejects a divergent CAS result", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [ELIGIBLE_STUDENT] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ buyer_identity_status: "resolved", user_id: "other-user" }],
      });

    await expect(
      resolveLocalOrderIdentity({ client: { query }, order: publicOrder() })
    ).rejects.toEqual(
      expect.objectContaining<Partial<LocalOrderIdentityError>>({
        code: "order_identity_conflict",
      })
    );
  });

  it("requires local buyer snapshots for a public order", async () => {
    const query = vi.fn();

    await expect(
      resolveLocalOrderIdentity({
        client: { query },
        order: publicOrder({ customerName: null }),
      })
    ).rejects.toMatchObject({ code: "order_identity_incomplete" });
    expect(query).not.toHaveBeenCalled();
  });
});
