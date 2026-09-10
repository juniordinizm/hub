import { getLessonContentReadiness } from "@/features/courses/lesson-content";
import type { CoursePurchaseLink } from "@/features/payments/course-purchase-link";

export type AdminCourseActionTab = "content" | "settings";

export type AdminCourseOperationalStateKey =
  | "identity_incomplete"
  | "content_incomplete"
  | "publication_missing"
  | "commercial_incomplete"
  | "course_inactive"
  | "checkout_unavailable"
  | "changes_pending"
  | "ready";

export interface AdminCourseOperationalState {
  actionLabel: string | null;
  actionTab: AdminCourseActionTab | null;
  description: string;
  key: AdminCourseOperationalStateKey;
  label: string;
  tone: "attention" | "healthy" | "watch";
}

interface AdminCourseOperationalStateInput {
  hasDescription: boolean;
  hasDraft: boolean;
  hasPublished: boolean;
  hasReadyLesson: boolean;
  hasThumbnail: boolean;
  moduleCount: number;
  purchaseLink: CoursePurchaseLink;
  status: string;
}

export interface AdminCourseHealthInput {
  hasDescription: boolean;
  hasPublishedPublication: boolean;
  hasThumbnail: boolean;
  id: string;
  moduleCount: number;
  publishedLessonCount: number;
  status: string;
  title: string;
  totalLessonCount: number;
}

export interface AdminCourseHealthSummary {
  activeCourses: number;
  averageReadinessPercent: number | null;
  coursesNeedingAttention: Array<{
    actionTab: AdminCourseActionTab;
    id: string;
    missingCount: number;
    readinessPercent: number;
    title: string;
  }>;
  coursesNeedingAttentionCount: number;
  draftCourses: number;
}

export interface AdminOperationSignalInput {
  coursesNeedingAttention: number;
  failedWebhooks: number;
  pendingOrders: number;
  retryableWebhooks?: number;
}

export interface AdminOperationSignal {
  actionHref: string | null;
  helper: string;
  label: string;
  tone: "attention" | "healthy" | "watch";
}

export interface AdminStudentAccessInput {
  activeEnrollments: number;
  courseCount: number;
  latestExpiration: Date | null;
  status: string;
}

export interface AdminStudentAccessSummary {
  activeStudents: number;
  expiringSoonStudents: number;
  totalStudents: number;
  withoutActiveAccessStudents: number;
}

export interface AdminFinancialHealthSummary {
  abandonedCheckoutOrders: number;
  averagePaidTicketInCents: number;
  checkoutConversionPercent: number;
  disputedOrders: number;
  failedWebhooks: number;
  paidOrders: number;
  paidRevenueInCents: number;
  pendingOrders: number;
  pendingRevenueInCents: number;
  readyWebhooks: number;
  refundedOrders: number;
  retryableWebhooks: number;
  totalOrders: number;
}

export interface AdminLessonContentInput {
  contentJson: unknown;
  durationSeconds: number;
  isPublished: boolean;
  moduleId: string;
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: string | null;
}

export interface AdminModuleContentInput {
  id: string;
}

export interface AdminCourseContentSummary {
  draftLessons: number;
  emptyModules: number;
  publishedLessons: number;
  readyLessons: number;
  totalDurationSeconds: number;
  totalLessons: number;
  withoutContentLessons: number;
}

export interface AdminCourseContentSignal {
  helper: string;
  label: string;
  tone: "attention" | "healthy" | "watch";
}

