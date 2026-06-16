import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { getAdminManagementData } from "@/features/admin/server";

export const dynamic = "force-dynamic";

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

export default async function AdminStudentsPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">Alunas</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Alunas e matriculas
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          As alunas entram pelo cadastro e checkout. Use esta tela para
          acompanhar, renovar, expirar ou revogar acessos existentes.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Matriculas existentes</CardTitle>
            <CardDescription>
              Atualize status e expiracao sem alterar o historico da aluna.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.enrollments.map((enrollment) => (
              <form
                action={updateEnrollmentAction}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_140px_150px_auto]"
                key={enrollment.id}
              >
                <input
                  name="enrollmentId"
                  type="hidden"
                  value={enrollment.id}
                />
                <div>
                  <p className="font-semibold">{enrollment.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {enrollment.email} - {enrollment.courseTitle}
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
      </section>
    </div>
  );
}
