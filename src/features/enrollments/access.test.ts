import { describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));

import { resolveCourseAccess, resolveLessonAccess } from "./access";

describe("enrollment access read model", () => {
  it("checks active enrollment and published course before granting course access", async () => {
    query.mockResolvedValue({
      rows: [
        {
          content_release_mode: "full_access",
          content_release_started_at: null,
          course_id: "course-1",
          is_completed: false,
          release_delay_days: 8,
        },
      ],
    });

    await expect(
      resolveCourseAccess({ courseId: "course-1", userId: "student-1" })
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("and c.status = 'active'"),
      ["student-1", "course-1"]
    );
    const sql = query.mock.calls.at(-1)?.[0] as string;
    expect(sql).toContain("join course_publications cp");
    expect(sql).toContain("cp.course_id = c.id");
    expect(sql).toContain("cp.status = 'published'");
  });

  it("allows a full-access lesson and returns its course", async () => {
    query.mockResolvedValue({
      rows: [
        {
          content_release_mode: "full_access",
          content_release_started_at: null,
          course_id: "course-1",
          is_completed: false,
          release_delay_days: 8,
        },
      ],
    });

    await expect(
      resolveLessonAccess({ lessonId: "lesson-1", userId: "student-1" })
    ).resolves.toEqual({ courseId: "course-1", kind: "allowed" });
  });

  it("returns a temporal lock until the exact release boundary", async () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          content_release_mode: "scheduled",
          content_release_started_at: new Date("2026-09-04T00:00:00.000Z"),
          course_id: "course-1",
          is_completed: false,
          release_delay_days: 1,
        },
      ],
    });

    await expect(
      resolveLessonAccess({ lessonId: "lesson-1", now, userId: "student-1" })
    ).resolves.toEqual({
      availableAt: new Date("2026-09-05T00:00:00.000Z"),
      courseId: "course-1",
      kind: "time_locked",
    });
    await expect(
      resolveLessonAccess({
        lessonId: "lesson-1",
        now: new Date("2026-09-05T00:00:00.000Z"),
        userId: "student-1",
      })
    ).resolves.toEqual({ courseId: "course-1", kind: "allowed" });
  });

  it("lets an earlier completion bypass the temporal lock", async () => {
    query.mockResolvedValue({
      rows: [
        {
          content_release_mode: "scheduled",
          content_release_started_at: new Date("2026-09-04T00:00:00.000Z"),
          course_id: "course-1",
          is_completed: true,
          release_delay_days: 8,
        },
      ],
    });

    await expect(
      resolveLessonAccess({ lessonId: "lesson-1", userId: "student-1" })
    ).resolves.toEqual({ courseId: "course-1", kind: "allowed" });
  });

  it("denies missing, invalid, and anchorless lesson access", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(
      resolveLessonAccess({ lessonId: "lesson-1", userId: "student-1" })
    ).resolves.toEqual({ kind: "denied" });
    query.mockResolvedValue({
      rows: [
        {
          content_release_mode: "scheduled",
          content_release_started_at: null,
          course_id: "course-1",
          is_completed: false,
          release_delay_days: 8,
        },
      ],
    });
    await expect(
      resolveLessonAccess({ lessonId: "lesson-1", userId: "student-1" })
    ).resolves.toEqual({ kind: "denied" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("and l.status = 'active'"),
      ["student-1", "lesson-1"]
    );
    const sql = query.mock.calls.at(-1)?.[0] as string;
    expect(sql).toContain("join course_publications cp");
    expect(sql).toContain("cp.status = 'published'");
    expect(sql).toContain("cp.id = l.course_publication_id");
    expect(sql).toContain("content_release_started_at");
    expect(sql).toContain("release_delay_days");
  });
});
