import { describe, expect, it } from "vitest";
import {
  getAdminCourseContentSignal,
  getAdminCourseOperationalState,
  getAdminFinancialSignal,
  getAdminOperationSignal,
  summarizeAdminCourseContent,
  summarizeAdminCourseHealth,
  summarizeAdminFinancialHealth,
  summarizeAdminStudentAccess,
} from "./presentation";

const readyOperationalInput = {
  hasDescription: true,
  hasDraft: false,
  hasPublished: true,
  hasReadyLesson: true,
  hasThumbnail: true,
  moduleCount: 1,
  purchaseLink: {
    available: true,
    url: "https://hub.example/comprar/curso-pronto",
  },
  status: "active",
} as const;

describe("admin presentation", () => {
  it("summarizes course health and prioritizes incomplete courses", () => {
    const summary = summarizeAdminCourseHealth([
      {
        hasDescription: true,
        hasThumbnail: true,
        id: "course-ready",
        moduleCount: 2,
        publishedLessonCount: 8,
        status: "active",
        title: "Curso pronto",
        totalLessonCount: 8,
      },
      {
        hasDescription: false,
        hasThumbnail: true,
        id: "course-incomplete",
        moduleCount: 0,
        publishedLessonCount: 0,
        status: "draft",
        title: "Curso incompleto",
        totalLessonCount: 0,
      },
    ]);

    expect(summary).toEqual({
      activeCourses: 1,
      averageReadinessPercent: 63,
      coursesNeedingAttention: [
        {
          id: "course-incomplete",
          missingCount: 3,
          readinessPercent: 25,
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
      label: "Aulas sem conteúdo",
      helper: "1 aula publicada ainda precisa de conteúdo.",
    });
  });

  describe("course operational state", () => {
    it("prioritizes an incomplete identity over every later state", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasDescription: false,
          hasDraft: true,
          hasPublished: false,
          hasReadyLesson: false,
          hasThumbnail: false,
          moduleCount: 0,
          purchaseLink: { available: false, reason: "invalid_price" },
          status: "draft",
        })
      ).toEqual({
        actionLabel: "Completar configurações",
        actionTab: "settings",
        description: "Adicione a descrição e a capa do Curso.",
        key: "identity_incomplete",
        label: "Identidade incompleta",
        tone: "attention",
      });
    });

    it("identifies only the missing Course cover", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasThumbnail: false,
        }).description
      ).toBe("Adicione a capa do Curso.");
    });

    it("identifies only the missing Course description", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasDescription: false,
        }).description
      ).toBe("Adicione a descrição do Curso.");
    });

    it("prioritizes a missing Module over publication", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasPublished: false,
          hasReadyLesson: false,
          moduleCount: 0,
        })
      ).toEqual({
        actionLabel: "Organizar conteúdo",
        actionTab: "content",
        description: "Crie um Módulo para organizar o conteúdo do Curso.",
        key: "content_incomplete",
        label: "Conteúdo incompleto",
        tone: "attention",
      });
    });

    it("distinguishes a Course without a ready Lesson", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasReadyLesson: false,
        }).description
      ).toBe("Prepare ao menos uma Aula com conteúdo para publicação.");
    });

    it("prioritizes missing publication over commercial and status issues", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasPublished: false,
          purchaseLink: { available: false, reason: "invalid_price" },
          status: "draft",
        })
      ).toEqual({
        actionLabel: "Publicar conteúdo",
        actionTab: "content",
        description: "Publique o conteúdo do Curso para disponibilizá-lo.",
        key: "publication_missing",
        label: "Publicação pendente",
        tone: "attention",
      });
    });

    it("treats an explicit unpublished reason as a missing publication", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          purchaseLink: { available: false, reason: "course_unpublished" },
        }).key
      ).toBe("publication_missing");
    });

    it("identifies an invalid commercial offer", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          purchaseLink: { available: false, reason: "invalid_price" },
        })
      ).toEqual({
        actionLabel: "Revisar oferta",
        actionTab: "settings",
        description: "Revise o preço do Curso para liberar a oferta.",
        key: "commercial_incomplete",
        label: "Oferta incompleta",
        tone: "attention",
      });
    });

    it("prioritizes an invalid commercial offer over inactive status", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          purchaseLink: { available: false, reason: "invalid_price" },
          status: "draft",
        }).key
      ).toBe("commercial_incomplete");
    });

    it.each([
      [
        "status",
        {
          ...readyOperationalInput,
          status: "draft",
        },
      ],
      [
        "purchase link reason",
        {
          ...readyOperationalInput,
          purchaseLink: {
            available: false,
            reason: "course_inactive",
          } as const,
        },
      ],
    ])("identifies an inactive Course from its %s", (_source, input) => {
      expect(getAdminCourseOperationalState(input)).toEqual({
        actionLabel: "Revisar publicação",
        actionTab: "settings",
        description:
          "Ative o Curso para disponibilizar sua publicação e oferta.",
        key: "course_inactive",
        label: "Curso inativo",
        tone: "attention",
      });
    });

    it("prioritizes inactive status over a disabled checkout", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          purchaseLink: { available: false, reason: "checkout_disabled" },
          status: "draft",
        }).key
      ).toBe("course_inactive");
    });

    it("reports environment checkout unavailability without an action", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          purchaseLink: { available: false, reason: "checkout_disabled" },
        })
      ).toEqual({
        actionLabel: null,
        actionTab: null,
        description: "O checkout não está disponível no ambiente atual.",
        key: "checkout_unavailable",
        label: "Checkout indisponível",
        tone: "watch",
      });
    });

    it("prioritizes a disabled checkout over pending draft changes", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasDraft: true,
          purchaseLink: { available: false, reason: "checkout_disabled" },
        }).key
      ).toBe("checkout_unavailable");
    });

    it("reports pending draft changes", () => {
      expect(
        getAdminCourseOperationalState({
          ...readyOperationalInput,
          hasDraft: true,
        })
      ).toEqual({
        actionLabel: "Revisar alterações",
        actionTab: "content",
        description: "O Curso está disponível, mas há alterações em preparo.",
        key: "changes_pending",
        label: "Alterações em preparo",
        tone: "watch",
      });
    });

    it("reports a published Course without pending changes as ready", () => {
      expect(getAdminCourseOperationalState(readyOperationalInput)).toEqual({
        actionLabel: null,
        actionTab: null,
        description:
          "O Curso está disponível e não possui alterações pendentes.",
        key: "ready",
        label: "Curso publicado",
        tone: "healthy",
      });
    });
  });
});
