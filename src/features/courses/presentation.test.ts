import { describe, expect, it } from "vitest";
import {
  deriveCourseWorkloadHours,
  formatCourseWorkload,
  getCourseAccessPresentation,
  getStudentCatalogAccessPresentation,
  getStudentCoursePrimaryHref,
  groupStudentCatalogCourses,
  summarizeCoursePublicationReadiness,
} from "./presentation";

describe("course presentation helpers", () => {
  it("highlights completed courses before expiration warnings", () => {
    const presentation = getCourseAccessPresentation({
      expiresAt: new Date("2026-06-20T12:00:00.000Z"),
      now: new Date("2026-06-16T12:00:00.000Z"),
      progressPercent: 100,
    });

    expect(presentation).toEqual({
      tone: "completed",
      label: "Curso concluído",
      helper: "Certificado pronto para emitir ou baixar.",
    });
  });

  it("warns when active access is close to expiring", () => {
    const presentation = getCourseAccessPresentation({
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
      now: new Date("2026-06-16T12:00:00.000Z"),
      progressPercent: 40,
    });

    expect(presentation).toEqual({
      tone: "expiring",
      label: "Acesso expira em 15 dias",
      helper: "Priorize as próximas aulas deste curso.",
    });
  });

  it("presents expired and revoked catalog access distinctly", () => {
    expect(
      getStudentCatalogAccessPresentation({
        accessStatus: "expired",
        expiresAt: new Date("2026-06-01T12:00:00.000Z"),
        now: new Date("2026-06-17T12:00:00.000Z"),
        progressPercent: 40,
        revokedReason: null,
      })
    ).toEqual({
      tone: "locked",
      label: "Acesso expirado",
      helper: "Renove o acesso para voltar as aulas.",
    });

    expect(
      getStudentCatalogAccessPresentation({
        accessStatus: "revoked",
        expiresAt: new Date("2027-06-01T12:00:00.000Z"),
        now: new Date("2026-06-17T12:00:00.000Z"),
        progressPercent: 40,
        revokedReason: "abacatepay_dispute",
      })
    ).toEqual({
      tone: "revoked",
      label: "Acesso em analise",
      helper: "Fale com o suporte para regularizar este acesso.",
    });
  });

  it("routes active courses to the next lesson and completed courses to the course overview", () => {
    expect(
      getStudentCoursePrimaryHref({
        courseId: "course-1",
        nextLessonId: "lesson-2",
      })
    ).toBe("/app/aulas/lesson-2");

    expect(
      getStudentCoursePrimaryHref({
        courseId: "course-1",
        nextLessonId: null,
      })
    ).toBe("/app/cursos/course-1");
  });

  it("groups catalog courses by learning state", () => {
    const courses = [
      {
        accessStatus: "none",
        progressPercent: 0,
      },
      {
        accessStatus: "active",
        progressPercent: 100,
      },
      {
        accessStatus: "active",
        progressPercent: 35,
      },
      {
        accessStatus: "expired",
        progressPercent: 80,
      },
    ] as const;

    expect(groupStudentCatalogCourses(courses)).toEqual({
      active: [courses[2]],
      completed: [courses[1]],
      locked: [courses[0], courses[3]],
    });
  });

  it("summarizes publication readiness for admin course operations", () => {
    expect(
      summarizeCoursePublicationReadiness({
        hasDescription: false,
        hasThumbnail: true,
        moduleCount: 1,
        publishedLessonCount: 0,
        totalLessonCount: 2,
      })
    ).toEqual({
      completedCount: 2,
      totalCount: 4,
      percent: 50,
      missingItems: ["Adicionar descrição", "Publicar pelo menos uma aula"],
    });
  });

  it("derives course workload from total lesson seconds rounded up to hours", () => {
    expect(deriveCourseWorkloadHours([1800, 1801])).toBe(2);
    expect(deriveCourseWorkloadHours([1800, 1799])).toBe(1);
    expect(deriveCourseWorkloadHours([])).toBe(0);
  });

  it("formats course workload rounded up to the nearest minute", () => {
    expect(formatCourseWorkload(0)).toBe("0min");
    expect(formatCourseWorkload(30)).toBe("1min");
    expect(formatCourseWorkload(180)).toBe("3min");
    expect(formatCourseWorkload(1801)).toBe("31min");
    expect(formatCourseWorkload(3600)).toBe("1h");
    expect(formatCourseWorkload(5400)).toBe("1h 30min");
    expect(formatCourseWorkload(5401)).toBe("1h 31min");
    expect(formatCourseWorkload(7200)).toBe("2h");
  });
});
