import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  extendEnrollmentExpirationAction,
  setEnrollmentExpirationAction,
} from "@/features/admin/actions";
import { getAdminStudentDetail } from "@/features/admin/server";

export const dynamic = "force-dynamic";

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<React.JSX.Element> {
  const { userId } = await params;
  const student = await getAdminStudentDetail(userId);

  if (!student) {
    notFound();
  }

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <Badge variant="outline">Aluno</Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            {student.name}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">{student.email}</p>
        </header>

        <Card className="border-border/40 bg-background/50 shadow-sm">
          <CardHeader>
            <CardTitle>Matriculas por curso</CardTitle>
            <CardDescription>
              Ajuste apenas a expiracao de acessos originados por pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {student.enrollments.map((enrollment) => (
              <div
                className="grid gap-3 rounded-lg border p-4"
                key={enrollment.id}
              >
                <div>
                  <p className="font-semibold">{enrollment.courseTitle}</p>
                  <p className="text-muted-foreground text-xs">
                    Inicio: {formatDate(enrollment.startedAt)} | Expira:{" "}
                    {formatDate(enrollment.expiresAt)} | {enrollment.status}
                  </p>
                </div>
                <form
                  action={extendEnrollmentExpirationAction}
                  className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input name="userId" type="hidden" value={student.userId} />
                  <input
                    aria-label="Motivo da extensao"
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    name="reason"
                    placeholder="Motivo obrigatorio"
                    required
                  />
                  <Button name="days" type="submit" value="1">
                    +1 dia
                  </Button>
                  <Button name="days" type="submit" value="7">
                    +7 dias
                  </Button>
                  <Button name="months" type="submit" value="1">
                    +1 mes
                  </Button>
                </form>
                <form
                  action={setEnrollmentExpirationAction}
                  className="grid gap-2 md:grid-cols-[1fr_180px_auto]"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input name="userId" type="hidden" value={student.userId} />
                  <input
                    aria-label="Motivo da data exata"
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    name="reason"
                    placeholder="Motivo obrigatorio"
                    required
                  />
                  <input
                    aria-label="Nova expiracao com horario local"
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    name="newExpiresAt"
                    required
                    type="datetime-local"
                  />
                  <Button type="submit">Definir data</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
