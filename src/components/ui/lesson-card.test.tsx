import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonCard, type LessonCardProps } from "./lesson-card";

const baseProps: LessonCardProps = {
  durationText: "10 min",
  hasVideo: true,
  status: "available",
  title: "Aula de exemplo",
};

describe("LessonCard", () => {
  it("uses an opaque accessible badge when no lock reason is available", () => {
    const markup = renderToStaticMarkup(
      <LessonCard
        durationText="8 min"
        status="locked"
        thumbnailUrl="/lesson-thumbnail.png"
        title="Aula bloqueada"
      />
    );

    expect(markup).toContain('data-variant="secondary"');
    expect(markup).toContain("bg-secondary");
    expect(markup).toContain("Bloqueada");
    expect(markup).not.toContain('data-variant="destructive"');
    expect(markup).not.toContain("bg-destructive/10");
  });

  it("prefers the lesson thumbnail and keeps cover fitting explicit", () => {
    const markup = renderToStaticMarkup(
      <LessonCard
        {...baseProps}
        fallbackImageUrl="/course-cover.webp"
        thumbnailUrl="https://cdn.example/video-thumb.jpg"
      />
    );

    expect(markup).toContain("video-thumb.jpg");
    expect(markup).not.toContain("course-cover.webp");
    expect(markup).toContain("object-cover");
    expect(markup).toContain("object-center");
  });

  it("uses the course cover when a lesson has no thumbnail", () => {
    const markup = renderToStaticMarkup(
      <LessonCard {...baseProps} fallbackImageUrl="/course-cover.webp" />
    );

    expect(markup).toContain("course-cover.webp");
    expect(markup).toContain('src="/course-cover.webp"');
    expect(markup).not.toContain("/_next/image");
    expect(markup).toContain("object-cover");
  });

  it("keeps the visual fallback when neither image exists", () => {
    const markup = renderToStaticMarkup(<LessonCard {...baseProps} />);

    expect(markup).toContain("bg-gradient-to-br");
    expect(markup).not.toContain("<img");
  });
});
