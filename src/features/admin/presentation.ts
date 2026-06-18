export interface AdminCourseHealthInput {
  hasDescription: boolean;
  hasPaymentProviderProductId: boolean;
  hasThumbnail: boolean;
  moduleCount: number;
  publishedLessonCount: number;
  status: string;
  title: string;
  totalLessonCount: number;
}

export interface AdminCourseHealthSummary {
  activeCourses: number;
  averageReadinessPercent: number;
  coursesNeedingAttention: Array<{
    missingCount: number;
    readinessPercent: number;
    title: string;
  }>;
  draftCourses: number;
}

export interface AdminOperationSignalInput {
  coursesNeedingAttention: number;
  failedWebhooks: number;
  pendingOrders: number;
}

export interface AdminOperationSignal {
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
  notEnrolledStudents: number;
  totalStudents: number;
}

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
    course.hasPaymentProviderProductId,
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
    status: course.status,
    title: course.title,
  }));
  const averageReadinessPercent = courseReadiness.length
    ? Math.round(
        courseReadiness.reduce(
          (sum, course) => sum + course.readinessPercent,
          0
        ) / courseReadiness.length
      )
    : 0;

  return {
    activeCourses: courses.filter((course) => course.status === "active")
      .length,
    averageReadinessPercent,
    coursesNeedingAttention: courseReadiness
      .filter((course) => course.missingCount > 0)
      .sort(
        (left, right) =>
          left.readinessPercent - right.readinessPercent ||
          left.title.localeCompare(right.title)
      )
      .slice(0, MAX_ATTENTION_COURSES)
      .map(({ missingCount, readinessPercent, title }) => ({
        missingCount,
        readinessPercent,
        title,
      })),
    draftCourses: courses.filter((course) => course.status === "draft").length,
  };
};

export const getAdminOperationSignal = ({
  coursesNeedingAttention,
  failedWebhooks,
  pendingOrders,
}: AdminOperationSignalInput): AdminOperationSignal => {
  if (failedWebhooks > 0) {
    return {
      tone: "attention",
      label: "Revisar webhooks",
      helper: `${failedWebhooks} evento${
        failedWebhooks === 1 ? "" : "s"
      } com falha pode afetar liberacao de acesso.`,
    };
  }

  if (pendingOrders > 0) {
    return {
      tone: "watch",
      label: "Pedidos pendentes",
      helper: `${pendingOrders} pedido${
        pendingOrders === 1 ? "" : "s"
      } ainda aguardando confirmacao.`,
    };
  }

  if (coursesNeedingAttention > 0) {
    return {
      tone: "watch",
      label: "Catalogo em ajuste",
      helper: `${coursesNeedingAttention} curso${
        coursesNeedingAttention === 1 ? "" : "s"
      } ainda precisa de acabamento para venda.`,
    };
  }

  return {
    tone: "healthy",
    label: "Operacao saudavel",
    helper: "Catalogo, pedidos e webhooks sem pendencias criticas.",
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
      student.activeEnrollments > 0 &&
      isExpiringSoon(student.latestExpiration, now)
  ).length,
  notEnrolledStudents: students.filter((student) => student.courseCount === 0)
    .length,
  totalStudents: students.length,
});
