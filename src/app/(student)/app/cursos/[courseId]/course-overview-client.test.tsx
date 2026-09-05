import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseOverviewClient } from "./course-overview-client";

describe("CourseOverviewClient scheduled modules", () => {
  it("shows only the future module summary without lesson links or details", () => {
    const markup = renderToStaticMarkup(
      <CourseOverviewClient
        modules={[
          {
            availableAt: null,
            description: "Descrição inicial",
            id: "module-1",
            lessonCount: 1,
            lessons: [],
            releaseState: "available",
            sortOrder: 1,
            title: "Comece aqui",
            totalDurationSeconds: 120,
          },
          {
            availableAt: new Date("2026-09-12T14:30:00.000Z"),
            description: null,
            id: "module-2",
            lessonCount: 4,
            lessons: [],
            releaseState: "time_locked",
            sortOrder: 2,
            title: "Aplicação",
            totalDurationSeconds: 480,
          },
        ]}
        nextLessonId={null}
        previewMode={null}
      />
    );

    expect(markup).toContain("Aplicação");
    expect(markup).toContain("4 aulas");
    expect(markup).toContain("8 min");
    expect(markup).toContain("12/09/2026");
    expect(markup).not.toContain("/app/aulas/");
    expect(markup).not.toContain("Descrição secreta");
  });

  it("keeps completed lessons revisable while hiding pending lessons", () => {
    const markup = renderToStaticMarkup(
      <CourseOverviewClient
        modules={[
          {
            availableAt: new Date("2026-09-12T14:30:00.000Z"),
            description: null,
            id: "module-2",
            lessonCount: 2,
            lessons: [
              {
                availability: { kind: "available" },
                durationSeconds: 60,
                hasVideo: false,
                id: "lesson-completed",
                isCompleted: true,
                title: "Aula já concluída",
                watchedPercent: 100,
              },
            ],
            releaseState: "time_locked",
            sortOrder: 2,
            title: "Aplicação",
            totalDurationSeconds: 120,
          },
        ]}
        nextLessonId={null}
        previewMode={null}
      />
    );

    expect(markup).toContain("1 disponível de 2 aulas");
    expect(markup).toContain("Aula já concluída");
    expect(markup).toContain("/app/aulas/lesson-completed");
  });
});
