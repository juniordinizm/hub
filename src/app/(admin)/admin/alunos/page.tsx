import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { summarizeAdminStudentAccess } from "@/features/admin/presentation";
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
  const studentAccessSummary = summarizeAdminStudentAccess(data.students);

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
    firstEnrollmentAt: student.firstEnrollmentAt?.toISOString() ?? null,
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StudentMetricCard
            helper="Todos os perfis com papel de aluno."
            label="Alunos cadastrados"
            value={studentAccessSummary.totalStudents.toString()}
          />
          <StudentMetricCard
            helper="Com pelo menos uma matricula ativa."
            label="Com acesso ativo"
            value={studentAccessSummary.activeStudents.toString()}
          />
          <StudentMetricCard
            helper="Sem curso liberado no momento."
            label="Sem matricula"
            value={studentAccessSummary.notEnrolledStudents.toString()}
          />
          <StudentMetricCard
            helper="Acessos ativos que vencem em ate 30 dias."
            label="Expirando em breve"
            value={studentAccessSummary.expiringSoonStudents.toString()}
          />
        </section>

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

function StudentMetricCard({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <Card className="border-border/40 bg-background/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-bold text-3xl tracking-tight">{value}</p>
        <p className="mt-2 text-muted-foreground text-xs">{helper}</p>
      </CardContent>
    </Card>
  );
}
