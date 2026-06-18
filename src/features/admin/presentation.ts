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

export interface AdminFinancialOrderInput {
  amountInCents: number;
  status: string;
}

export interface AdminFinancialHealthSummary {
  averagePaidTicketInCents: number;
  checkoutConversionPercent: number;
  disputedOrders: number;
  paidOrders: number;
  paidRevenueInCents: number;
  pendingOrders: number;
  pendingRevenueInCents: number;
  refundedOrders: number;
  totalOrders: number;
}

export interface AdminFinancialSignal {
  helper: string;
  label: string;
  tone: "attention" | "healthy" | "watch";
}

export interface AdminLessonContentInput {
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
  totalDurationSeconds: number;
  totalLessons: number;
  videoReadyLessons: number;
  withoutVideoLessons: number;
}

export interface AdminCourseContentSignal {
  helper: string;
  label: string;
  tone: "attention" | "healthy" | "watch";
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

export const summarizeAdminFinancialHealth = (
  orders: readonly AdminFinancialOrderInput[]
): AdminFinancialHealthSummary => {
  const paidOrders = orders.filter((order) => order.status === "paid");
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const disputedOrders = orders.filter((order) => order.status === "disputed");
  const refundedOrders = orders.filter((order) => order.status === "refunded");
  const paidRevenueInCents = paidOrders.reduce(
    (sum, order) => sum + order.amountInCents,
    0
  );
  const pendingRevenueInCents = pendingOrders.reduce(
    (sum, order) => sum + order.amountInCents,
    0
  );

  return {
    averagePaidTicketInCents: paidOrders.length
      ? Math.round(paidRevenueInCents / paidOrders.length)
      : 0,
    checkoutConversionPercent: orders.length
      ? Math.round((paidOrders.length / orders.length) * 100)
      : 0,
    disputedOrders: disputedOrders.length,
    paidOrders: paidOrders.length,
    paidRevenueInCents,
    pendingOrders: pendingOrders.length,
    pendingRevenueInCents,
    refundedOrders: refundedOrders.length,
    totalOrders: orders.length,
  };
};

export const getAdminFinancialSignal = ({
  disputedOrders,
  pendingOrders,
  refundedOrders,
}: Pick<
  AdminFinancialHealthSummary,
  "disputedOrders" | "pendingOrders" | "refundedOrders"
>): AdminFinancialSignal => {
  if (disputedOrders > 0) {
    return {
      tone: "attention",
      label: "Disputas abertas",
      helper: `${disputedOrders} pedido${
        disputedOrders === 1 ? "" : "s"
      } em disputa exige acompanhamento manual.`,
    };
  }

  if (pendingOrders > 0) {
    return {
      tone: "watch",
      label: "Aguardando pagamento",
      helper: `${pendingOrders} checkout${
        pendingOrders === 1 ? "" : "s"
      } ainda nao virou acesso pago.`,
    };
  }

  if (refundedOrders > 0) {
    return {
      tone: "watch",
      label: "Reembolsos registrados",
      helper: `${refundedOrders} pedido${
        refundedOrders === 1 ? "" : "s"
      } reembolsado deve estar refletido no acesso.`,
    };
  }

  return {
    tone: "healthy",
    label: "Receita sem alerta",
    helper: "Pedidos recentes sem disputa, pendencia ou reembolso aberto.",
  };
};

const hasLessonVideo = (lesson: AdminLessonContentInput): boolean =>
  lesson.videoProvider === "jmvstream"
    ? Boolean(lesson.videoEmbedUrl?.trim())
    : Boolean(lesson.videoEmbedUrl?.trim() || lesson.videoExternalId?.trim());

export const summarizeAdminCourseContent = ({
  lessons,
  modules,
}: {
  lessons: readonly AdminLessonContentInput[];
  modules: readonly AdminModuleContentInput[];
}): AdminCourseContentSummary => {
  const videoReadyLessons = lessons.filter(hasLessonVideo).length;

  return {
    draftLessons: lessons.filter((lesson) => !lesson.isPublished).length,
    emptyModules: modules.filter(
      (moduleData) =>
        !lessons.some((lesson) => lesson.moduleId === moduleData.id)
    ).length,
    publishedLessons: lessons.filter((lesson) => lesson.isPublished).length,
    totalDurationSeconds: lessons.reduce(
      (sum, lesson) => sum + Math.max(0, lesson.durationSeconds),
      0
    ),
    totalLessons: lessons.length,
    videoReadyLessons,
    withoutVideoLessons: lessons.length - videoReadyLessons,
  };
};

export const getAdminCourseContentSignal = ({
  draftLessons,
  emptyModules,
  totalLessons,
  withoutVideoLessons,
}: Pick<
  AdminCourseContentSummary,
  "draftLessons" | "emptyModules" | "totalLessons" | "withoutVideoLessons"
>): AdminCourseContentSignal => {
  if (totalLessons === 0) {
    return {
      tone: "attention",
      label: "Sem aulas",
      helper: "Crie a primeira aula antes de colocar este curso a venda.",
    };
  }

  if (withoutVideoLessons > 0) {
    return {
      tone: "attention",
      label: "Aulas sem video",
      helper: `${withoutVideoLessons} aula${
        withoutVideoLessons === 1 ? "" : "s"
      } ainda precisa de video ou embed.`,
    };
  }

  if (draftLessons > 0) {
    return {
      tone: "watch",
      label: "Rascunhos pendentes",
      helper: `${draftLessons} aula${
        draftLessons === 1 ? "" : "s"
      } ainda nao aparece para alunos.`,
    };
  }

  if (emptyModules > 0) {
    return {
      tone: "watch",
      label: "Modulos vazios",
      helper: `${emptyModules} modulo${
        emptyModules === 1 ? "" : "s"
      } sem aulas pode confundir a estrutura do curso.`,
    };
  }

  return {
    tone: "healthy",
    label: "Conteudo pronto",
    helper: "Aulas publicadas, com video e organizadas em modulos.",
  };
};
