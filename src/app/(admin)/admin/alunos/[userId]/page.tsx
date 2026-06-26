import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EnrollmentExpirationControls } from "@/features/admin/enrollment-expiration-controls";
import { getAdminStudentDetail } from "@/features/admin/server";

export const dynamic = "force-dynamic";

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
              <EnrollmentExpirationControls
                enrollment={{
                  ...enrollment,
                  userId: student.userId,
                }}
                key={enrollment.id}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
