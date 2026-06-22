import {
  Time02Icon,
  UserBlock01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { summarizeAdminStudentAccess } from "@/features/admin/presentation";
import { getAdminManagementData } from "@/features/admin/server";
import { AdminMetricCard } from "../admin-metric-card";
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
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Alunos e matrículas
              </h1>
              <p className="text-muted-foreground text-sm">
                Lista centralizada por aluno, com consulta rápida e gestão das
                matrículas por curso.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            helper="Todos os perfis com papel de aluno."
            icon={UserGroupIcon}
            label="Alunos cadastrados"
            value={studentAccessSummary.totalStudents.toString()}
          />
          <AdminMetricCard
            helper="Com pelo menos uma matrícula ativa."
            icon={UserCircleIcon}
            label="Com acesso ativo"
            value={studentAccessSummary.activeStudents.toString()}
          />
          <AdminMetricCard
            helper="Sem curso liberado no momento."
            icon={UserBlock01Icon}
            label="Sem matrícula"
            value={studentAccessSummary.notEnrolledStudents.toString()}
          />
          <AdminMetricCard
            helper="Acessos ativos que vencem em até 30 dias."
            icon={Time02Icon}
            label="Expirando em breve"
            value={studentAccessSummary.expiringSoonStudents.toString()}
          />
        </section>

        <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Alunos cadastrados</CardTitle>
            <CardDescription className="mt-1">
              Nome, email, status geral de matrícula, cursos, primeira matrícula
              e último acesso.
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
