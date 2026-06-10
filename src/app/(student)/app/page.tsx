import Link from "next/link";
import {
  getPublishedFaqItems,
  getStudentCourses,
  getSupportWhatsappUrl,
} from "@/features/courses/server";
import { formatDate, formatPercent } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const [courses, faqs, supportWhatsappUrl] = await Promise.all([
    getStudentCourses(session.user.id),
    getPublishedFaqItems(),
    getSupportWhatsappUrl(),
  ]);

  return (
    <div className="min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <header className="mx-auto max-w-6xl">
        <p className="font-semibold text-[#d97b34] text-xs uppercase tracking-[0.18em]">
          Seus cursos
        </p>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Continue de onde parou
        </h1>
      </header>
      <section className="mx-auto mt-8 grid max-w-6xl gap-5">
        {courses.length === 0 ? (
          <div className="rounded-md border border-teal-200/10 bg-[#162b2d] p-8">
            <h2 className="font-semibold text-xl">Nenhum curso ativo</h2>
            <p className="mt-2 text-sm text-teal-100/60">
              Sua conta existe, mas nao ha uma matricula ativa no momento.
            </p>
          </div>
        ) : (
          courses.map((course) => (
            <article
              className="overflow-hidden rounded-md border border-teal-200/10 bg-[#162b2d]"
              key={course.courseId}
            >
              <div className="grid gap-6 p-6 md:grid-cols-[1fr_220px] md:items-center">
                <div>
                  <p className="text-[#9aad7c] text-xs uppercase tracking-[0.16em]">
                    Acesso ate {formatDate(course.expiresAt)}
                  </p>
                  <h2 className="mt-3 font-bold text-2xl">{course.title}</h2>
                  <p className="mt-2 text-sm text-teal-100/60">
                    {course.subtitle ?? "Curso liberado na sua area de aluna."}
                  </p>
                  <div className="mt-5 h-2 rounded-full bg-teal-950">
                    <div
                      className="h-full rounded-full bg-[#d97b34]"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-teal-100/50 text-xs">
                    {course.completedCount} de {course.totalCount} aulas
                    concluidas · {formatPercent(course.progressPercent)}
                  </p>
                </div>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#326c71] px-4 font-bold text-sm text-white hover:bg-[#28595d]"
                  href={route(
                    course.nextLessonId
                      ? `/app/aulas/${course.nextLessonId}`
                      : "/app/certificados"
                  )}
                >
                  {course.nextLessonId
                    ? "Continuar assistindo"
                    : "Ver certificado"}
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-md border border-teal-200/10 bg-[#162b2d] p-6">
          <h2 className="font-bold text-xl">Perguntas frequentes</h2>
          <div className="mt-5 grid gap-4">
            {faqs.map((faq) => (
              <article
                className="border-teal-200/10 border-t pt-4"
                key={faq.id}
              >
                <p className="font-semibold">{faq.question}</p>
                <p className="mt-2 text-sm text-teal-100/60">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
        {supportWhatsappUrl ? (
          <a
            className="flex min-h-44 flex-col justify-between rounded-md border border-teal-200/10 bg-[#326c71] p-6 text-white hover:bg-[#28595d]"
            href={supportWhatsappUrl}
            rel="noopener"
            target="_blank"
          >
            <span className="font-bold text-xl">Precisa de ajuda?</span>
            <span className="text-sm text-white/75">
              Fale com o suporte pelo WhatsApp.
            </span>
          </a>
        ) : null}
      </section>
    </div>
  );
}
