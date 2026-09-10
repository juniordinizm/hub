import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSearchPill } from "@/components/admin/admin-search-pill";
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
  getSupportCourse,
  getSupportCourseStudents,
} from "@/features/admin/support-server";
import { route } from "@/lib/routes";
import { SupportCourseStudentsTable } from "./support-course-students-table";

export const dynamic = "force-dynamic";

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

const getStudentResultSummary = ({
  page,
  pageSize,
  search,
  studentCount,
  totalCount,
}: {
  page: number;
  pageSize: number;
  search: string;
  studentCount: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return search ? "Nenhum Aluno corresponde à busca" : "Nenhuma matrícula";
  }
  if (studentCount === 0) {
    return `Nenhum Aluno nesta página · ${totalCount} no total`;
  }
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + studentCount - 1, totalCount);
  return `${firstResult}–${lastResult} de ${totalCount} aluno${totalCount === 1 ? "" : "s"}`;
};

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
  const [course, studentsPage] = await Promise.all([
    getSupportCourse(courseId),
    getSupportCourseStudents(courseId, { page, search }),
  ]);

  if (!course) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <Button asChild variant="outline">
              <Link href={route("/admin")}>Voltar ao painel</Link>
            </Button>
          }
          description="Consulte matrículas e abra o contexto operacional de cado aluno. Conteúdo e configurações do curso não estão disponíveis."
          title={course.title}
        />

        <Card>
          <CardHeader>
            <CardTitle as="h2">Alunos matriculadas</CardTitle>
            <CardDescription>
              {course.activeEnrollmentCount} ativas de{" "}
              {course.totalEnrollmentCount} matrículas neste Curso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <form
                action={`/admin/operacao/cursos/${courseId}/alunas`}
                className="flex min-w-0 flex-1 basis-full gap-2 sm:max-w-xl sm:basis-auto"
                method="get"
              >
                <label className="sr-only" htmlFor="support-student-search">
                  Buscar alunos
                </label>
                <input name="page" type="hidden" value="1" />
                <Input
                  aria-label="Buscar alunos"
                  autoComplete="off"
                  className="min-w-0 flex-1"
                  defaultValue={studentsPage.search}
                  id="support-student-search"
                  name="q"
                  placeholder="Buscar por nome ou e-mail…"
                />
                <Button type="submit">Buscar</Button>
              </form>
              {studentsPage.search ? (
                <AdminSearchPill href="?page=1" value={studentsPage.search} />
              ) : null}
            </div>
            <SupportCourseStudentsTable
              courseId={courseId}
              students={studentsPage.students}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <span aria-live="polite" className="text-muted-foreground text-sm">
            {getStudentResultSummary({
              page: studentsPage.page,
              pageSize: studentsPage.pageSize,
              search: studentsPage.search,
              studentCount: studentsPage.students.length,
              totalCount: studentsPage.totalCount,
            })}
          </span>
          {studentsPage.page > 1 || studentsPage.hasNextPage ? (
            <nav aria-label="Paginação de alunos" className="flex gap-2">
              {studentsPage.page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={`?${new URLSearchParams({
                      ...(studentsPage.search
                        ? { q: studentsPage.search }
                        : {}),
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
                      ...(studentsPage.search
                        ? { q: studentsPage.search }
                        : {}),
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
      </div>
    </PageContainer>
  );
}
