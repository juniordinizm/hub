import Link from "next/link";
import { notFound } from "next/navigation";
import { completeLessonAction } from "@/app/(student)/app/actions";
import { Button } from "@/components/ui/button";
import { getStudentLessonData } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const getLessonLinkClassName = ({
  isActive,
  isAvailable,
}: {
  isActive: boolean;
  isAvailable: boolean;
}): string => {
  if (isActive) {
    return "bg-[#326c71] text-white";
  }

  if (isAvailable) {
    return "text-teal-100/75 hover:bg-teal-100/10";
  }

  return "pointer-events-none text-teal-100/25";
};

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ busca?: string }>;
}): Promise<React.JSX.Element> {
  const [{ lessonId }, { busca }, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const data = await getStudentLessonData({
    userId: session.user.id,
    lessonId,
  });

  if (!data) {
    notFound();
  }

  const searchQuery = busca?.trim().toLowerCase() ?? "";
  const visibleModules = searchQuery
    ? data.modules
        .map((module) => ({
          ...module,
          lessons: module.lessons.filter((lesson) =>
            lesson.title.toLowerCase().includes(searchQuery)
          ),
        }))
        .filter((module) => module.lessons.length > 0)
    : data.modules;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_360px]">
      <section className="min-w-0 px-5 py-5 sm:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            className="text-sm text-teal-100/60 hover:text-teal-50"
            href={route("/app")}
          >
            Voltar ao inicio
          </Link>
          <form action={completeLessonAction}>
            <input name="lessonId" type="hidden" value={data.lesson.id} />
            <Button
              className="rounded-md bg-[#326c71] hover:bg-[#28595d]"
              type="submit"
            >
              Concluir aula
            </Button>
          </form>
        </div>
        <div className="aspect-video overflow-hidden rounded-md border border-teal-200/10 bg-black">
          {data.lesson.videoEmbedUrl ? (
            <iframe
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              src={data.lesson.videoEmbedUrl}
              title={data.lesson.title}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-teal-100/50">
              Video em configuracao
            </div>
          )}
        </div>
        <div className="mt-6">
          <p className="text-[#9aad7c] text-xs uppercase tracking-[0.16em]">
            {data.course.title} · {data.lesson.durationMinutes} min
          </p>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            {data.lesson.title}
          </h1>
          {data.lesson.description ? (
            <p className="mt-4 max-w-3xl text-teal-100/65 leading-7">
              {data.lesson.description}
            </p>
          ) : null}
        </div>
      </section>
      <aside className="border-teal-200/10 border-l bg-[#0d1e20] px-4 py-5">
        <div className="mb-5">
          <p className="font-semibold text-sm">Conteudo do curso</p>
          <div className="mt-3 h-2 rounded-full bg-teal-950">
            <div
              className="h-full rounded-full bg-[#d97b34]"
              style={{ width: `${data.progressPercent}%` }}
            />
          </div>
          <form className="mt-4" method="get">
            <input
              className="h-10 w-full rounded-md border border-teal-200/10 bg-[#162b2d] px-3 text-sm text-teal-50 outline-none placeholder:text-teal-100/30"
              defaultValue={busca ?? ""}
              name="busca"
              placeholder="Buscar aula"
            />
          </form>
        </div>
        <div className="grid gap-4">
          {visibleModules.map((module) => (
            <section key={module.id}>
              <h2 className="mb-2 font-semibold text-teal-100 text-xs uppercase tracking-[0.13em]">
                Modulo {module.sortOrder}
              </h2>
              <div className="grid gap-1">
                {module.lessons.map((lesson) => (
                  <Link
                    aria-disabled={!lesson.isAvailable}
                    className={`rounded-md px-3 py-2 text-sm ${getLessonLinkClassName(
                      {
                        isActive: lesson.id === data.lesson.id,
                        isAvailable: lesson.isAvailable,
                      }
                    )}`}
                    href={route(
                      lesson.isAvailable ? `/app/aulas/${lesson.id}` : "#"
                    )}
                    key={lesson.id}
                  >
                    {lesson.isCompleted ? "✓ " : ""}
                    {lesson.title}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
        {data.course.supportWhatsappUrl ? (
          <a
            className="mt-6 inline-flex w-full justify-center rounded-md border border-teal-200/15 px-4 py-2 text-sm text-teal-100/80 hover:bg-teal-100/10"
            href={data.course.supportWhatsappUrl}
            rel="noopener"
            target="_blank"
          >
            Falar com suporte
          </a>
        ) : null}
      </aside>
    </div>
  );
}
