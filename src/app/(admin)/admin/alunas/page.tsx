import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  inviteStudentAction,
  updateEnrollmentAction,
} from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";

export const dynamic = "force-dynamic";

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

export default async function AdminStudentsPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();
  const firstCourse = data.courses[0];

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">Alunas</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Alunas e matriculas
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Crie acessos, renove expiração e revogue matrícula quando necessário.
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Convidar aluna</CardTitle>
            <CardDescription>
              Cria matrícula ativa e envia as orientações por e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={inviteStudentAction}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Nome</FieldLabel>
                  <Input name="name" required />
                </Field>
                <Field>
                  <FieldLabel>E-mail</FieldLabel>
                  <Input name="email" required type="email" />
                </Field>
                <Field>
                  <FieldLabel>Curso</FieldLabel>
                  <NativeSelect className="w-full" name="courseId" required>
                    {data.courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <input
                  name="courseTitle"
                  type="hidden"
                  value={firstCourse?.title ?? "PROTEA-R Hub"}
                />
                <Field>
                  <FieldLabel>Meses de acesso</FieldLabel>
                  <Input
                    defaultValue={12}
                    min={1}
                    name="months"
                    type="number"
                  />
                </Field>
                <Button type="submit">Criar matricula e enviar convite</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriculas</CardTitle>
            <CardDescription>
              Atualize status e expiração sem alterar histórico da aluna.
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
                <NativeSelect
                  className="w-full"
                  defaultValue={enrollment.status}
                  name="status"
                >
                  <option value="active">Ativa</option>
                  <option value="expired">Expirada</option>
                  <option value="revoked">Revogada</option>
                </NativeSelect>
                <Input
                  defaultValue={dateInputValue(enrollment.expiresAt)}
                  name="expiresAt"
                  type="date"
                />
                <Button type="submit">Atualizar</Button>
              </form>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
