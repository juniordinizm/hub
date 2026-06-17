import { LockIcon, ShoppingBag03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getCourseAccessPresentation,
  getStudentCoursePrimaryHref,
} from "@/features/courses/presentation";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { getStudentCourseCatalog } from "@/features/courses/server";
import { startCourseCheckoutAction } from "@/features/payments/actions";
import { formatCurrencyInCents } from "@/lib/formatters";
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
  const courses = await getStudentCourseCatalog(session.user.id);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-border/50 border-b px-6 py-8 sm:px-10 lg:px-12">
        <h1 className="max-w-3xl font-extrabold text-3xl tracking-tight md:text-4xl">
          Meus cursos
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6">
          Escolha seu próximo curso, acompanhe seus acessos ativos e continue de
          onde parou.
        </p>
      </section>

      <div className="px-6 py-9 sm:px-10 lg:px-12">
        {courses.length === 0 ? (
          <EmptyCoursesState />
        ) : (
          <section>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-bold text-xl">Cursos disponíveis</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Cada curso tem compra, acesso, progresso e certificado
                  próprios.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={route("/app/certificados")}>Ver certificados</Link>
              </Button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {courses.map((course) => (
                <CourseCard course={course} key={course.courseId} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EmptyCoursesState(): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-6">
      <Badge variant="outline">Sem cursos publicados</Badge>
      <h2 className="mt-4 font-bold text-xl">A vitrine ainda está vazia</h2>
      <p className="mt-2 max-w-xl text-muted-foreground text-sm leading-6">
        Assim que um curso for publicado pela equipe, ele aparecerá aqui para
        compra ou continuação.
      </p>
    </section>
  );
}

function CourseCard({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  const access = course.isEnrolled
    ? getCourseAccessPresentation({
        expiresAt: course.expiresAt ?? new Date(),
        progressPercent: course.progressPercent,
      })
    : { label: "Acesso bloqueado", tone: "expiring" as const };
  const primaryHref = route(
    getStudentCoursePrimaryHref({
      courseId: course.courseId,
      nextLessonId: course.nextLessonId,
    })
  );
  const cardHref = route(`/app/cursos/${course.courseId}`);

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-sm">
      {course.isEnrolled ? (
        <Link className="group block" href={cardHref}>
          <CourseCover access={access} course={course} />
        </Link>
      ) : (
        <div className="relative">
          <CourseCover access={access} course={course} />
          <div className="absolute top-3 right-3 grid size-9 place-items-center rounded-full border border-white/20 bg-background/85 text-foreground shadow-sm">
            <HugeiconsIcon icon={LockIcon} size={18} strokeWidth={2} />
          </div>
        </div>
      )}
      <div className="space-y-4 p-5">
        {course.subtitle ? (
          <p className="line-clamp-2 text-muted-foreground text-sm leading-6">
            {course.subtitle}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
          <span>{course.totalCount} aulas</span>
          <span className="text-foreground/20">·</span>
          <span>{course.workloadHours}h de carga</span>
          <span className="text-foreground/20">·</span>
          <span>{formatCurrencyInCents(course.priceInCents)}</span>
        </div>
        {course.isEnrolled ? (
          <>
            <div className="flex items-center gap-3">
              <Progress
                className="h-1.5 flex-1"
                value={course.progressPercent}
              />
              <span className="font-semibold text-xs">
                {course.progressPercent}%
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={primaryHref}>
                  {course.nextLessonId ? "Continuar curso" : "Ver conclusão"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={cardHref}>Ver trilha</Link>
              </Button>
            </div>
          </>
        ) : (
          <form action={startCourseCheckoutAction}>
            <input name="courseId" type="hidden" value={course.courseId} />
            <Button className="w-full" type="submit">
              <HugeiconsIcon
                icon={ShoppingBag03Icon}
                size={18}
                strokeWidth={2}
              />
              Comprar acesso
            </Button>
          </form>
        )}
      </div>
    </article>
  );
}

function CourseCover({
  access,
  course,
}: {
  access: { label: string; tone: keyof typeof toneClasses };
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  return (
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
  );
}
