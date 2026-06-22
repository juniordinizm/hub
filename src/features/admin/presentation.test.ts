import { describe, expect, it } from "vitest";
import {
  getAdminCourseContentSignal,
  getAdminFinancialSignal,
  getAdminOperationSignal,
  summarizeAdminCourseContent,
  summarizeAdminCourseHealth,
  summarizeAdminFinancialHealth,
  summarizeAdminStudentAccess,
} from "./presentation";

describe("admin presentation", () => {
  it("summarizes course health and prioritizes incomplete courses", () => {
    const summary = summarizeAdminCourseHealth([
      {
        hasDescription: true,
        hasPaymentProviderProductId: true,
        hasThumbnail: true,
        moduleCount: 2,
        publishedLessonCount: 8,
        status: "active",
        title: "Curso pronto",
        totalLessonCount: 8,
      },
      {
        hasDescription: false,
        hasPaymentProviderProductId: false,
        hasThumbnail: true,
        moduleCount: 0,
        publishedLessonCount: 0,
        status: "draft",
        title: "Curso incompleto",
        totalLessonCount: 0,
      },
    ]);

    expect(summary).toEqual({
      activeCourses: 1,
      averageReadinessPercent: 60,
      coursesNeedingAttention: [
        {
          missingCount: 4,
          readinessPercent: 20,
          title: "Curso incompleto",
        },
      ],
      draftCourses: 1,
    });
  });

  it("prioritizes failed webhooks over other operation signals", () => {
    expect(
      getAdminOperationSignal({
        coursesNeedingAttention: 3,
        failedWebhooks: 1,
        pendingOrders: 2,
      })
    ).toEqual({
      tone: "attention",
      label: "Revisar webhooks",
      helper: "1 evento com falha pode afetar liberacao de acesso.",
    });
  });

  it("returns a healthy signal when there are no pending issues", () => {
    expect(
      getAdminOperationSignal({
        coursesNeedingAttention: 0,
        failedWebhooks: 0,
        pendingOrders: 0,
      })
    ).toEqual({
      tone: "healthy",
      label: "Operacao saudavel",
      helper: "Catalogo, pedidos e webhooks sem pendencias criticas.",
    });
  });

  it("summarizes student access health", () => {
    const summary = summarizeAdminStudentAccess(
      [
        {
          activeEnrollments: 1,
          courseCount: 1,
          latestExpiration: new Date("2026-07-10T00:00:00.000Z"),
          status: "active",
        },
        {
          activeEnrollments: 0,
          courseCount: 0,
          latestExpiration: null,
          status: "not_enrolled",
        },
      ],
      new Date("2026-06-18T00:00:00.000Z")
    );

    expect(summary).toEqual({
      activeStudents: 1,
      expiringSoonStudents: 1,
      notEnrolledStudents: 1,
      totalStudents: 2,
    });
  });

  it("summarizes financial health from order statuses", () => {
    const summary = summarizeAdminFinancialHealth([
      { amountInCents: 50_000, status: "paid" },
      { amountInCents: 70_000, status: "paid" },
      { amountInCents: 90_000, status: "pending" },
      { amountInCents: 30_000, status: "refunded" },
    ]);

    expect(summary).toEqual({
      averagePaidTicketInCents: 60_000,
      checkoutConversionPercent: 50,
      disputedOrders: 0,
      paidOrders: 2,
      paidRevenueInCents: 120_000,
      pendingOrders: 1,
      pendingRevenueInCents: 90_000,
      refundedOrders: 1,
      totalOrders: 4,
    });
  });

  it("prioritizes disputed financial orders", () => {
    expect(
      getAdminFinancialSignal({
        disputedOrders: 2,
        pendingOrders: 5,
        refundedOrders: 1,
      })
    ).toEqual({
      tone: "attention",
      label: "Disputas abertas",
      helper: "2 pedidos em disputa exige acompanhamento manual.",
    });
  });

  it("summarizes course content health", () => {
    const summary = summarizeAdminCourseContent({
      modules: [{ id: "module-1" }, { id: "module-2" }],
      lessons: [
        {
          durationSeconds: 600,
          contentJson: null,
          isPublished: true,
          lessonType: "video",
          moduleId: "module-1",
          videoEmbedUrl: "https://player.jmvstream.com/evt/secret/video-1",
          videoExternalId: "video-1",
          videoProvider: "jmvstream",
        },
        {
          durationSeconds: 300,
          contentJson: {
            type: "text",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Aula de leitura" }],
                },
              ],
            },
          },
          isPublished: false,
          lessonType: "text",
          moduleId: "module-1",
          videoEmbedUrl: null,
          videoExternalId: null,
          videoProvider: null,
        },
      ],
    });

    expect(summary).toEqual({
      draftLessons: 1,
      emptyModules: 1,
      readyLessons: 2,
      publishedLessons: 1,
      totalDurationSeconds: 900,
      totalLessons: 2,
      withoutContentLessons: 0,
    });
  });

  it("does not count a JMVStream hash as ready content until a player URL is available", () => {
    const summary = summarizeAdminCourseContent({
      modules: [{ id: "module-1" }],
      lessons: [
        {
          durationSeconds: 600,
          contentJson: null,
          isPublished: true,
          lessonType: "video",
          moduleId: "module-1",
          videoEmbedUrl: null,
          videoExternalId: "video-hash",
          videoProvider: "jmvstream",
        },
      ],
    });

    expect(summary.readyLessons).toBe(0);
    expect(summary.withoutContentLessons).toBe(1);
  });

  it("prioritizes missing published lesson content in course content signal", () => {
    expect(
      getAdminCourseContentSignal({
        draftLessons: 2,
        emptyModules: 1,
        totalLessons: 4,
        withoutContentLessons: 1,
      })
    ).toEqual({
      tone: "attention",
      label: "Aulas sem conteudo",
      helper: "1 aula publicada ainda precisa de conteudo.",
    });
  });
});
