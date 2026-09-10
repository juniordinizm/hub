import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAdminCourseContentSignal,
  getAdminCourseOperationalState,
  summarizeAdminCourseContent,
} from "@/features/admin/presentation";
import {
  type AdminCourseManagementTab,
  type AdminCourseTabData,
  getAdminCourseTabData,
} from "@/features/admin/server";
import { getCourseAvailabilityStatusPresentation } from "@/features/admin/status-presentation";
import { parseAdminEnrollmentStatusFilter } from "@/features/admin/student-filters";
import {
  ADMIN_COURSE_STUDENT_ID_PARAM,
  parseAdminCourseStudentAction,
} from "@/features/admin/student-navigation";
import {
  getCertificateTemplatesForCourse,
  hasCertificateIssuerProfile,
} from "@/features/certificates/templates";
import { resolveCourseAvailability } from "@/features/courses/availability";
import { getCoursePurchaseLink } from "@/features/payments/course-purchase-link";
import { getServerEnv } from "@/lib/env";
import { route } from "@/lib/routes";
import { CertificateTemplateEditor } from "./certificate-template-editor";
import { CourseAvailabilityForm } from "./course-availability-form";
import { CourseContentPanel } from "./course-content-panel";
import { CourseSettingsForm } from "./course-dialogs-client";
import { CourseEnrollmentsTable } from "./course-enrollments-table";
import { CourseManagementTabs } from "./course-management-tabs";
import { CourseOverview } from "./course-overview";
import { CoursePurchaseLink } from "./course-purchase-link";

export const dynamic = "force-dynamic";

const SECONDS_PER_HOUR = 3600;

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

const COURSE_MANAGEMENT_TAB_VALUES: AdminCourseManagementTab[] = [
  "overview",
  "content",
  "students",
  "settings",
  "certificate",
];

const getCourseManagementTab = (
  value: string | undefined
): AdminCourseManagementTab =>
  value &&
  COURSE_MANAGEMENT_TAB_VALUES.includes(value as AdminCourseManagementTab)
    ? (value as AdminCourseManagementTab)
    : "overview";

