const MILLISECONDS_PER_DAY = 86_400_000;

export type ContentReleaseMode = "full_access" | "scheduled";

export interface ModuleContentRelease {
  contentReleaseMode: ContentReleaseMode;
  contentReleaseStartedAt: Date | null;
  now: Date;
  releaseDelayDays: number;
}

export type LessonAvailability =
  | { kind: "available" }
  | { kind: "time_locked"; availableAt: Date }
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
}: ModuleContentRelease): LessonAvailability => {
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

type LessonAvailabilityInput = ModuleContentRelease & {
  isCompleted: boolean;
  isSequenceAvailable: boolean;
};

export const resolveLessonAvailability = (
  input: LessonAvailabilityInput
): LessonAvailability => {
  const { isCompleted, isSequenceAvailable, ...release } = input;
  if (isCompleted) {
    return { kind: "available" };
  }
  const releaseAvailability = resolveModuleContentRelease(release);
  if (releaseAvailability.kind !== "available") {
    return releaseAvailability;
  }
  return isSequenceAvailable
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
  modules: readonly Pick<ContentReleaseScheduleModule, "releaseDelayDays">[]
): boolean => modules.some(({ releaseDelayDays }) => releaseDelayDays > 0);
