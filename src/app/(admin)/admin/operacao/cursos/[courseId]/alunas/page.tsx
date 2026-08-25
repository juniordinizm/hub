import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [courses, studentsPage] = await Promise.all([
    getSupportCourseOperations(),
    getSupportCourseStudents(courseId, { page }),
  ]);
  const course = courses.find((candidate) => candidate.id === courseId);

  if (!course) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                Operação de suporte
              </p>
              <h1 className="font-bold text-3xl tracking-tight">
                {course.title}
              </h1>
              <p className="text-muted-foreground text-sm">
                Consulte matrículas e abra o contexto operacional de cada aluna.
                Conteúdo e configurações do Curso não estão disponíveis.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={route("/admin/operacao/cursos")}>
                Voltar aos Cursos
              </Link>
            </Button>
          </div>
        </header>

        <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle>Alunas matriculadas</CardTitle>
            <CardDescription>
              {course.activeEnrollmentCount} ativas de{" "}
              {course.totalEnrollmentCount} matrículas neste Curso.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <Link href={`?page=${studentsPage.page - 1}`}>Anterior</Link>
              </Button>
            ) : null}
            {studentsPage.hasNextPage ? (
              <Button asChild variant="outline">
                <Link href={`?page=${studentsPage.page + 1}`}>Próxima</Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
