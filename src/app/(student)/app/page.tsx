import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getCourseAccessPresentation,
  getStudentCoursePrimaryHref,
} from "@/features/courses/presentation";
import type { StudentCourseCard } from "@/features/courses/server";
import { getStudentCourses } from "@/features/courses/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const isLocalImage = (value: string | null): value is string =>
  Boolean(value?.startsWith("/"));

const toneClasses = {
  active: "border-primary/30 bg-primary/15 text-primary",
  completed: "border-emerald-400/35 bg-emerald-400/15 text-emerald-200",
  expiring: "border-accent/40 bg-accent/20 text-accent",
} as const;

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const courses = await getStudentCourses(session.user.id);
  const completedLessons = courses.reduce(
    (total, course) => total + course.completedCount,
    0
  );
  const totalLessons = courses.reduce(
    (total, course) => total + course.totalCount,
    0
  );
  const overallProgress =
    totalLessons === 0
      ? 0
      : Math.round((completedLessons / totalLessons) * 100);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-border/50 border-b px-6 py-8 sm:px-10 lg:px-12">
        <Badge
          className="border-accent/35 bg-accent/15 text-accent"
          variant="outline"
        >
          Plataforma privada
        </Badge>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <h1 className="max-w-3xl font-extrabold text-3xl tracking-tight md:text-4xl">
              Meus cursos
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6">
              Acompanhe seus acessos ativos, continue de onde parou e veja a
              trilha de cada curso separadamente.
            </p>
          </div>
          <div className="rounded-lg border bg-card/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Progresso geral</p>
                <p className="mt-1 font-semibold text-2xl">
                  {overallProgress}%
                </p>
              </div>
              <p className="text-right text-muted-foreground text-xs">
                {completedLessons} de {totalLessons} aulas concluídas
              </p>
            </div>
            <Progress className="mt-4 h-1.5" value={overallProgress} />
          </div>
        </div>
      </section>

      <div className="px-6 py-9 sm:px-10 lg:px-12">
        {courses.length === 0 ? (
          <EmptyCoursesState />
        ) : (
          <div className="space-y-10">
            <section>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-bold text-xl">Cursos disponíveis</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Cada curso tem acesso, progresso e certificado próprios.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={route("/app/certificados")}>
                    Ver certificados
                  </Link>
                </Button>
              </div>
              <div className="grid gap-5 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard course={course} key={course.courseId} />
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              {courses.map((course) => (
                <CourseModulesPanel course={course} key={course.courseId} />
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyCoursesState(): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-6">
      <Badge variant="outline">Sem matrícula ativa</Badge>
      <h2 className="mt-4 font-bold text-xl">Nenhum curso ativo</h2>
      <p className="mt-2 max-w-xl text-muted-foreground text-sm leading-6">
        Sua conta já existe, mas ainda não há uma matrícula ativa. Quando um
        acesso for liberado, seus cursos aparecerão aqui.
      </p>
    </section>
  );
}

function CourseCard({
  course,
}: {
  course: StudentCourseCard;
}): React.JSX.Element {
  const access = getCourseAccessPresentation({
    expiresAt: course.expiresAt,
    progressPercent: course.progressPercent,
  });
  const primaryHref = route(
    getStudentCoursePrimaryHref({
      courseId: course.courseId,
      nextLessonId: course.nextLessonId,
    })
  );

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Link
        className="group block"
        href={route(`/app/cursos/${course.courseId}`)}
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {isLocalImage(course.thumbnailUrl) ? (
            <Image
              alt={course.title}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              fill
              sizes="(min-width: 1280px) 33vw, 100vw"
              src={course.thumbnailUrl}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(217,123,52,0.5),transparent_28%),linear-gradient(135deg,#326c71,#162b2d_60%,#0f2224)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
          <Badge
            className={`absolute top-3 left-3 ${toneClasses[access.tone]}`}
            variant="outline"
          >
            {access.label}
          </Badge>
          <div className="absolute right-3 bottom-3 left-3">
            <p className="line-clamp-2 font-bold text-lg text-white">
              {course.title}
            </p>
          </div>
        </div>
      </Link>
      <div className="space-y-4 p-5">
        {course.subtitle ? (
          <p className="line-clamp-2 text-muted-foreground text-sm leading-6">
            {course.subtitle}
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Metric label="Aulas" value={course.totalCount.toString()} />
          <Metric label="Carga" value={`${course.workloadHours}h`} />
          <Metric label="Acesso" value={formatDate(course.expiresAt)} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{access.helper}</span>
            <span className="font-semibold">{course.progressPercent}%</span>
          </div>
          <Progress className="h-1.5" value={course.progressPercent} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={primaryHref}>
              {course.nextLessonId ? "Continuar curso" : "Ver conclusão"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={route(`/app/cursos/${course.courseId}`)}>
              Ver trilha
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function CourseModulesPanel({
  course,
}: {
  course: StudentCourseCard;
}): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs">Trilha do curso</p>
          <h3 className="mt-1 line-clamp-2 font-semibold">{course.title}</h3>
        </div>
        <Badge variant="outline">{course.modules.length} módulos</Badge>
      </div>
      <div className="mt-5 space-y-3">
        {course.modules.map((moduleData) => (
          <Link
            className="flex items-center gap-3 rounded-md border bg-background/35 p-3 transition-colors hover:bg-background/60"
            href={route(
              moduleData.nextLessonId
                ? `/app/aulas/${moduleData.nextLessonId}`
                : `/app/cursos/${course.courseId}`
            )}
            key={moduleData.id}
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: moduleData.color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-sm">
                Módulo {moduleData.sortOrder}: {moduleData.title}
              </span>
              <span className="mt-1 block text-muted-foreground text-xs">
                {moduleData.completedCount} de {moduleData.totalCount} aulas
                concluídas
              </span>
            </span>
            <span className="font-semibold text-xs">
              {moduleData.progressPercent}%
            </span>
          </Link>
        ))}
      </div>
    </section>
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
    <div className="rounded-md border bg-background/35 px-3 py-2">
      <p className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.08em]">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-xs" title={value}>
        {value}
      </p>
    </div>
  );
}
