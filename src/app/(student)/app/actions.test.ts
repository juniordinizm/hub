import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireSession: vi.fn(),
  setCourseSaleInterest: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/db", () => ({ getPool: vi.fn() }));
vi.mock("@/features/courses/availability-server", () => ({
  setCourseSaleInterest: dependencies.setCourseSaleInterest,
}));
vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience: () => true,
}));
vi.mock("@/features/courses/server", () => ({
  completeLesson: vi.fn(),
  recordLessonWatchProgress: vi.fn(),
}));
vi.mock("@/features/email/server", () => ({
  sendSupportRequestEmail: vi.fn(),
}));
vi.mock("@/features/learning-analytics/server", () => ({
  setLearningAnalyticsPreference: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import { setCourseSaleInterestAction } from "./actions";

describe("setCourseSaleInterestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.setCourseSaleInterest.mockResolvedValue({ interested: true });
  });

  it("uses the authenticated Student identity and revalidates both surfaces", async () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("interested", "true");

    await expect(setCourseSaleInterestAction(formData)).resolves.toEqual({
      interested: true,
    });

    expect(dependencies.setCourseSaleInterest).toHaveBeenCalledWith({
      courseId: "course-1",
      interested: true,
      userId: "student-1",
    });
    expect(dependencies.revalidatePath).toHaveBeenCalledWith("/app");
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/comprar/[slug]",
      "page"
    );
  });

  it("rejects a team account before persisting interest", async () => {
    dependencies.requireSession.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("interested", "true");

    await expect(setCourseSaleInterestAction(formData)).rejects.toThrow(
      "Apenas alunas podem demonstrar interesse."
    );
    expect(dependencies.setCourseSaleInterest).not.toHaveBeenCalled();
  });
});
