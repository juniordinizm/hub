import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonCard } from "./lesson-card";

describe("LessonCard locked fallback", () => {
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
});
