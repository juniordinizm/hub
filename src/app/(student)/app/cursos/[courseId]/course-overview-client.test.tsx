import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseOverviewClient } from "./course-overview-client";

describe("CourseOverviewClient scheduled modules", () => {
  it("uses the course thumbnail without optimization only as a fallback", () => {
    const markup = renderToStaticMarkup(
      <CourseOverviewClient
        courseThumbnailUrl="/api/courses/course-1/cover/card"
        modules={[
          {
            availableAt: null,
            description: null,
            id: "module-1",
            lessonCount: 2,
            lessons: [
              {
                availability: { kind: "available" },
                durationSeconds: 60,
                hasVideo: false,
                id: "lesson-text",
                isCompleted: false,
                thumbnailUrl: null,
                title: "Leitura introdutória",
                watchedPercent: 0,
              },
              {
                availability: { kind: "available" },
                durationSeconds: 120,
                hasVideo: true,
                id: "lesson-video",
                isCompleted: false,
                thumbnailUrl: "/api/lessons/lesson-video/thumbnail",
                title: "Aula em vídeo",
                watchedPercent: 0,
              },
            ],
            releaseState: "available",
            sortOrder: 1,
            title: "Fundamentos",
            totalDurationSeconds: 180,
          },
        ]}
        nextLessonId={null}
        previewMode={null}
      />
    );

    expect(markup).toContain('src="/api/courses/course-1/cover/card"');
    expect(markup).not.toContain(
      "/_next/image?url=%2Fapi%2Fcourses%2Fcourse-1%2Fcover%2Fcard"
    );
    expect(markup).toContain(
      "/_next/image?url=%2Fapi%2Flessons%2Flesson-video%2Fthumbnail"
    );
    expect(markup).not.toContain("bg-gradient-to-br");
  });

  it("passes the course cover to lessons without their own thumbnail", () => {
    const markup = renderToStaticMarkup(
      <CourseOverviewClient
        courseThumbnailUrl="/course-cover.webp"
        modules={[
          {
            availableAt: null,
            description: null,
            id: "module-1",
            lessonCount: 1,
            lessons: [
              {
                availability: { kind: "available" },
                durationSeconds: 600,
                hasVideo: false,
                id: "lesson-1",
                isCompleted: false,
                thumbnailUrl: null,
                title: "Aula sem vídeo",
                watchedPercent: 0,
              },
            ],
            releaseState: "available",
            sortOrder: 1,
            title: "Módulo 1",
            totalDurationSeconds: 600,
          },
        ]}
        nextLessonId={null}
        previewMode={null}
      />
    );

    expect(markup).toContain("course-cover.webp");
    expect(markup).toContain("object-cover");
  });

  it("shows future lesson cards without lesson links or rich content", () => {
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
            description: "Descrição do módulo futuro",
            id: "module-2",
            lessonCount: 4,
            lessons: [
              {
                availability: {
                  availableAt: new Date("2026-09-12T14:30:00.000Z"),
                  kind: "time_locked",
                },
                durationSeconds: 240,
                hasVideo: true,
                id: "lesson-future",
                isCompleted: false,
                thumbnailUrl: "/thumb-futura.png",
                title: "Aula futura",
                watchedPercent: 0,
              },
            ],
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
    expect(markup).toContain("Aula futura");
    expect(markup).toContain("thumb-futura.png");
    expect(markup).toContain("Em breve");
    expect(markup).not.toContain("Bloqueado");
    expect(markup).not.toContain("Disponível em 12/09/2026");
    expect(markup).toContain("Descrição do módulo futuro");
    expect(markup).not.toContain("4 aulas");
    expect(markup).not.toContain("8 min");
    expect(markup).toContain("12/09/2026");
    expect(markup).not.toContain("rounded-xl bg-muted/10 p-4");
    expect(markup).not.toContain("/app/aulas/");
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

  it("distinguishes time and sequence locked lessons without making them links", () => {
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
                availability: {
                  availableAt: new Date("2026-09-12T14:30:00.000Z"),
                  kind: "time_locked",
                },
                durationSeconds: 60,
                hasVideo: true,
                id: "lesson-time-locked",
                isCompleted: false,
                thumbnailUrl: "/thumb-time.png",
                title: "Aula em breve",
                watchedPercent: 20,
              },
              {
                availability: { kind: "sequence_locked" },
                durationSeconds: 90,
                hasVideo: true,
                id: "lesson-sequence-locked",
                isCompleted: false,
                thumbnailUrl: "/thumb-sequence.png",
                title: "Aula seguinte",
                watchedPercent: 0,
              },
            ],
            releaseState: "time_locked",
            sortOrder: 2,
            title: "Aplicação",
            totalDurationSeconds: 150,
          },
        ]}
        nextLessonId={null}
        previewMode={null}
      />
    );

    expect(markup).toContain("Em breve");
    expect(markup).toContain("Continue a sequência");
    expect(markup).toContain("thumb-time.png");
    expect(markup).toContain("thumb-sequence.png");
    expect(markup).toContain('style="width:20%"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toContain("Bloqueada");
    expect(markup.match(/Em breve/g)).toHaveLength(2);
    expect(markup).not.toContain("/app/aulas/lesson-time-locked");
    expect(markup).not.toContain("/app/aulas/lesson-sequence-locked");
  });

  it("keeps completed lessons linkable without a lock reason copy", () => {
    const markup = renderToStaticMarkup(
      <CourseOverviewClient
        modules={[
          {
            availableAt: null,
            description: null,
            id: "module-1",
            lessonCount: 2,
            lessons: [
              {
                availability: {
                  availableAt: new Date("2026-09-12T14:30:00.000Z"),
                  kind: "time_locked",
                },
                durationSeconds: 60,
                hasVideo: true,
                id: "lesson-completed-time",
                isCompleted: true,
                title: "Aula concluída no tempo",
                watchedPercent: 100,
              },
              {
                availability: { kind: "sequence_locked" },
                durationSeconds: 90,
                hasVideo: false,
                id: "lesson-completed-sequence",
                isCompleted: true,
                title: "Aula concluída na sequência",
                watchedPercent: 100,
              },
            ],
            releaseState: "available",
            sortOrder: 1,
            title: "Fundamentos",
            totalDurationSeconds: 150,
          },
        ]}
        nextLessonId={null}
        previewMode={null}
      />
    );

    expect(markup).toContain("/app/aulas/lesson-completed-time");
    expect(markup).toContain("/app/aulas/lesson-completed-sequence");
    expect(markup).not.toContain("Em breve");
    expect(markup).not.toContain("Continue a sequência");
  });
});
