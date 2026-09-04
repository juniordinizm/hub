const MILLISECONDS_PER_DAY = 86_400_000;

export type ContentReleaseMode = "full_access" | "scheduled";

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
    throw new Error(`${name} inválida.`);
  }
};

const assertValidDelay = (releaseDelayDays: number): void => {
  if (
    !Number.isSafeInteger(releaseDelayDays) ||
    releaseDelayDays < 0 ||
    releaseDelayDays > Math.floor(8_640_000_000_000_000 / MILLISECONDS_PER_DAY)
  ) {
    throw new Error("Atraso de liberação inválido.");
  }
};

export const assertScheduleFitsAccessDuration = ({
  accessDurationMonths,
  snapshot,
}: {
  accessDurationMonths: number;
  snapshot: ContentReleaseScheduleSnapshot;
}): void => {
  const conservativeAccessDays = accessDurationMonths * 28;
  if (
    !Number.isSafeInteger(accessDurationMonths) ||
    accessDurationMonths <= 0 ||
    !Number.isSafeInteger(conservativeAccessDays)
  ) {
    throw new Error("Duração comercial inválida.");
  }
  if (
    snapshot?.version !== 1 ||
    snapshot.clock !== "elapsed_24h" ||
    !Array.isArray(snapshot.modules)
  ) {
    throw new Error("Cronograma de conteúdo inválido.");
  }

  let maxReleaseDelayDays = 0;
  for (const module of snapshot.modules as (ContentReleaseScheduleModule | null)[]) {
    if (!module) {
      throw new Error("Cronograma de conteúdo inválido.");
    }
    assertValidDelay(module.releaseDelayDays);
    maxReleaseDelayDays = Math.max(
      maxReleaseDelayDays,
      module.releaseDelayDays
    );
  }

  if (maxReleaseDelayDays >= conservativeAccessDays) {
    throw new Error(
      "O cronograma de conteúdo não cabe na duração comercial do Curso."
    );
  }
};

const getAvailableAt = (anchor: Date, releaseDelayDays: number): Date => {
  assertValidDate(anchor, "Âncora");
  assertValidDelay(releaseDelayDays);
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
  assertValidDelay(releaseDelayDays);

  if (contentReleaseMode === "full_access") {
    return { kind: "available" };
  }

  if (contentReleaseMode !== "scheduled") {
    throw new Error("Modo de liberação inválido.");
  }
  if (!contentReleaseStartedAt) {
    throw new Error("Matricula agendada sem inicio da entrega.");
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
      assertValidDelay(releaseDelayDays);
      return { title, sortOrder, releaseDelayDays };
    }),
});

export const hasDelayedModules = (
  snapshot: ContentReleaseScheduleSnapshot
): boolean => {
  for (const module of snapshot.modules) {
    assertValidDelay(module.releaseDelayDays);
  }
  return snapshot.modules.some(({ releaseDelayDays }) => releaseDelayDays > 0);
};
