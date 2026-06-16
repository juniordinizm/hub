import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getCourseAccessPresentation,
  getStudentCoursePrimaryHref,
} from "@/features/courses/presentation";
import { getStudentCourseOverviewData } from "@/features/courses/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const isLocalImage = (value: string | null): value is string =>
  Boolean(value?.startsWith("/"));

const lessonTypeLabels: Record<string, string> = {
  bonus: "Bônus",
  presentation: "Apresentação",
  video: "Vídeo",
};

export default async function StudentCourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<React.JSX.Element> {
  const [{ courseId }, session] = await Promise.all([params, requireSession()]);
  const data = await getStudentCourseOverviewData({
    courseId,
    userId: session.user.id,
  });

  if (!data) {
    notFound();
  }

  const access = getCourseAccessPresentation({
    expiresAt: data.course.expiresAt,
    progressPercent: data.progressPercent,
  });
  const primaryHref = route(
    getStudentCoursePrimaryHref({
      courseId: data.course.id,
      nextLessonId: data.nextLessonId,
    })
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="grid border-border/50 border-b lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="px-6 py-8 sm:px-10 lg:px-12 lg:py-12">
          <Button asChild size="sm" variant="ghost">
            <Link href={route("/app")}>Voltar para meus cursos</Link>
          </Button>
          <div className="mt-6 max-w-3xl">
            <Badge
              className="border-accent/35 bg-accent/15 text-accent"
              variant="outline"
            >
              {access.label}
            </Badge>
            <h1 className="mt-4 font-extrabold text-3xl tracking-tight md:text-5xl">
              {data.course.title}
            </h1>
            {data.course.subtitle ? (
              <p className="mt-4 text-base text-muted-foreground leading-7">
                {data.course.subtitle}
              </p>
            ) : null}
          </div>
          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            <Metric label="Aulas" value={data.totalCount.toString()} />
            <Metric
              label="Carga horária"
              value={`${data.course.workloadHours}h`}
            />
            <Metric
              label="Acesso até"
              value={formatDate(data.course.expiresAt)}
            />
          </div>
        </div>
        <aside className="border-border/50 border-t bg-card/70 p-6 lg:border-t-0 lg:border-l lg:p-8">
          <CourseCover
            courseTitle={data.course.title}
            src={data.course.thumbnailUrl}
          />
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-semibold">{data.progressPercent}%</span>
            </div>
            <Progress className="mt-3 h-2" value={data.progressPercent} />
            <p className="mt-3 text-muted-foreground text-sm">
              {access.helper}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link href={primaryHref}>
                {data.nextLessonId ? "Continuar curso" : "Rever trilha"}
              </Link>
            </Button>
            {data.certificateCode ? (
              <Button asChild variant="outline">
                <Link href={route(`/certificados/${data.certificateCode}`)}>
                  Ver certificado
                </Link>
              </Button>
            ) : null}
            {data.course.supportWhatsappUrl ? (
              <Button asChild variant="secondary">
                <a
                  href={data.course.supportWhatsappUrl}
                  rel="noopener"
                  target="_blank"
                >
                  Falar com suporte
                </a>
              </Button>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="grid gap-8 px-6 py-9 sm:px-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-12">
        <div>
          <h2 className="font-bold text-xl">Trilha do curso</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            As aulas liberam em sequência para manter a progressão organizada.
          </p>
          <div className="mt-5 space-y-4">
            {data.modules.map((moduleData) => (
              <section
                className="rounded-lg border bg-card"
                key={moduleData.id}
              >
                <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Módulo {moduleData.sortOrder}
                    </p>
                    <h3 className="font-semibold">{moduleData.title}</h3>
                    {moduleData.description ? (
                      <p className="mt-1 text-muted-foreground text-sm">
                        {moduleData.description}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline">
                    {moduleData.lessons.length} aulas
                  </Badge>
                </div>
                <div className="divide-y">
                  {moduleData.lessons.map((lesson) => (
                    <LessonRow key={lesson.id} lesson={lesson} />
                  ))}
                  {moduleData.lessons.length === 0 ? (
                    <p className="px-5 py-4 text-muted-foreground text-sm">
                      Nenhuma aula publicada neste módulo.
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
        <aside className="h-fit rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Sobre este curso</h2>
          {data.course.description ? (
            <p className="mt-3 text-muted-foreground text-sm leading-7">
              {data.course.description}
            </p>
          ) : (
            <p className="mt-3 text-muted-foreground text-sm leading-7">
              A descrição ainda não foi cadastrada no admin.
            </p>
          )}
          <div className="mt-5 space-y-3 border-t pt-5 text-sm">
            <InfoRow
              label="Instrutora"
              value={data.course.instructorName ?? "Equipe PROTEA-R"}
            />
            <InfoRow
              label="Concluídas"
              value={`${data.completedCount} de ${data.totalCount}`}
            />
            <InfoRow
              label="Certificado"
              value={data.certificateCode ? "Emitido" : "Ao concluir"}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function CourseCover({
  courseTitle,
  src,
}: {
  courseTitle: string;
  src: string | null;
}): React.JSX.Element {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg border bg-muted">
      {isLocalImage(src) ? (
        <Image
          alt={courseTitle}
          className="object-cover"
          fill
          sizes="390px"
          src={src}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(217,123,52,0.55),transparent_26%),linear-gradient(135deg,#326c71,#162b2d_58%,#0f2224)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
      <span className="absolute right-4 bottom-4 left-4 line-clamp-2 font-bold text-white">
        {courseTitle}
      </span>
    </div>
  );
}

function LessonRow({
  lesson,
}: {
  lesson: StudentCourseOverviewDataLesson;
}): React.JSX.Element {
  const stateLabel = getLessonStateLabel(lesson);
  const stateClassName = getLessonStateClassName(lesson);

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`mt-1 size-2.5 rounded-full ${stateClassName}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{lesson.title}</span>
        <span className="mt-1 block text-muted-foreground text-xs">
          {lessonTypeLabels[lesson.lessonType] ?? "Aula"} ·{" "}
          {lesson.durationMinutes} min · {stateLabel}
        </span>
      </span>
    </>
  );

  if (!lesson.isAvailable) {
    return (
      <div className="flex items-start gap-3 px-5 py-4 text-muted-foreground">
        {content}
      </div>
    );
  }

  return (
    <Link
      className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-background/45"
      href={route(`/app/aulas/${lesson.id}`)}
    >
      {content}
    </Link>
  );
}

function getLessonStateLabel({
  isAvailable,
  isCompleted,
}: {
  isAvailable: boolean;
  isCompleted: boolean;
}): string {
  if (isCompleted) {
    return "Concluída";
  }

  if (isAvailable) {
    return "Liberada";
  }

  return "Bloqueada";
}

function getLessonStateClassName({
  isAvailable,
  isCompleted,
}: {
  isAvailable: boolean;
  isCompleted: boolean;
}): string {
  if (isCompleted) {
    return "bg-emerald-400";
  }

  if (isAvailable) {
    return "bg-accent";
  }

  return "bg-muted-foreground/35";
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 truncate font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

type StudentCourseOverviewDataLesson = NonNullable<
  Awaited<ReturnType<typeof getStudentCourseOverviewData>>
>["modules"][number]["lessons"][number];
