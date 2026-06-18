import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Certificate01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  LockIcon,
  PlayCircleIcon,
  ShoppingBag03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getStudentCatalogAccessPresentation,
  getStudentCoursePrimaryHref,
  groupStudentCatalogCourses,
} from "@/features/courses/presentation";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { getStudentCourseCatalog } from "@/features/courses/server";
import { startCourseCheckoutAction } from "@/features/payments/actions";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function getInitials(title: string): string {
  return (
    title
      .split(" ")
      .filter((word) => word.length > 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || title.slice(0, 2).toUpperCase()
  );
}

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const courses = await getStudentCourseCatalog(session.user.id);
  const groups = groupStudentCatalogCourses(courses);
  const completedCount = groups.completed.length;
  const activeCount = groups.active.length + groups.completed.length;
  const nextCourse = groups.active[0] ?? groups.completed[0] ?? courses[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-border/50 border-b px-6 py-8 sm:px-10 lg:px-12">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <Badge variant="secondary">PROTEA-R Hub</Badge>
            <h1 className="mt-4 max-w-3xl font-extrabold text-3xl tracking-tight md:text-5xl">
              Sua biblioteca de cursos privados
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground text-sm leading-6 md:text-base">
              Acompanhe suas trilhas, retome a próxima aula e veja quais cursos
              ainda estão disponíveis para liberar acesso.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-card p-4">
            <Metric label="Acessos" value={activeCount.toString()} />
            <Metric label="Concluídos" value={completedCount.toString()} />
            <Metric label="Catálogo" value={courses.length.toString()} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-12 px-6 py-9 sm:px-10 lg:px-12">
        {courses.length === 0 ? (
          <EmptyCoursesState />
        ) : (
          <>
            {nextCourse ? <NextCoursePanel course={nextCourse} /> : null}

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
              description="Compre, renove ou regularize acesso para entrar na trilha."
              title="Disponíveis para acesso"
            />
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-md bg-background/45 px-3 py-3">
      <p className="font-bold text-2xl tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function EmptyCoursesState(): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-6">
      <Badge variant="outline">Catálogo vazio</Badge>
      <h2 className="mt-4 font-bold text-xl">Nenhum curso publicado ainda</h2>
      <p className="mt-2 max-w-xl text-muted-foreground text-sm leading-6">
        Quando a equipe liberar o primeiro curso, ele aparecerá aqui com preço,
        carga horária e status de acesso.
      </p>
    </section>
  );
}

function NextCoursePanel({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  const hasActiveAccess = course.accessStatus === "active";
  const href = route(
    getStudentCoursePrimaryHref({
      courseId: course.courseId,
      nextLessonId: course.nextLessonId,
    })
  );

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-6 sm:p-7">
          <Badge variant={hasActiveAccess ? "default" : "outline"}>
            {hasActiveAccess ? "Próximo passo" : "Curso em destaque"}
          </Badge>
          <h2 className="mt-4 max-w-2xl font-bold text-2xl tracking-tight">
            {course.title}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
            {course.subtitle ??
              course.description ??
              "Uma trilha privada para avançar com acompanhamento e certificado."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <InfoPill
              icon={BookOpen01Icon}
              label={`${course.totalCount} aulas`}
            />
            <InfoPill icon={Clock01Icon} label={`${course.workloadHours}h`} />
            {course.progressPercent >= 100 ? (
              <InfoPill icon={Certificate01Icon} label="Certificado liberado" />
            ) : null}
          </div>
        </div>
        <div className="flex flex-col justify-between border-border/60 border-t bg-muted/25 p-6 lg:border-t-0 lg:border-l">
          {hasActiveAccess ? (
            <>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold">
                    {course.progressPercent}%
                  </span>
                </div>
                <Progress className="mt-3 h-2" value={course.progressPercent} />
                <p className="mt-3 text-muted-foreground text-sm">
                  {course.completedCount} de {course.totalCount} aulas
                  concluídas.
                </p>
              </div>
              <Button asChild className="mt-6">
                <Link href={href}>
                  {course.nextLessonId ? "Continuar curso" : "Rever trilha"}
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                </Link>
              </Button>
            </>
          ) : (
            <CoursePurchaseForm course={course} />
          )}
        </div>
      </div>
    </section>
  );
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
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-bold text-xl">{title}</h2>
          <p className="mt-1 text-muted-foreground text-sm">{description}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={route("/app/certificados")}>Ver certificados</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <CourseCard course={course} key={course.courseId} />
        ))}
      </div>
    </section>
  );
}

function InfoPill({
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
    <article className="group flex min-h-[410px] flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:border-primary/45">
      <div className="relative flex min-h-48 flex-col justify-between overflow-hidden bg-sidebar p-5 text-sidebar-foreground">
        {course.thumbnailUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-center bg-cover opacity-35 transition-opacity group-hover:opacity-45"
            style={{ backgroundImage: `url(${course.thumbnailUrl})` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar/90 to-primary/20" />
        <div className="relative flex items-start justify-between gap-3">
          <Badge variant={hasActiveAccess ? "default" : "secondary"}>
            {access.label}
          </Badge>
          <span className="grid size-9 place-items-center rounded-md bg-background/10">
            <HugeiconsIcon
              icon={hasActiveAccess ? PlayCircleIcon : LockIcon}
              strokeWidth={2}
            />
          </span>
        </div>
        <div className="relative">
          <p className="font-black text-5xl text-sidebar-foreground/15">
            {getInitials(course.title)}
          </p>
          <h3 className="mt-3 line-clamp-2 font-bold text-xl">
            {course.title}
          </h3>
          <p className="mt-2 text-sidebar-foreground/70 text-xs">
            {course.totalCount} aulas · {course.workloadHours}h ·{" "}
            {formatCurrencyInCents(course.priceInCents)}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
        <div className="flex flex-col gap-4">
          {hasActiveAccess ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold">{course.progressPercent}%</span>
              </div>
              <Progress className="h-1.5" value={course.progressPercent} />
              <p className="mt-2 text-muted-foreground text-xs">
                Acesso até{" "}
                {course.expiresAt ? formatDate(course.expiresAt) : "-"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm leading-6">
              {access.helper}
            </p>
          )}
          {course.progressPercent >= 100 ? (
            <Badge className="w-fit" variant="outline">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} />
              Curso concluído
            </Badge>
          ) : null}
        </div>

        <CourseAccessControls
          cardHref={cardHref}
          course={course}
          hasActiveAccess={hasActiveAccess}
          primaryHref={primaryHref}
        />
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
      <div className="flex flex-wrap gap-2">
        <Button asChild className="flex-1" size="sm">
          <Link href={primaryHref}>
            {course.nextLessonId ? "Continuar" : "Rever"}
          </Link>
        </Button>
        <Button asChild className="flex-1" size="sm" variant="outline">
          <Link href={cardHref}>Trilha</Link>
        </Button>
      </div>
    );
  }

  if (course.accessStatus === "revoked") {
    return course.supportWhatsappUrl ? (
      <Button asChild className="w-full" size="sm" variant="outline">
        <a href={course.supportWhatsappUrl} rel="noopener" target="_blank">
          Falar com suporte
        </a>
      </Button>
    ) : (
      <Button className="w-full" disabled size="sm" type="button">
        Fale com o suporte
      </Button>
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
        <HugeiconsIcon icon={ShoppingBag03Icon} />
        {course.accessStatus === "expired"
          ? "Renovar acesso"
          : "Comprar acesso"}
      </Button>
    </form>
  );
}
