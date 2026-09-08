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
  getAdminCourseDetailData,
  getAdminCourseOverviewSummary,
  getAdminCoursePublicationState,
} from "@/features/admin/server";
import { getCourseAvailabilityStatusPresentation } from "@/features/admin/status-presentation";
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

export default async function AdminCourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { courseId } = await params;
  const query = (await searchParams) ?? {};
  const requestedEnrollmentPage = Number.parseInt(
    firstSearchParam(query.enrollmentPage) ?? "1",
    10
  );
  const enrollmentPage = Number.isFinite(requestedEnrollmentPage)
    ? requestedEnrollmentPage
    : 1;
  const enrollmentSearch = firstSearchParam(query.enrollmentQ)?.trim() ?? "";
  const [
    data,
    overviewSummary,
    certificateTemplates,
    publicationState,
    issuerConfigured,
  ] = await Promise.all([
    getAdminCourseDetailData(courseId, {
      page: enrollmentPage,
      search: enrollmentSearch,
    }),
    getAdminCourseOverviewSummary(courseId),
    getCertificateTemplatesForCourse(courseId),
    getAdminCoursePublicationState(courseId),
    hasCertificateIssuerProfile(),
  ]);

  if (!data) {
    notFound();
  }

  const { course, enrollments, lessons, modules } = data;
  const courseAvailability = resolveCourseAvailability({
    catalogVisibility: course.catalogVisibility,
    deliveryStatus: course.status as "active" | "archived" | "draft",
    salesStatus: course.salesStatus,
  });
  const courseStatusPresentation = getCourseAvailabilityStatusPresentation(
    courseAvailability.preset
  );
  const serverEnv = getServerEnv();
  const purchaseLink = getCoursePurchaseLink({
    appUrl: serverEnv.NEXT_PUBLIC_APP_URL,
    checkoutMode: serverEnv.PAYMENTS_CHECKOUT_MODE,
    course: {
      hasPublishedPublication: publicationState.hasPublished,
      priceInCents: course.priceInCents,
      salesStatus: course.salesStatus,
      slug: course.slug,
      status: course.status,
    },
  });
  const publicCourseUrl = new URL(
    `/comprar/${encodeURIComponent(course.slug)}`,
    serverEnv.NEXT_PUBLIC_APP_URL
  ).toString();
  modules.sort((a, b) => a.sortOrder - b.sortOrder);
  const contentSummary = summarizeAdminCourseContent({ lessons, modules });
  const contentSignal = getAdminCourseContentSignal(contentSummary);
  const operationalState = getAdminCourseOperationalState({
    hasDescription: Boolean(course.description?.trim()),
    hasDraft: publicationState.hasDraft,
    hasPublished: publicationState.hasPublished,
    hasReadyLesson: contentSummary.readyLessons > 0,
    hasThumbnail: Boolean(course.thumbnailUrl),
    moduleCount: modules.length,
    purchaseLink,
    status: course.status,
  });
  const nextModuleSortOrder =
    modules.length > 0 ? Math.max(...modules.map((m) => m.sortOrder)) + 1 : 1;

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
                Ver como aluna
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
            <CertificateTemplateEditor
              certificateEnabled={course.certificateEnabled}
              courseId={course.id}
              courseWorkloadHours={course.workloadHours}
              issuerConfigured={issuerConfigured}
              pendingCertificateReconciliationCount={
                course.pendingCertificateReconciliationCount
              }
              templates={certificateTemplates}
            />
          }
          content={
            <CourseContentPanel
              contentSignal={contentSignal}
              course={course}
              lessons={lessons}
              modules={modules}
              nextModuleSortOrder={nextModuleSortOrder}
              publicationState={publicationState}
            />
          }
          overview={
            <CourseOverview
              contentSummary={contentSummary}
              courseId={course.id}
              durationSeconds={course.workloadHours * SECONDS_PER_HOUR}
              moduleCount={modules.length}
              operationalState={operationalState}
              overviewSummary={overviewSummary}
              publicationState={publicationState}
            />
          }
          settings={
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="border-b">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl space-y-1">
                      <CardTitle as="h2" className="text-xl">
                        Configurações do curso
                      </CardTitle>
                      <CardDescription>
                        Dados que aparecem para a aluna e conectam o Curso ao
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
          }
          students={
            <section className="rounded-lg border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-xl">Alunas deste Curso</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Últimas matrículas e situação de acesso.
                </p>
              </div>
              <CourseEnrollmentsTable
                courseId={course.id}
                enrollments={enrollments}
                hasNextPage={data.enrollmentsPage.hasNextPage}
                page={data.enrollmentsPage.page}
                pageSize={data.enrollmentsPage.pageSize}
                search={data.enrollmentsPage.search}
                totalCount={data.enrollmentsPage.totalCount}
              />
            </section>
          }
        />
      </div>
    </PageContainer>
  );
}
