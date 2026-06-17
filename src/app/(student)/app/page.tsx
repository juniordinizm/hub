import { LockIcon, ShoppingBag03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getStudentCatalogAccessPresentation,
  getStudentCoursePrimaryHref,
} from "@/features/courses/presentation";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { getStudentCourseCatalog } from "@/features/courses/server";
import { startCourseCheckoutAction } from "@/features/payments/actions";

import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

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

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const courses = await getStudentCourseCatalog(session.user.id);
  const myCourses = courses.filter((c) => c.accessStatus === "active");

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
          <div className="flex flex-col gap-12">
            {myCourses.length > 0 && (
              <section>
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-bold text-xl">
                      Continue de onde parou
                    </h2>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Acesse seus cursos ativos e continue sua trilha de
                      aprendizado.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={route("/app/certificados")}>
                      Ver certificados
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {myCourses.map((course) => (
                    <CourseCard course={course} key={course.courseId} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-bold text-xl">Cursos disponíveis</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Explore nosso catálogo completo e descubra novos conteúdos.
                  </p>
                </div>
                {myCourses.length === 0 && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={route("/app/certificados")}>
                      Ver certificados
                    </Link>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard course={course} key={course.courseId} />
                ))}
              </div>
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
  const accessControls = getCourseAccessControls({
    accessHelper: access.helper,
    cardHref,
    course,
    hasActiveAccess,
    primaryHref,
  });

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/50">
      {/* Top Cover */}
      <div className="relative flex min-h-[220px] flex-col overflow-hidden bg-[#122425] p-5 pb-6">
        <div className="absolute right-0 bottom-4 -mr-4 select-none opacity-[0.03] transition-opacity group-hover:opacity-[0.05]">
          <span className="font-black text-[8rem] leading-none">
            {getInitials(course.title)}
          </span>
        </div>

        <div className="relative z-10 mb-8 flex items-center justify-between">
          <Badge
            className="w-fit border-transparent bg-white/10 text-white backdrop-blur-sm"
            variant="outline"
          >
            {access.label === "Acesso ativo" || access.label === "Ativo"
              ? "Matriculado"
              : access.label}
          </Badge>
          {!hasActiveAccess && (
            <div className="grid size-7 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm">
              <HugeiconsIcon icon={LockIcon} size={14} strokeWidth={2} />
            </div>
          )}
        </div>

        <div className="relative z-10">
          <h3 className="line-clamp-2 font-bold text-white text-xl">
            {course.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-medium text-white/70 text-xs">
            <span>{course.totalCount} aulas</span>
            <span className="text-white/30">·</span>
            <span>{course.workloadHours}h de carga</span>
          </div>
        </div>
      </div>

      {/* Bottom Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        {hasActiveAccess && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-xs">
                Progresso
              </span>
              <span className="font-bold text-primary text-xs">
                {course.progressPercent}%
              </span>
            </div>
            <Progress className="h-1.5 w-full" value={course.progressPercent} />
          </div>
        )}

        <div className="mt-auto">{accessControls}</div>
      </div>
    </article>
  );
}

function getCourseAccessControls({
  accessHelper,
  cardHref,
  course,
  hasActiveAccess,
  primaryHref,
}: {
  accessHelper: string;
  cardHref: Route;
  course: StudentCatalogCourseCard;
  hasActiveAccess: boolean;
  primaryHref: Route;
}): React.ReactNode {
  if (hasActiveAccess) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button asChild className="flex-1" size="sm">
          <Link href={primaryHref}>
            {course.nextLessonId ? "Continuar" : "Concluído"}
          </Link>
        </Button>
        <Button asChild className="flex-1" size="sm" variant="outline">
          <Link href={cardHref}>Ver trilha</Link>
        </Button>
      </div>
    );
  }

  if (course.accessStatus === "revoked") {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm leading-6">
          {accessHelper}
        </p>
        {course.supportWhatsappUrl ? (
          <Button asChild className="w-full" size="sm" variant="outline">
            <a href={course.supportWhatsappUrl} rel="noopener" target="_blank">
              Falar com suporte
            </a>
          </Button>
        ) : (
          <Button className="w-full" disabled size="sm" type="button">
            Fale com o suporte
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={startCourseCheckoutAction}>
      <input name="courseId" type="hidden" value={course.courseId} />
      <Button className="w-full" size="sm" type="submit">
        <HugeiconsIcon icon={ShoppingBag03Icon} size={16} strokeWidth={2} />
        {course.accessStatus === "expired"
          ? "Renovar acesso"
          : "Comprar acesso"}
      </Button>
    </form>
  );
}
