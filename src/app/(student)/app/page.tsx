import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
    <div className="min-h-screen bg-background px-5 py-6 text-foreground sm:px-8 lg:px-10">
      <header className="mx-auto max-w-6xl">
        <Badge variant="outline">Seus cursos</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Continue de onde parou
        </h1>
      </header>
      <section className="mx-auto mt-8 grid max-w-6xl gap-5">
        {courses.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum curso ativo</CardTitle>
              <CardDescription>
                Sua conta existe, mas nao ha uma matricula ativa no momento.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          courses.map((course) => (
            <Card key={course.courseId}>
              <CardHeader>
                <CardDescription>
                  Acesso ate {formatDate(course.expiresAt)}
                </CardDescription>
                <CardTitle className="text-2xl">{course.title}</CardTitle>
                <CardDescription>
                  {course.subtitle ?? "Curso liberado na sua area de aluna."}
                </CardDescription>
                <CardAction>
                  <Link
                    className="inline-flex h-10 items-center justify-center rounded-3xl bg-primary px-4 font-medium text-primary-foreground text-sm hover:bg-primary/90"
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
                </CardAction>
              </CardHeader>
              <CardContent>
                <Progress value={course.progressPercent} />
                <p className="mt-2 text-muted-foreground text-xs">
                  {course.completedCount} de {course.totalCount} aulas
                  concluidas - {formatPercent(course.progressPercent)}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>
      <section className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Perguntas frequentes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {faqs.map((faq) => (
              <article className="border-t pt-4" key={faq.id}>
                <p className="font-semibold">{faq.question}</p>
                <p className="mt-2 text-muted-foreground text-sm">
                  {faq.answer}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>
        {supportWhatsappUrl ? (
          <Card>
            <CardHeader>
              <CardTitle>Precisa de ajuda?</CardTitle>
              <CardDescription>
                Fale com o suporte pelo WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                className="inline-flex h-10 items-center justify-center rounded-3xl bg-primary px-4 font-medium text-primary-foreground text-sm hover:bg-primary/90"
                href={supportWhatsappUrl}
                rel="noopener"
                target="_blank"
              >
                Falar com suporte
              </a>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
