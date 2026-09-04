import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { applyPaymentRevocation, rebuildEnrollmentProjection } from "./server";

describe("enrollment projection content release", () => {
  it("locks before reading and emits one safe scheduled event across a retry", async () => {
    const now = new Date("2026-09-04T17:30:00.000Z");
    const anchor = new Date(now);
    const startsAt = new Date("2026-09-04T17:00:00.000Z");
    const expiresAt = new Date("2027-09-04T17:00:00.000Z");
    let previousEnrollment:
      | {
          content_release_mode: "scheduled";
          content_release_started_at: Date;
          expires_at: Date;
          id: string;
          revoked_reason: null;
          starts_at: Date;
          status: "active";
        }
      | undefined;
    const calls: Array<{ params: unknown[]; text: string }> = [];

    const query = vi.fn((text: string, params: unknown[] = []) => {
      calls.push({ params, text });

      if (text.includes("pg_advisory_xact_lock")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("from enrollments") && text.includes("for update")) {
        return Promise.resolve({
          rows: previousEnrollment ? [previousEnrollment] : [],
        });
      }
      if (text.includes("from course_publications")) {
        return Promise.resolve({
          rows: [{ has_delayed_modules: true, id: "publication-1" }],
        });
      }
      if (text.includes("update enrollment_grants")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("min(starts_at)")) {
        return Promise.resolve({
          rows: [{ expires_at: expiresAt, starts_at: startsAt }],
        });
      }
      if (text.includes("insert into enrollments")) {
        expect(text).toContain("content_release_mode");
        expect(text).toContain("content_release_started_at");
        expect(params).toEqual(expect.arrayContaining(["scheduled", anchor]));
        previousEnrollment = {
          content_release_mode: "scheduled",
          content_release_started_at: anchor,
          expires_at: expiresAt,
          id: "enrollment-1",
          revoked_reason: null,
          starts_at: startsAt,
          status: "active",
        };
        return Promise.resolve({ rows: [{ id: "enrollment-1" }] });
      }
      if (text.includes("insert into enrollment_events")) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.reject(new Error(`Unexpected projection query: ${text}`));
    });
    const client = { query } as unknown as PoolClient;

    await rebuildEnrollmentProjection({
      client,
      courseId: "course-1",
      now,
      userId: "user-1",
    });
    await rebuildEnrollmentProjection({
      client,
      courseId: "course-1",
      now,
      userId: "user-1",
    });

    expect(calls[0]).toEqual({
      params: ["user-1", "course-1"],
      text: "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))",
    });
    const scheduledEvents = calls.filter(
      ({ params, text }) =>
        text.includes("insert into enrollment_events") &&
        params[0] === "content_release_scheduled"
    );
    expect(scheduledEvents).toHaveLength(1);
    expect(scheduledEvents[0]?.params[7]).toBe(
      JSON.stringify({ startedAt: anchor.toISOString() })
    );
  });
});

describe("payment revocation", () => {
  it("atomically leaves a terminal paid grant unchanged without events or projection", async () => {
    const query = vi.fn((text: string, _params?: unknown[]) => {
      if (text.includes("pg_advisory_xact_lock")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("update enrollment_grants")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.reject(
        new Error(`Unexpected query after revocation no-op: ${text}`)
      );
    });
    const client = { query } as unknown as PoolClient;

    await expect(
      applyPaymentRevocation({
        client,
        courseId: "course-1",
        now: new Date("2026-07-29T12:00:00.000Z"),
        orderId: "11111111-1111-4111-8111-111111111111",
        reason: "payment_refund",
        userId: "user-1",
      })
    ).resolves.toBe(false);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toBe(
      "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))"
    );
    expect(query.mock.calls[0]?.[1]).toEqual(["user-1", "course-1"]);
    expect(query.mock.calls[1]?.[0]).toContain(
      "and status in ('active', 'expired')"
    );
  });
});
