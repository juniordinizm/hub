import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminManagementData } from "@/features/admin/server";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const dateLabel = (date: Date): string =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);

export default async function AdminStudentsPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <Badge variant="outline">Alunos</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Alunos e matriculas
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Cada pessoa aparece uma vez. Entre no cadastro para gerenciar as
          matriculas de cada curso.
        </p>
      </header>

      <Card className="border-border/40 bg-background/50 shadow-sm">
        <CardHeader>
          <CardTitle>Alunos cadastrados</CardTitle>
          <CardDescription>
            Visao centralizada por pessoa, mesmo quando ha varios cursos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.students.map((student) => (
            <article
              className="grid gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 md:grid-cols-[1fr_auto]"
              key={student.userId}
            >
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {student.courseCount} curso
                    {student.courseCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline">
                    {student.activeEnrollments} ativa
                    {student.activeEnrollments === 1 ? "" : "s"}
                  </Badge>
                  {student.revokedEnrollments ? (
                    <Badge variant="destructive">
                      {student.revokedEnrollments} revogada
                      {student.revokedEnrollments === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="font-semibold text-lg">{student.name}</h2>
                <p className="text-muted-foreground text-sm">{student.email}</p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Expiracao mais recente: {dateLabel(student.latestExpiration)}
                </p>
              </div>
              <div className="flex items-center">
                <Button asChild variant="outline">
                  <Link href={route(`/admin/alunos/${student.userId}`)}>
                    Ver matriculas
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={16}
                      strokeWidth={2}
                    />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
          {data.students.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum aluno com matricula encontrado.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
