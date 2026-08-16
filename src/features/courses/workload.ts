export const COURSE_WORKLOAD_MAX = 2_147_483_647;

const INTEGER_PATTERN = /^\d+$/;

const INVALID_WORKLOAD_MESSAGE =
  "A carga horária deve ser um número inteiro não negativo.";

export const parseCourseWorkloadOverride = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  let parsed = Number.NaN;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && INTEGER_PATTERN.test(value.trim())) {
    parsed = Number(value.trim());
  }

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > COURSE_WORKLOAD_MAX
  ) {
    throw new Error(INVALID_WORKLOAD_MESSAGE);
  }

  return parsed;
};

export const resolveCourseWorkloadHours = (
  derivedWorkloadHours: number,
  override: number | null | undefined
): number => override ?? derivedWorkloadHours;
