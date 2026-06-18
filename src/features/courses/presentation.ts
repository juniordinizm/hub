const EXPIRING_SOON_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;
const SECONDS_PER_HOUR = 3600;

export type CourseAccessTone =
  | "active"
  | "completed"
  | "expiring"
  | "locked"
  | "revoked";
export type StudentCatalogAccessStatus =
  | "active"
  | "expired"
  | "none"
  | "revoked";

export interface CourseAccessPresentationInput {
  expiresAt: Date;
  now?: Date;
  progressPercent: number;
}

export interface StudentCatalogAccessPresentationInput
  extends CourseAccessPresentationInput {
  accessStatus: StudentCatalogAccessStatus;
  revokedReason: string | null;
}

export interface CourseAccessPresentation {
  helper: string;
  label: string;
  tone: CourseAccessTone;
}

export interface StudentCourseHrefInput {
  courseId: string;
  nextLessonId: string | null;
}

export interface CoursePublicationReadinessInput {
  hasDescription: boolean;
  hasPaymentProviderProductId: boolean;
  hasThumbnail: boolean;
  moduleCount: number;
  publishedLessonCount: number;
  totalLessonCount: number;
}

export interface CoursePublicationReadiness {
  completedCount: number;
  missingItems: string[];
  percent: number;
  totalCount: number;
}

export interface StudentCatalogCourseGroupingInput {
  accessStatus: StudentCatalogAccessStatus;
  progressPercent: number;
}

export interface StudentCatalogCourseGroups<
  TCourse extends StudentCatalogCourseGroupingInput,
> {
  active: TCourse[];
  completed: TCourse[];
  locked: TCourse[];
}

export interface FaqCategoryGroupingInput {
  category: string;
}

export interface FaqCategoryGroup<TItem extends FaqCategoryGroupingInput> {
  items: TItem[];
  name: string;
}

const getDaysUntil = (date: Date, now: Date): number =>
  Math.max(
    0,
    Math.ceil((date.getTime() - now.getTime()) / MILLISECONDS_PER_DAY)
  );

export const getCourseAccessPresentation = ({
  expiresAt,
  now = new Date(),
  progressPercent,
}: CourseAccessPresentationInput): CourseAccessPresentation => {
  if (progressPercent >= 100) {
    return {
      tone: "completed",
      label: "Curso concluído",
      helper: "Certificado pronto para emitir ou baixar.",
    };
  }

  const daysUntilExpiration = getDaysUntil(expiresAt, now);

  if (daysUntilExpiration <= EXPIRING_SOON_DAYS) {
    return {
      tone: "expiring",
      label:
        daysUntilExpiration === 0
          ? "Acesso expira hoje"
          : `Acesso expira em ${daysUntilExpiration} ${
              daysUntilExpiration === 1 ? "dia" : "dias"
            }`,
      helper: "Priorize as próximas aulas deste curso.",
    };
  }

  return {
    tone: "active",
    label: "Matriculado",
    helper: "Continue no seu ritmo dentro do período de acesso.",
  };
};

export const getStudentCatalogAccessPresentation = ({
  accessStatus,
  expiresAt,
  now,
  progressPercent,
  revokedReason,
}: StudentCatalogAccessPresentationInput): CourseAccessPresentation => {
  if (accessStatus === "active") {
    return getCourseAccessPresentation({
      expiresAt,
      progressPercent,
      ...(now ? { now } : {}),
    });
  }

  if (accessStatus === "expired") {
    return {
      tone: "locked",
      label: "Acesso expirado",
      helper: "Renove o acesso para voltar as aulas.",
    };
  }

  if (accessStatus === "revoked") {
    return {
      tone: "revoked",
      label:
        revokedReason === "abacatepay_dispute"
          ? "Acesso em analise"
          : "Acesso encerrado",
      helper: "Fale com o suporte para regularizar este acesso.",
    };
  }

  return {
    tone: "locked",
    label: "Disponível",
    helper: "Compre o acesso para iniciar este curso.",
  };
};

export const getStudentCoursePrimaryHref = ({
  courseId,
  nextLessonId,
}: StudentCourseHrefInput): string =>
  nextLessonId ? `/app/aulas/${nextLessonId}` : `/app/cursos/${courseId}`;

export const groupStudentCatalogCourses = <
  TCourse extends StudentCatalogCourseGroupingInput,
>(
  courses: readonly TCourse[]
): StudentCatalogCourseGroups<TCourse> => {
  const groups: StudentCatalogCourseGroups<TCourse> = {
    active: [],
    completed: [],
    locked: [],
  };

  for (const course of courses) {
    if (course.accessStatus !== "active") {
      groups.locked.push(course);
      continue;
    }

    if (course.progressPercent >= 100) {
      groups.completed.push(course);
      continue;
    }

    groups.active.push(course);
  }

  return groups;
};

export const groupFaqItemsByCategory = <TItem extends FaqCategoryGroupingInput>(
  items: readonly TItem[]
): FaqCategoryGroup<TItem>[] => {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const name = item.category.trim() || "Geral";
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }

  return [...groups.entries()].map(([name, groupItems]) => ({
    name,
    items: groupItems,
  }));
};

export const summarizeCoursePublicationReadiness = ({
  hasDescription,
  hasPaymentProviderProductId,
  hasThumbnail,
  moduleCount,
  publishedLessonCount,
  totalLessonCount,
}: CoursePublicationReadinessInput): CoursePublicationReadiness => {
  const checks = [
    {
      complete: hasDescription,
      missing: "Adicionar descrição",
    },
    {
      complete: hasThumbnail,
      missing: "Adicionar capa do curso",
    },
    {
      complete: moduleCount > 0,
      missing: "Criar pelo menos um módulo",
    },
    {
      complete: totalLessonCount > 0 && publishedLessonCount > 0,
      missing: "Publicar pelo menos uma aula",
    },
    {
      complete: hasPaymentProviderProductId,
      missing: "Vincular produto AbacatePay",
    },
  ];
  const missingItems = checks
    .filter((check) => !check.complete)
    .map((check) => check.missing);
  const totalCount = checks.length;
  const completedCount = totalCount - missingItems.length;

  return {
    completedCount,
    totalCount,
    percent: Math.round((completedCount / totalCount) * 100),
    missingItems,
  };
};

export const deriveCourseWorkloadHours = (
  lessonDurationsSeconds: number[]
): number => {
  const totalSeconds = lessonDurationsSeconds.reduce(
    (sum, durationSeconds) =>
      Number.isFinite(durationSeconds)
        ? sum + Math.max(0, Math.round(durationSeconds))
        : sum,
    0
  );

  return totalSeconds > 0 ? Math.ceil(totalSeconds / SECONDS_PER_HOUR) : 0;
};
