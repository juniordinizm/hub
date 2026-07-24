import {
  BookOpen01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
  Route03Icon,
  ShoppingBasketDone01Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { getActiveBannersData } from "@/features/banners/server";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import {
  formatCourseWorkload,
  getStudentCatalogAccessPresentation,
  getStudentCoursePrimaryHref,
  groupStudentCatalogCourses,
} from "@/features/courses/presentation";
import { canMutateStudentExperience } from "@/features/courses/preview";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { getStudentCourseCatalog } from "@/features/courses/server";
import { startCourseCheckoutAction } from "@/features/payments/actions";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { StudentBannersCarousel } from "./student-banners-carousel";

export const dynamic = "force-dynamic";

const WHITESPACE_RE = /\s+/;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const courses = await getStudentCourseCatalog(session.user.id);
  const groups = groupStudentCatalogCourses(courses);
  const { banners } = await getActiveBannersData();

  const _nextCourse = groups.active[0] ?? groups.completed[0] ?? courses[0];

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        {banners.length > 0 && <StudentBannersCarousel banners={banners} />}

        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Biblioteca de cursos
              </h1>
              <p className="text-muted-foreground text-sm">
                Acompanhe suas trilhas, retome a próxima aula e veja quais
                cursos estão disponíveis.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-12 pt-4">
          {courses.length === 0 ? (
            <EmptyCoursesState />
          ) : (
            <>
              {groups.active.length > 0 ? (
                <CourseSection
                  courses={groups.active}
                  description="Cursos com acesso ativo e aulas ainda pendentes."
                  title="Continue de onde parou"
                />
              ) : null}

              {groups.completed.length > 0 ? (
                <CourseSection
                  courses={groups.completed}
                  description="Cursos finalizados ficam aqui para revisão e certificado."
                  title="Trilhas concluídas"
                />
              ) : null}

              <CourseSection
                courses={groups.locked}
                description="Explore todos os cursos disponíveis na plataforma."
                title="Catálogo de cursos"
              />
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function EmptyCoursesState(): React.JSX.Element {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={BookOpen01Icon} />
        </EmptyMedia>
        <EmptyTitle>Nenhum curso publicado ainda</EmptyTitle>
        <EmptyDescription>
          Quando a equipe liberar o primeiro curso, ele aparecerá aqui com
          preço, carga horária e status de acesso.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function _getCourseButtonLabel(
  progressPercent: number,
  hasNextLesson: boolean
): string {
  if (progressPercent === 0) {
    return "Iniciar curso";
  }
  if (hasNextLesson) {
    return "Continuar curso";
  }
  return "Rever trilha";
}

function getShortCourseButtonLabel(
  progressPercent: number,
  hasNextLesson: boolean
): string {
  if (progressPercent === 0) {
    return "Iniciar";
  }
  if (hasNextLesson) {
    return "Continuar";
  }
  return "Rever";
}

function CourseSection({
  courses,
  description,
  title,
}: {
  courses: StudentCatalogCourseCard[];
  description: string;
  title: string;
}): React.JSX.Element | null {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-5">
        <h2 className="font-bold text-xl">{title}</h2>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex flex-wrap gap-5">
        {courses.map((course) => (
          <CourseCard course={course} key={course.courseId} />
        ))}
      </div>
    </section>
  );
}

function _InfoPill({
  icon,
  label,
}: {
  icon: typeof BookOpen01Icon;
  label: string;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-background/45 px-3 py-2 text-muted-foreground">
      <HugeiconsIcon icon={icon} />
      {label}
    </span>
  );
}

function CourseCard({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  const hasActiveAccess = course.accessStatus === "active";
  const access = getStudentCatalogAccessPresentation({
    accessStatus: course.accessStatus,
    expiresAt: course.expiresAt ?? new Date(),
    progressPercent: course.progressPercent,
    revokedReason: course.revokedReason,
  });
  const primaryHref = route(
    getStudentCoursePrimaryHref({
      courseId: course.courseId,
      nextLessonId: course.nextLessonId,
    })
  );
  const cardHref = route(`/app/cursos/${course.courseId}`);

  return (
    <article className="group relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-xl border bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:border-primary/45">
      <div className="absolute inset-0 z-0">
        {course.thumbnailUrl ? (
          <CourseCoverImage
            alt=""
            blurDataUrl={course.coverBlurDataUrl}
            className="opacity-70 transition-transform duration-500 group-hover:scale-105"
            sizes="340px"
            src={course.thumbnailUrl}
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-linear-to-br from-sidebar via-sidebar/95 to-primary/20" />
            <div className="absolute top-[20%] -right-4 select-none opacity-10 transition-transform duration-500 group-hover:scale-105">
              <span className="font-black text-[8rem] leading-none tracking-tighter">
                {getInitials(course.title)}
              </span>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-sidebar/80 to-sidebar" />

        {!hasActiveAccess && (
          <div className="absolute inset-0 flex items-start justify-center bg-background/60 pt-24 backdrop-blur-[2px]">
            <HugeiconsIcon
              className="text-sidebar-foreground/80 drop-shadow-md"
              icon={SquareLock02Icon}
              size={48}
            />
          </div>
        )}
      </div>

      <div className="relative z-10 flex min-h-[260px] flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <Badge
            className={
              hasActiveAccess
                ? ""
                : "border-sidebar-foreground/30 border-dashed bg-transparent text-sidebar-foreground/80 hover:bg-transparent"
            }
            variant={hasActiveAccess ? "default" : "outline"}
          >
            {hasActiveAccess && (
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
            )}
            {access.label}
          </Badge>
        </div>

        <div className="mt-auto pt-10">
          <h3 className="line-clamp-2 font-bold text-lg">
            <Link className="before:absolute before:inset-0" href={cardHref}>
              {course.title}
            </Link>
          </h3>
          <div className="mt-2 flex items-start gap-4">
            <div className="flex-1">
              {course.subtitle || course.description ? (
                <p className="line-clamp-2 text-sidebar-foreground/70 text-sm leading-5">
                  {course.subtitle ?? course.description}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 pt-0.5 text-right font-medium text-sidebar-foreground/60 text-xs">
              {course.totalCount} aulas •{" "}
              {formatCourseWorkload(course.totalDurationSeconds)}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-end p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="flex flex-col gap-5">
          {hasActiveAccess ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-sidebar-foreground/60 text-xs">
                <span>
                  {course.completedCount}/{course.totalCount} aulas
                </span>
                <span className="font-semibold text-sidebar-foreground">
                  {course.progressPercent}%
                </span>
              </div>
              <Progress
                aria-label={`Progresso no curso ${course.title}: ${course.progressPercent}%`}
                className="h-1 *:data-[slot=progress-indicator]:bg-emerald-500"
                value={course.progressPercent}
              />
            </div>
          ) : (
            <p className="text-sidebar-foreground/60 text-sm leading-6">
              {access.helper}
            </p>
          )}

          <CourseAccessControls
            cardHref={cardHref}
            course={course}
            hasActiveAccess={hasActiveAccess}
            primaryHref={primaryHref}
          />
        </div>
      </div>
    </article>
  );
}

function CourseAccessControls({
  cardHref,
  course,
  hasActiveAccess,
  primaryHref,
}: {
  cardHref: Route;
  course: StudentCatalogCourseCard;
  hasActiveAccess: boolean;
  primaryHref: Route;
}): React.JSX.Element {
  if (hasActiveAccess) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          className="flex-1 justify-start sm:justify-center"
          size="sm"
        >
          <Link href={primaryHref}>
            <HugeiconsIcon icon={PlayIcon} size={16} />
            {getShortCourseButtonLabel(
              course.progressPercent,
              Boolean(course.nextLessonId)
            )}
          </Link>
        </Button>
        <Button
          asChild
          className="flex-1 justify-start sm:justify-center"
          size="sm"
          variant="secondary"
        >
          <Link href={cardHref}>
            <HugeiconsIcon icon={Route03Icon} size={16} />
            Trilha
          </Link>
        </Button>
      </div>
    );
  }

  if (course.accessStatus === "revoked") {
    return (
      <SupportRequestDialog
        courseTitle={course.title}
        triggerClassName="w-full"
        triggerSize="sm"
      />
    );
  }

  return <CoursePurchaseForm course={course} />;
}

function CoursePurchaseForm({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  return (
    <form action={startCourseCheckoutAction}>
      <input name="courseId" type="hidden" value={course.courseId} />
      <Button className="w-full" size="sm" type="submit">
        <HugeiconsIcon icon={ShoppingBasketDone01Icon} />
        {course.accessStatus === "expired"
          ? "Renovar acesso"
          : "Adquirir acesso"}
      </Button>
    </form>
  );
}
