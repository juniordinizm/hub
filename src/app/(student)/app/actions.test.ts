import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  completeLesson: vi.fn(),
  createSupportRequest: vi.fn(),
  recordLessonWatchProgress: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireSession: vi.fn(),
  scheduleOutboxDrainAfterResponse: vi.fn(),
  setCourseSaleInterest: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/db", () => ({ getPool: vi.fn() }));
vi.mock("@/features/courses/availability-server", () => ({
  setCourseSaleInterest: dependencies.setCourseSaleInterest,
}));
vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience: () => true,
}));
vi.mock("@/features/courses/server", () => ({
  completeLesson: dependencies.completeLesson,
  recordLessonWatchProgress: dependencies.recordLessonWatchProgress,
}));
vi.mock("@/features/learning-analytics/server", () => ({
  setLearningAnalyticsPreference: vi.fn(),
}));
vi.mock("@/features/support/server", () => ({
  createSupportRequest: dependencies.createSupportRequest,
}));
vi.mock("@/features/outbox/background-drain", () => ({
  scheduleOutboxDrainAfterResponse:
    dependencies.scheduleOutboxDrainAfterResponse,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import {
  completeLessonAction,
  recordLessonWatchProgressAction,
  sendSupportRequestAction,
  setCourseSaleInterestAction,
} from "./actions";

describe("completeLessonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("signals an issued certificate after the final lesson", async () => {
    dependencies.completeLesson.mockResolvedValue({
      certificateIssued: true,
      courseId: "course-1",
      nextLessonId: null,
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-final");

    await expect(completeLessonAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.redirect).toHaveBeenCalledWith(
      "/app/cursos/course-1?certificate=issued"
    );
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });

  it("keeps the course URL clean when no certificate was issued", async () => {
    dependencies.completeLesson.mockResolvedValue({
      certificateIssued: false,
      courseId: "course-1",
      nextLessonId: null,
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-final");

    await expect(completeLessonAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.redirect).toHaveBeenCalledWith("/app/cursos/course-1");
  });

  it("keeps next-lesson navigation unchanged", async () => {
    dependencies.completeLesson.mockResolvedValue({
      certificateIssued: true,
      courseId: "course-1",
      nextLessonId: "lesson-next",
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-current");

    await expect(completeLessonAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.redirect).toHaveBeenCalledWith(
      "/app/aulas/lesson-next"
    );
  });
});

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

describe("recordLessonWatchProgressAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("drains the outbox only when video completion emitted a certificate", async () => {
    dependencies.recordLessonWatchProgress.mockResolvedValue({
      certificateIssued: false,
      completed: true,
      courseId: "course-1",
      nextLessonId: null,
      watchedPercent: 100,
    });

    await expect(
      recordLessonWatchProgressAction({
        currentSeconds: 60,
        durationSeconds: 60,
        eventName: "jmvplayerout-end",
        lessonId: "lesson-1",
      })
    ).resolves.toMatchObject({ completed: true });

    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).not.toHaveBeenCalled();

    dependencies.recordLessonWatchProgress.mockResolvedValueOnce({
      certificateIssued: true,
      completed: true,
      courseId: "course-1",
      nextLessonId: null,
      watchedPercent: 100,
    });

    await recordLessonWatchProgressAction({
      currentSeconds: 60,
      durationSeconds: 60,
      eventName: "jmvplayerout-end",
      lessonId: "lesson-1",
    });
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });
});

describe("sendSupportRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.createSupportRequest.mockResolvedValue(undefined);
  });

  it("persists the request for the outbox instead of sending inline", async () => {
    const formData = new FormData();
    formData.set("subject", "Dúvida controlada");
    formData.set("message", "Mensagem de teste controlada.");
    formData.set("courseTitle", "Curso de suporte");

    await sendSupportRequestAction(formData);

    expect(dependencies.createSupportRequest).toHaveBeenCalledWith({
      courseTitle: "Curso de suporte",
      message: "Mensagem de teste controlada.",
      subject: "Dúvida controlada",
      userId: "student-1",
    });
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });

  it("rejects the request without subject or message", async () => {
    const formData = new FormData();
    formData.set("subject", "");

    await expect(sendSupportRequestAction(formData)).rejects.toThrow(
      "Informe assunto e mensagem para o suporte."
    );
    expect(dependencies.createSupportRequest).not.toHaveBeenCalled();
  });
});
