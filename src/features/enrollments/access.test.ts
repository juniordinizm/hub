import { describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));

import { resolveCourseAccess, resolveLessonAccess } from "./access";

describe("enrollment access read model", () => {
  it("checks active enrollment and published course before granting course access", async () => {
    query.mockResolvedValue({ rows: [{ id: "enrollment-1" }] });

    await expect(
      resolveCourseAccess({ courseId: "course-1", userId: "student-1" })
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("and c.status = 'active'"),
      ["student-1", "course-1"]
    );
  });

  it("requires an active published lesson for lesson access", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(
      resolveLessonAccess({ lessonId: "lesson-1", userId: "student-1" })
    ).resolves.toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("and l.status = 'active'"),
      ["student-1", "lesson-1"]
    );
  });
});