const getMissingIdentityDescription = ({
  hasDescription,
  hasThumbnail,
}: Pick<
  AdminCourseOperationalStateInput,
  "hasDescription" | "hasThumbnail"
>): string => {
  if (!(hasDescription || hasThumbnail)) {
    return "Adicione a descrição e a capa do Curso.";
  }

  if (!hasDescription) {
    return "Adicione a descrição do Curso.";
  }

  return "Adicione a capa do Curso.";
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Course purchase issue: ${value}`);
};

export const getAdminCourseOperationalState = ({
  hasDescription,
  hasDraft,
  hasPublished,
  hasReadyLesson,
  hasThumbnail,
  moduleCount,
  purchaseLink,
  status,
}: AdminCourseOperationalStateInput): AdminCourseOperationalState => {
  const purchaseIssue = purchaseLink.available ? null : purchaseLink.reason;

  if (!(hasDescription && hasThumbnail)) {
    return {
      actionLabel: "Completar configurações",
      actionTab: "settings",
      description: getMissingIdentityDescription({
        hasDescription,
        hasThumbnail,
      }),
      key: "identity_incomplete",
      label: "Identidade incompleta",
      tone: "attention",
    };
  }

  if (moduleCount <= 0 || !hasReadyLesson) {
    return {
      actionLabel: "Organizar conteúdo",
      actionTab: "content",
      description:
        moduleCount <= 0
          ? "Crie um Módulo para organizar o conteúdo do Curso."
          : "Prepare ao menos uma Aula com conteúdo para publicação.",
      key: "content_incomplete",
      label: "Conteúdo incompleto",
      tone: "attention",
    };
  }

  if (!hasPublished || purchaseIssue === "course_unpublished") {
    return {
      actionLabel: "Publicar conteúdo",
      actionTab: "content",
      description: "Publique o conteúdo do Curso para disponibilizá-lo.",
      key: "publication_missing",
      label: "Publicação pendente",
      tone: "attention",
    };
  }

  if (purchaseIssue === "invalid_price") {
    return {
      actionLabel: "Revisar oferta",
      actionTab: "settings",
      description: "Revise o preço do Curso para liberar a oferta.",
      key: "commercial_incomplete",
      label: "Oferta incompleta",
      tone: "attention",
    };
  }

  if (status !== "active" || purchaseIssue === "course_inactive") {
    return {
      actionLabel: "Revisar publicação",
      actionTab: "settings",
      description: "Ative o Curso para disponibilizar sua publicação e oferta.",
      key: "course_inactive",
      label: "Curso inativo",
      tone: "attention",
    };
  }

  if (purchaseIssue === "checkout_disabled") {
    return {
      actionLabel: null,
      actionTab: null,
      description: "O checkout não está disponível no ambiente atual.",
      key: "checkout_unavailable",
      label: "Checkout indisponível",
      tone: "watch",
    };
  }

  if (purchaseIssue === "sales_closed") {
    return {
      actionLabel: "Revisar disponibilidade",
      actionTab: "settings",
      description:
        "O Curso preserva os acessos atuais, mas não aceita novas compras.",
      key: "course_inactive",
      label: "Vendas pausadas",
      tone: "watch",
    };
  }

  if (purchaseIssue !== null) {
    return assertNever(purchaseIssue);
  }

  if (hasDraft) {
    return {
      actionLabel: "Revisar alterações",
      actionTab: "content",
      description: "O Curso está disponível, mas há alterações em preparo.",
      key: "changes_pending",
      label: "Alterações em preparo",
      tone: "watch",
    };
  }

  return {
    actionLabel: null,
    actionTab: null,
    description: "O Curso está disponível e não possui alterações pendentes.",
    key: "ready",
    label: "Curso publicado",
    tone: "healthy",
  };
};

const COURSE_HEALTH_CHECK_COUNT = 5;
const EXPIRING_ACCESS_DAYS = 30;
const MAX_ATTENTION_COURSES = 4;
const MILLISECONDS_PER_DAY = 86_400_000;

const getCourseReadiness = (
  course: AdminCourseHealthInput
): { missingCount: number; readinessPercent: number } => {
  const checks = [
    course.hasDescription,
    course.hasThumbnail,
    course.moduleCount > 0,
    course.totalLessonCount > 0 && course.publishedLessonCount > 0,
    course.hasPublishedPublication,
  ];
  const completedCount = checks.filter(Boolean).length;

  return {
    missingCount: COURSE_HEALTH_CHECK_COUNT - completedCount,
    readinessPercent: Math.round(
      (completedCount / COURSE_HEALTH_CHECK_COUNT) * 100
    ),
  };
};

export const summarizeAdminCourseHealth = (
  courses: readonly AdminCourseHealthInput[]
): AdminCourseHealthSummary => {
  const courseReadiness = courses.map((course) => ({
    ...getCourseReadiness(course),
    actionTab:
      course.hasDescription && course.hasThumbnail
        ? ("content" as const)
        : ("settings" as const),
    id: course.id,
    status: course.status,
    title: course.title,
  }));
  const coursesNeedingAttention = courseReadiness
    .filter((course) => course.missingCount > 0)
    .sort(
      (left, right) =>
        left.readinessPercent - right.readinessPercent ||
        left.title.localeCompare(right.title)
    );
  const averageReadinessPercent = courseReadiness.length
    ? Math.round(
        courseReadiness.reduce(
          (sum, course) => sum + course.readinessPercent,
          0
        ) / courseReadiness.length
      )
    : null;

  return {
    activeCourses: courses.filter((course) => course.status === "active")
      .length,
    averageReadinessPercent,
    coursesNeedingAttention: coursesNeedingAttention
      .slice(0, MAX_ATTENTION_COURSES)
      .map(({ actionTab, id, missingCount, readinessPercent, title }) => ({
        actionTab,
        id,
        missingCount,
        readinessPercent,
        title,
      })),
    coursesNeedingAttentionCount: coursesNeedingAttention.length,
    draftCourses: courses.filter((course) => course.status === "draft").length,
  };
};

export const getAdminOperationSignal = ({
  coursesNeedingAttention,
  failedWebhooks,
  pendingOrders,
  retryableWebhooks = 0,
}: AdminOperationSignalInput): AdminOperationSignal => {
  const webhookAttentionCount = failedWebhooks + retryableWebhooks;
  if (failedWebhooks > 0) {
    return {
      actionHref: "/admin/auditoria",
      tone: "attention",
      label: "Revisar integração",
      helper: `${failedWebhooks} falho${
        failedWebhooks === 1 ? "" : "s"
      } e ${retryableWebhooks} em retry podem afetar a liberação de acesso.`,
    };
  }

  if (webhookAttentionCount > 0) {
    return {
      actionHref: "/admin/auditoria",
      tone: "watch",
      label: "Integração em retry",
      helper: `${retryableWebhooks} webhook${
        retryableWebhooks === 1 ? "" : "s"
      } aguarda${retryableWebhooks === 1 ? "" : "m"} uma nova tentativa automática.`,
    };
  }

  if (pendingOrders > 0) {
    return {
      actionHref: "/admin/financeiro?tab=orders&status=pending&checkout=open",
      tone: "watch",
      label: "Pedidos pendentes",
      helper: `${pendingOrders} pedido${
        pendingOrders === 1 ? "" : "s"
      } ainda aguardando confirmação.`,
    };
  }

  if (coursesNeedingAttention > 0) {
    return {
      actionHref: "/admin/cursos",
      tone: "watch",
      label: "Catálogo em ajuste",
      helper: `${coursesNeedingAttention} curso${
        coursesNeedingAttention === 1 ? "" : "s"
      } ainda precisa de acabamento para venda.`,
    };
  }

  return {
    actionHref: null,
    tone: "healthy",
    label: "Operação saudável",
    helper: "Catálogo, pedidos e webhooks sem pendências críticas.",
  };
};

const isExpiringSoon = (expiresAt: Date | null, now: Date): boolean => {
  if (!expiresAt) {
    return false;
  }

  const daysUntilExpiration = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY
  );

  return (
    daysUntilExpiration >= 0 && daysUntilExpiration <= EXPIRING_ACCESS_DAYS
  );
};

export const summarizeAdminStudentAccess = (
  students: readonly AdminStudentAccessInput[],
  now = new Date()
): AdminStudentAccessSummary => ({
  activeStudents: students.filter((student) => student.status === "active")
    .length,
  expiringSoonStudents: students.filter(
    (student) =>
      student.status === "active" &&
      student.activeEnrollments > 0 &&
      isExpiringSoon(student.latestExpiration, now)
  ).length,
  totalStudents: students.length,
  withoutActiveAccessStudents: students.filter(
    (student) => student.status !== "active" || student.activeEnrollments === 0
  ).length,
});

export const summarizeAdminCourseContent = ({
  lessons,
  modules,
}: {
  lessons: readonly AdminLessonContentInput[];
  modules: readonly AdminModuleContentInput[];
}): AdminCourseContentSummary => {
  const lessonReadiness = lessons.map((lesson) =>
    getLessonContentReadiness(lesson)
  );

  return {
    draftLessons: lessons.filter((lesson) => !lesson.isPublished).length,
    emptyModules: modules.filter(
      (moduleData) =>
        !lessons.some((lesson) => lesson.moduleId === moduleData.id)
    ).length,
    publishedLessons: lessons.filter((lesson) => lesson.isPublished).length,
    readyLessons: lessonReadiness.filter((readiness) => readiness.isReady)
      .length,
    totalDurationSeconds: lessons.reduce(
      (sum, lesson) => sum + Math.max(0, lesson.durationSeconds),
      0
    ),
    totalLessons: lessons.length,
    withoutContentLessons: lessons.filter(
      (lesson, index) => lesson.isPublished && !lessonReadiness[index]?.isReady
    ).length,
  };
};

export const getAdminCourseContentSignal = ({
  draftLessons,
  emptyModules,
  totalLessons,
  withoutContentLessons,
}: Pick<
  AdminCourseContentSummary,
  "draftLessons" | "emptyModules" | "totalLessons" | "withoutContentLessons"
>): AdminCourseContentSignal => {
  if (totalLessons === 0) {
    return {
      tone: "attention",
      label: "Sem aulas",
      helper: "Crie a primeira aula antes de colocar este Curso à venda.",
    };
  }

  if (withoutContentLessons > 0) {
    return {
      tone: "attention",
      label: "Aulas sem conteúdo",
      helper: `${withoutContentLessons} aula${
        withoutContentLessons === 1 ? "" : "s"
      } publicada${
        withoutContentLessons === 1 ? "" : "s"
      } ainda precisa de conteúdo.`,
    };
  }

  if (draftLessons > 0) {
    return {
      tone: "watch",
      label: "Rascunhos pendentes",
      helper: `${draftLessons} aula${
        draftLessons === 1 ? "" : "s"
      } ainda não aparece para alunas.`,
    };
  }

  if (emptyModules > 0) {
    return {
      tone: "watch",
      label: "Módulos vazios",
      helper: `${emptyModules} módulo${
        emptyModules === 1 ? "" : "s"
      } sem aulas pode confundir a estrutura do curso.`,
    };
  }

  return {
    tone: "healthy",
    label: "Conteúdo pronto",
    helper: "Aulas publicadas, com vídeo e organizadas em módulos.",
  };
};
