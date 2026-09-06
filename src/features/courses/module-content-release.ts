/** D+N uses elapsed 24-hour periods, never calendar-day arithmetic. */
export const MILLISECONDS_PER_DAY = 86_400_000;
/** Commercial safety margin: every access month reserves at least 28 days. */
export const CONSERVATIVE_ACCESS_DAYS_PER_MONTH = 28;
/** JavaScript Date's largest representable timestamp. */
export const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000;
export const MAX_RELEASE_DELAY_DAYS = Math.floor(
  MAX_DATE_MILLISECONDS / MILLISECONDS_PER_DAY
);

export type ContentReleaseMode = "full_access" | "scheduled";

export type ContentReleaseDomainErrorCode =
  | "invalid_anchor"
  | "invalid_clock"
  | "invalid_delay"
  | "invalid_mode"
  | "invalid_schedule";

export class ContentReleaseDomainError extends Error {
  readonly code: ContentReleaseDomainErrorCode;

  constructor(code: ContentReleaseDomainErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ContentReleaseDomainError";
  }
}

export interface ModuleContentReleaseInput {
  contentReleaseMode: ContentReleaseMode;
  contentReleaseStartedAt: Date | null;
  now: Date;
  releaseDelayDays: number;
}

export type ModuleContentRelease =
  | { kind: "available" }
  | { kind: "time_locked"; availableAt: Date };

export type LessonAvailability =
  | ModuleContentRelease
  | { kind: "sequence_locked" };

export interface ContentReleaseScheduleModule {
  releaseDelayDays: number;
  sortOrder: number;
  title: string;
}

export interface ContentReleaseScheduleSnapshot {
  clock: "elapsed_24h";
  modules: ContentReleaseScheduleModule[];
  version: 1;
}

const assertValidDate = (value: Date, name: string): void => {
  if (!(value instanceof Date && Number.isFinite(value.getTime()))) {
    let code: ContentReleaseDomainErrorCode = "invalid_schedule";
    if (name === "Relógio") {
      code = "invalid_clock";
    } else if (name === "Âncora") {
      code = "invalid_anchor";
    }
    throw new ContentReleaseDomainError(code, `${name} inválida.`);
  }
};

export const assertValidReleaseDelayDays = (releaseDelayDays: number): void => {
  if (
    !Number.isSafeInteger(releaseDelayDays) ||
    releaseDelayDays < 0 ||
    releaseDelayDays > MAX_RELEASE_DELAY_DAYS
  ) {
    throw new ContentReleaseDomainError(
      "invalid_delay",
      "Atraso de liberação inválido."
    );
  }
};

export const assertMaxReleaseDelayFitsAccessDuration = ({
  accessDurationMonths,
  maxReleaseDelayDays,
}: {
  accessDurationMonths: number;
  maxReleaseDelayDays: number;
}): void => {
  const conservativeAccessDays =
    accessDurationMonths * CONSERVATIVE_ACCESS_DAYS_PER_MONTH;
  if (
    !Number.isSafeInteger(accessDurationMonths) ||
    accessDurationMonths <= 0 ||
    !Number.isSafeInteger(conservativeAccessDays)
  ) {
    throw new ContentReleaseDomainError(
      "invalid_schedule",
      "Duração comercial inválida."
    );
  }
  assertValidReleaseDelayDays(maxReleaseDelayDays);
  if (maxReleaseDelayDays >= conservativeAccessDays) {
    throw new ContentReleaseDomainError(
      "invalid_schedule",
      "O cronograma de conteúdo não cabe na duração comercial do Curso."
    );
  }
};

export const assertScheduleFitsAccessDuration = ({
  accessDurationMonths,
  snapshot,
}: {
  accessDurationMonths: number;
  snapshot: ContentReleaseScheduleSnapshot;
}): void => {
  if (
    snapshot?.version !== 1 ||
    snapshot.clock !== "elapsed_24h" ||
    !Array.isArray(snapshot.modules)
  ) {
    throw new ContentReleaseDomainError(
      "invalid_schedule",
      "Cronograma de conteúdo inválido."
    );
  }

  let maxReleaseDelayDays = 0;
  for (const module of snapshot.modules) {
    if (!module) {
      throw new ContentReleaseDomainError(
        "invalid_schedule",
        "Cronograma de conteúdo inválido."
      );
    }
    assertValidReleaseDelayDays(module.releaseDelayDays);
    maxReleaseDelayDays = Math.max(
      maxReleaseDelayDays,
      module.releaseDelayDays
    );
  }

  assertMaxReleaseDelayFitsAccessDuration({
    accessDurationMonths,
    maxReleaseDelayDays,
  });
};

const getAvailableAt = (anchor: Date, releaseDelayDays: number): Date => {
  assertValidDate(anchor, "Âncora");
  assertValidReleaseDelayDays(releaseDelayDays);
  const timestamp = anchor.getTime() + releaseDelayDays * MILLISECONDS_PER_DAY;
  const availableAt = new Date(timestamp);
  assertValidDate(availableAt, "Data de liberação");
  return availableAt;
};

export const resolveModuleContentRelease = ({
  contentReleaseMode,
  contentReleaseStartedAt,
  releaseDelayDays,
  now,
}: ModuleContentReleaseInput): ModuleContentRelease => {
  assertValidDate(now, "Relógio");
  assertValidReleaseDelayDays(releaseDelayDays);

  if (contentReleaseMode === "full_access") {
    return { kind: "available" };
  }

  if (contentReleaseMode !== "scheduled") {
    throw new ContentReleaseDomainError(
      "invalid_mode",
      "Modo de liberação inválido."
    );
  }
  if (!contentReleaseStartedAt) {
    throw new ContentReleaseDomainError(
      "invalid_anchor",
      "Matricula agendada sem inicio da entrega."
    );
  }

  const availableAt = getAvailableAt(contentReleaseStartedAt, releaseDelayDays);
  return now.getTime() >= availableAt.getTime()
    ? { kind: "available" }
    : { kind: "time_locked", availableAt };
};

interface LessonAvailabilityInput {
  isCompleted: boolean;
  moduleRelease: ModuleContentRelease;
  sequenceAvailable: boolean;
}

export const resolveLessonAvailability = (
  input: LessonAvailabilityInput
): LessonAvailability => {
  const { isCompleted, moduleRelease, sequenceAvailable } = input;
  if (isCompleted) {
    return { kind: "available" };
  }
  if (moduleRelease.kind !== "available") {
    return moduleRelease;
  }
  return sequenceAvailable
    ? { kind: "available" }
    : { kind: "sequence_locked" };
};

export const buildContentReleaseScheduleSnapshot = (
  modules: readonly (ContentReleaseScheduleModule & { id?: string })[]
): ContentReleaseScheduleSnapshot => ({
  version: 1,
  clock: "elapsed_24h",
  modules: [...modules]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ title, sortOrder, releaseDelayDays }) => {
      assertValidReleaseDelayDays(releaseDelayDays);
      return { title, sortOrder, releaseDelayDays };
    }),
});

export const hasDelayedModules = (
  snapshot: ContentReleaseScheduleSnapshot
): boolean => {
  for (const module of snapshot.modules) {
    assertValidReleaseDelayDays(module.releaseDelayDays);
  }
  return snapshot.modules.some(({ releaseDelayDays }) => releaseDelayDays > 0);
};
