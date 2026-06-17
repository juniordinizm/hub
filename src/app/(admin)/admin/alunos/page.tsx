import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminManagementData } from "@/features/admin/server";
import {
  type StudentEnrollmentRow,
  StudentsTable,
  type StudentTableRow,
} from "./students-table";

export const dynamic = "force-dynamic";

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

export default async function AdminStudentsPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();
  const enrollmentsByUserId = new Map<string, StudentEnrollmentRow[]>();

  for (const enrollment of data.enrollments) {
    const current = enrollmentsByUserId.get(enrollment.userId) ?? [];
    current.push({
      courseTitle: enrollment.courseTitle,
      expiresAt: dateInputValue(enrollment.expiresAt),
      id: enrollment.id,
      startedAt: dateInputValue(enrollment.startsAt),
      status: enrollment.status,
      userId: enrollment.userId,
    });
    enrollmentsByUserId.set(enrollment.userId, current);
  }

  const students: StudentTableRow[] = data.students.map((student) => ({
    courseCount: student.courseCount,
    email: student.email,
    enrollments: enrollmentsByUserId.get(student.userId) ?? [],
    firstEnrollmentAt: student.firstEnrollmentAt.toISOString(),
    lastAccessAt: student.lastAccessAt?.toISOString() ?? null,
    name: student.name,
    userId: student.userId,
  }));

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="space-y-8">
        <header className="border-b pb-6">
          <Badge variant="outline">Alunos</Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            Alunos e matriculas
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Lista centralizada por aluno, com consulta rapida e gestao das
            matriculas por curso no dialog.
          </p>
        </header>

        <Card className="border-border/40 bg-background/50 shadow-sm">
          <CardHeader>
            <CardTitle>Alunos cadastrados</CardTitle>
            <CardDescription>
              Nome, email, status geral de matricula, cursos, primeira matricula
              e ultimo acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentsTable students={students} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
