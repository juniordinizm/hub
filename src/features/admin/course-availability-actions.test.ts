import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  archiveCourse: vi.fn(),
  revalidatePath: vi.fn(),
  requireRole: vi.fn(),
  restoreCourse: vi.fn(),
  setCourseAvailability: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/features/courses/availability-server", () => ({
  archiveCourse: dependencies.archiveCourse,
  restoreCourse: dependencies.restoreCourse,
  setCourseAvailability: dependencies.setCourseAvailability,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));

import {
  archiveCourseAction,
  restoreCourseAction,
  saveCourseAvailabilityAction,
} from "./course-availability-actions";

describe("Course availability actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.setCourseAvailability.mockResolvedValue({
      checkoutCancellationsEnqueued: 2,
      notificationsEnqueued: 0,
      preset: "sales_paused",
    });
  });

  it("parses the availability form and authenticates an Admin", async () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("preset", "sales_paused");
    formData.set("showInCatalog", "on");

    await expect(saveCourseAvailabilityAction(formData)).resolves.toEqual({
      checkoutCancellationsEnqueued: 2,
      notificationsEnqueued: 0,
      ok: true,
    });
    expect(dependencies.setCourseAvailability).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      courseId: "course-1",
      launchDate: null,
      launchLandingUrl: null,
      preset: "sales_paused",
      showInCatalog: true,
    });
  });

  it("keeps archive and restore as explicit commands", async () => {
    dependencies.archiveCourse.mockResolvedValue({ preset: "archived" });
    dependencies.restoreCourse.mockResolvedValue({ preset: "sales_paused" });

    await archiveCourseAction("course-1");
    await restoreCourseAction("course-1");

    expect(dependencies.archiveCourse).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      courseId: "course-1",
    });
    expect(dependencies.restoreCourse).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      courseId: "course-1",
    });
  });
});
