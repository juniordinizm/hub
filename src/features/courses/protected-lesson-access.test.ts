import { beforeEach, describe, expect, it, vi } from "vitest";

const { connect, lockEnrollmentAggregate, resolveLessonAccessWithClient } =
  vi.hoisted(() => ({
    connect: vi.fn(),
    lockEnrollmentAggregate: vi.fn(),
    resolveLessonAccessWithClient: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ connect }) }));
vi.mock("@/features/enrollments/enrollment-aggregate-lock", () => ({
  lockEnrollmentAggregate,
}));
vi.mock("@/features/enrollments/access", () => ({
  resolveLessonAccessWithClient,
}));

import {
  assertProtectedLessonAccess,
  LessonAccessDeniedError,
} from "./protected-lesson-access";

describe("protected lesson access revalidation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("locks, revalidates, commits and releases for an allowed lesson", async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    connect.mockResolvedValue(client);
    resolveLessonAccessWithClient.mockResolvedValue({
      courseId: "course-1",
      kind: "allowed",
    });

    await expect(
      assertProtectedLessonAccess({
        courseId: "course-1",
        lessonId: "lesson-1",
        userId: "student-1",
      })
    ).resolves.toBeUndefined();

    expect(lockEnrollmentAggregate).toHaveBeenCalledWith(
      client,
      "student-1",
      "course-1"
    );
    expect(resolveLessonAccessWithClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        lessonId: "lesson-1",
        userId: "student-1",
      })
    );
    expect(client.query).toHaveBeenCalledWith("begin");
    expect(client.query).toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back and rejects before a provider call when access is denied", async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    connect.mockResolvedValue(client);
    resolveLessonAccessWithClient.mockResolvedValue({ kind: "denied" });

    await expect(
      assertProtectedLessonAccess({
        courseId: "course-1",
        lessonId: "lesson-1",
        userId: "student-1",
      })
    ).rejects.toBeInstanceOf(LessonAccessDeniedError);

    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.query).not.toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
