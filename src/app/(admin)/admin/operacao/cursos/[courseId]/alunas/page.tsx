import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getSupportCourseOperations,
  getSupportCourseStudents,
} from "@/features/admin/support-server";
import { route } from "@/lib/routes";
import { SupportCourseStudentsTable } from "./support-course-students-table";

export const dynamic = "force-dynamic";

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function SupportCourseStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { courseId } = await params;
  const query = (await searchParams) ?? {};
  const requestedPage = Number.parseInt(
    firstSearchParam(query.page) ?? "1",
    10
  );
  const page = Number.isFinite(requestedPage) ? requestedPage : 1;
  const search = firstSearchParam(query.q)?.trim() ?? "";
  const [courses, studentsPage] = await Promise.all([
    getSupportCourseOperations(),
    getSupportCourseStudents(courseId, { page, search }),
  ]);
  const course = courses.find((candidate) => candidate.id === courseId);

  if (!course) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <Button asChild variant="outline">
              <Link href={route("/admin/operacao/cursos")}>
                Voltar aos cursos
              </Link>
            </Button>
          }
          description="Consulte matrículas e abra o contexto operacional de cada aluna. Conteúdo e configurações do curso não estão disponíveis."
          title={course.title}
        />

        <Card>
          <CardHeader>
            <CardTitle as="h2">Alunas matriculadas</CardTitle>
            <CardDescription>
              {course.activeEnrollmentCount} ativas de{" "}
              {course.totalEnrollmentCount} matrículas neste Curso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={`/admin/operacao/cursos/${courseId}/alunas`}
              className="mb-5 flex max-w-xl gap-2"
              method="get"
            >
              <label className="sr-only" htmlFor="support-student-search">
                Buscar alunas
              </label>
              <Input
                aria-label="Buscar alunas"
                className="min-w-0 flex-1"
                defaultValue={studentsPage.search}
                id="support-student-search"
                name="q"
                placeholder="Buscar por nome ou e-mail…"
              />
              <Button type="submit">Buscar</Button>
            </form>
            <SupportCourseStudentsTable
              courseId={courseId}
              students={studentsPage.students}
            />
          </CardContent>
        </Card>

        {studentsPage.page > 1 || studentsPage.hasNextPage ? (
          <nav
            aria-label="Paginação de alunas"
            className="flex justify-end gap-2"
          >
            {studentsPage.page > 1 ? (
              <Button asChild variant="outline">
                <Link
                  href={`?${new URLSearchParams({
                    ...(studentsPage.search ? { q: studentsPage.search } : {}),
                    page: String(studentsPage.page - 1),
                  })}`}
                >
                  Anterior
                </Link>
              </Button>
            ) : null}
            {studentsPage.hasNextPage ? (
              <Button asChild variant="outline">
                <Link
                  href={`?${new URLSearchParams({
                    ...(studentsPage.search ? { q: studentsPage.search } : {}),
                    page: String(studentsPage.page + 1),
                  })}`}
                >
                  Próxima
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