const getCoursePageDerivedData = (data: AdminCourseTabData) => {
  const { course } = data;
  const contentData =
    data.tab === "overview" || data.tab === "content" ? data : null;
  if (contentData) {
    contentData.modules.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const contentSummary = contentData
    ? summarizeAdminCourseContent({
        lessons: contentData.lessons,
        modules: contentData.modules,
      })
    : null;
  const contentSignal = contentSummary
    ? getAdminCourseContentSignal(contentSummary)
    : null;
  const purchaseContext =
    data.tab === "overview" || data.tab === "settings" ? data : null;
  const serverEnv = purchaseContext ? getServerEnv() : null;
  const purchaseLink =
    purchaseContext && serverEnv
      ? getCoursePurchaseLink({
          appUrl: serverEnv.NEXT_PUBLIC_APP_URL,
          checkoutMode: serverEnv.PAYMENTS_CHECKOUT_MODE,
          course: {
            hasPublishedPublication:
              purchaseContext.publicationState.hasPublished,
            priceInCents: course.priceInCents,
            salesStatus: course.salesStatus,
            slug: course.slug,
            status: course.status,
          },
        })
      : null;
  const publicCourseUrl =
    purchaseContext && serverEnv
      ? new URL(
          `/comprar/${encodeURIComponent(course.slug)}`,
          serverEnv.NEXT_PUBLIC_APP_URL
        ).toString()
      : null;
  const operationalState =
    data.tab === "overview" && contentSummary && purchaseLink
      ? getAdminCourseOperationalState({
          hasDescription: Boolean(course.description?.trim()),
          hasDraft: data.publicationState.hasDraft,
          hasPublished: data.publicationState.hasPublished,
          hasReadyLesson: contentSummary.readyLessons > 0,
          hasThumbnail: Boolean(course.thumbnailUrl),
          moduleCount: data.modules.length,
          purchaseLink,
          status: course.status,
        })
      : null;
  const nextModuleSortOrder = contentData
    ? Math.max(...contentData.modules.map((module) => module.sortOrder), 0) + 1
    : 1;

  return {
    contentData,
    contentSignal,
    contentSummary,
    nextModuleSortOrder,
    operationalState,
    publicCourseUrl,
    purchaseLink,
  };
};

export default async function AdminCourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { courseId } = await params;
  const query = (await searchParams) ?? {};
  const activeTab = getCourseManagementTab(firstSearchParam(query.tab));
  const requestedEnrollmentPage = Number.parseInt(
    firstSearchParam(query.enrollmentPage) ?? "1",
    10
  );
  const enrollmentPage = Number.isFinite(requestedEnrollmentPage)
    ? requestedEnrollmentPage
    : 1;
  const enrollmentSearch = firstSearchParam(query.enrollmentQ)?.trim() ?? "";
  const enrollmentStatus = parseAdminEnrollmentStatusFilter(
    firstSearchParam(query.enrollmentStatus)
  );
  const enrollmentStudentId =
    firstSearchParam(query[ADMIN_COURSE_STUDENT_ID_PARAM])?.trim() ?? "";
  const enrollmentAction = parseAdminCourseStudentAction(
    firstSearchParam(query.enrollmentAction)
  );
  const data = await getAdminCourseTabData({
    courseId,
    enrollmentQuery: {
      page: enrollmentPage,
      search: enrollmentSearch,
      ...(enrollmentStatus === "all" ? {} : { status: enrollmentStatus }),
      ...(enrollmentStudentId ? { studentId: enrollmentStudentId } : {}),
    },
    tab: activeTab,
  });

  if (!data) {
    notFound();
  }

  const { course } = data;
  const courseAvailability = resolveCourseAvailability({
    catalogVisibility: course.catalogVisibility,
    deliveryStatus: course.status as "active" | "archived" | "draft",
    salesStatus: course.salesStatus,
  });
  const courseStatusPresentation = getCourseAvailabilityStatusPresentation(
    courseAvailability.preset
  );
  const {
    contentData,
    contentSignal,
    contentSummary,
    nextModuleSortOrder,
    operationalState,
    publicCourseUrl,
    purchaseLink,
  } = getCoursePageDerivedData(data);
  const certificateData =
    data.tab === "certificate"
      ? await Promise.all([
          getCertificateTemplatesForCourse(courseId),
          hasCertificateIssuerProfile(),
        ])
      : null;

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <Button asChild size="sm" variant="outline">
              <a href={route(`/app/cursos/${course.id}?preview=student`)}>
                <HugeiconsIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                  icon={ViewIcon}
                  size={16}
                  strokeWidth={2}
                />
                Ver como aluno
              </a>
            </Button>
          }
          description={
            course.subtitle || "Nenhum subtítulo cadastrado para este curso."
          }
          status={
            <Badge variant={courseStatusPresentation.variant}>
              {courseStatusPresentation.label}
            </Badge>
          }
          title={course.title}
        />

        <CourseManagementTabs
          certificate={
            data.tab === "certificate" && certificateData ? (
              <CertificateTemplateEditor
                certificateEnabled={course.certificateEnabled}
                courseId={course.id}
                courseWorkloadHours={course.workloadHours}
                issuerConfigured={certificateData[1]}
                pendingCertificateReconciliationCount={
                  course.pendingCertificateReconciliationCount
                }
                templates={certificateData[0]}
              />
            ) : null
          }
          content={
            data.tab === "content" && contentData && contentSignal ? (
              <CourseContentPanel
                contentSignal={contentSignal}
                course={course}
                lessons={contentData.lessons}
                modules={contentData.modules}
                nextModuleSortOrder={nextModuleSortOrder}
                publicationState={data.publicationState}
              />
            ) : null
          }
          overview={
            data.tab === "overview" && contentSummary && operationalState ? (
              <CourseOverview
                contentSummary={contentSummary}
                courseId={course.id}
                durationSeconds={course.workloadHours * SECONDS_PER_HOUR}
                moduleCount={data.modules.length}
                operationalState={operationalState}
                overviewSummary={data.overviewSummary}
                publicationState={data.publicationState}
              />
            ) : null
          }
          settings={
            data.tab === "settings" && purchaseLink && publicCourseUrl ? (
              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-2xl space-y-1">
                        <CardTitle as="h2" className="text-xl">
                          Configurações do curso
                        </CardTitle>
                        <CardDescription>
                          Dados que aparecem para o aluno e conectam o Curso ao
                          checkout externo.
                        </CardDescription>
                      </div>
                      <CoursePurchaseLink
                        link={purchaseLink}
                        publicUrl={publicCourseUrl}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 sm:py-4">
                    <CourseSettingsForm course={course} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="border-b py-4">
                    <CardTitle as="h2" className="text-lg">
                      Disponibilidade
                    </CardTitle>
                    <CardDescription>
                      Controle vitrine e novas vendas. Matrículas existentes não
                      são alteradas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="py-4">
                    <CourseAvailabilityForm course={course} />
                  </CardContent>
                </Card>
              </div>
            ) : null
          }
          students={
            data.tab === "students" ? (
              <section className="rounded-lg border bg-card">
                <div className="border-b px-5 py-4">
                  <h2 className="font-semibold text-xl">Alunos deste Curso</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Matrículas deste Curso, situação de acesso e ações
                    específicas do Curso.
                  </p>
                </div>
                <div className="p-4 sm:p-5">
                  <CourseEnrollmentsTable
                    courseId={course.id}
                    enrollments={data.enrollmentsPage.enrollments}
                    hasNextPage={data.enrollmentsPage.hasNextPage}
                    initialAction={enrollmentAction}
                    initialStudentId={enrollmentStudentId || undefined}
                    page={data.enrollmentsPage.page}
                    search={data.enrollmentsPage.search}
                    statusFilter={enrollmentStatus}
                    totalCount={data.enrollmentsPage.totalCount}
                  />
                </div>
              </section>
            ) : null
          }
        />
      </div>
    </PageContainer>
  );
}
