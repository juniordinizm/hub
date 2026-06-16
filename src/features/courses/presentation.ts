const EXPIRING_SOON_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;

export type CourseAccessTone = "active" | "completed" | "expiring";

export interface CourseAccessPresentationInput {
  expiresAt: Date;
  now?: Date;
  progressPercent: number;
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
    label: "Acesso ativo",
    helper: "Continue no seu ritmo dentro do período de acesso.",
  };
};

export const getStudentCoursePrimaryHref = ({
  courseId,
  nextLessonId,
}: StudentCourseHrefInput): string =>
  nextLessonId ? `/app/aulas/${nextLessonId}` : `/app/cursos/${courseId}`;

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
