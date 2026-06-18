import { describe, expect, it } from "vitest";
import {
  getHrefWithSearchParams,
  getPreviewAwareHref,
  getStudentPreviewMode,
  isPreviewRole,
} from "./preview";

describe("course preview helpers", () => {
  it("enables student preview only for admin and support roles", () => {
    expect(getStudentPreviewMode({ preview: "aluno", role: "admin" })).toBe(
      "student"
    );
    expect(getStudentPreviewMode({ preview: "aluno", role: "support" })).toBe(
      "student"
    );
    expect(getStudentPreviewMode({ preview: "aluno", role: "student" })).toBe(
      null
    );
  });

  it("accepts the english preview value used by URLs and rejects unrelated values", () => {
    expect(getStudentPreviewMode({ preview: "student", role: "admin" })).toBe(
      "student"
    );
    expect(getStudentPreviewMode({ preview: "true", role: "admin" })).toBe(
      null
    );
  });

  it("preserves preview mode in internal student hrefs", () => {
    expect(getPreviewAwareHref("/app/aulas/lesson-1", "student")).toBe(
      "/app/aulas/lesson-1?preview=student"
    );
    expect(
      getPreviewAwareHref("/app/aulas/lesson-1?busca=intro", "student")
    ).toBe("/app/aulas/lesson-1?busca=intro&preview=student");
    expect(getPreviewAwareHref("/app/aulas/lesson-1", null)).toBe(
      "/app/aulas/lesson-1"
    );
  });

  it("adds only defined search params to internal hrefs", () => {
    expect(
      getHrefWithSearchParams("/app/aulas/lesson-1?busca=intro", {
        focus: "1",
        preview: "student",
        skip: null,
      })
    ).toBe("/app/aulas/lesson-1?busca=intro&focus=1&preview=student");
    expect(
      getHrefWithSearchParams("/app/aulas/lesson-1", {
        focus: undefined,
      })
    ).toBe("/app/aulas/lesson-1");
  });

  it("identifies roles that can access preview routes", () => {
    expect(isPreviewRole("admin")).toBe(true);
    expect(isPreviewRole("support")).toBe(true);
    expect(isPreviewRole("student")).toBe(false);
  });
});
