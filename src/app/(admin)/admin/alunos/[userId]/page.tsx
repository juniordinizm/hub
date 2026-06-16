import { ArrowLeft01Icon, FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DatePickerField } from "@/components/date-picker-field";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEnrollmentAction } from "@/features/admin/actions";
import { getAdminStudentDetail } from "@/features/admin/server";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

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
    <div className="space-y-8">
      <header className="border-b pb-6">
        <Button asChild className="mb-5" size="sm" variant="ghost">
          <Link href={route("/admin/alunos")}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            Voltar para alunos
          </Link>
        </Button>
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
            Atualize status e expiracao sem duplicar o cadastro do aluno.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {student.enrollments.map((enrollment) => (
            <form
              action={updateEnrollmentAction}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_140px_150px_auto]"
              key={enrollment.id}
            >
              <input name="enrollmentId" type="hidden" value={enrollment.id} />
              <input name="userId" type="hidden" value={student.userId} />
              <div>
                <p className="font-semibold">{enrollment.courseTitle}</p>
                <p className="text-muted-foreground text-xs">
                  Inicio: {dateInputValue(enrollment.startedAt)}
                </p>
              </div>
              <Select defaultValue={enrollment.status} name="status">
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                  <SelectItem value="revoked">Revogada</SelectItem>
                </SelectContent>
              </Select>
              <DatePickerField
                defaultValue={dateInputValue(enrollment.expiresAt)}
                name="expiresAt"
              />
              <Button type="submit">
                <HugeiconsIcon
                  icon={FloppyDiskIcon}
                  size={18}
                  strokeWidth={2}
                />
                Atualizar
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
