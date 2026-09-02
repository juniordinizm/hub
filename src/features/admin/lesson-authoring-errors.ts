export type LessonAuthoringErrorField = "content" | "general" | "title";

export class LessonAuthoringError extends Error {
  readonly field: LessonAuthoringErrorField;

  constructor(message: string, field: LessonAuthoringErrorField = "general") {
    super(message);
    this.name = "LessonAuthoringError";
    this.field = field;
  }
}

export type LessonSaveActionResult =
  | { ok: true }
  | {
      field: LessonAuthoringErrorField;
      message: string;
      ok: false;
    };

export const getLessonSaveActionFailure = (
  error: unknown,
  correlationId: string
): Extract<LessonSaveActionResult, { ok: false }> => {
  if (error instanceof LessonAuthoringError) {
    return { field: error.field, message: error.message, ok: false };
  }

  return {
    field: "general",
    message: `Não foi possível salvar a aula. Tente novamente. Se o problema continuar, informe o código de suporte ${correlationId}.`,
    ok: false,
  };
};
