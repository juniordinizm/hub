import { describe, expect, it } from "vitest";
import {
  getLessonSaveActionFailure,
  LessonAuthoringError,
} from "./lesson-authoring-errors";

describe("lesson authoring errors", () => {
  it("returns the safe message and field for expected validation failures", () => {
    expect(
      getLessonSaveActionFailure(
        new LessonAuthoringError("Informe o título da aula.", "title"),
        "correlation-1"
      )
    ).toEqual({
      field: "title",
      message: "Informe o título da aula.",
      ok: false,
    });
  });

  it("does not expose an unexpected exception to the browser", () => {
    const result = getLessonSaveActionFailure(
      new Error("select password from users where token = secret"),
      "correlation-2"
    );

    expect(result).toEqual({
      field: "general",
      message: expect.stringContaining("correlation-2"),
      ok: false,
    });
    expect(result.message).not.toContain("password");
    expect(result.message).not.toContain("secret");
  });
});
