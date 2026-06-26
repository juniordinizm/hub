import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminStudentDetail } from "@/features/admin/server";
import {
  StudentCoursesSummary,
  StudentPlatformAccessControls,
} from "../students-table";

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
            <CardTitle>Aluno na plataforma</CardTitle>
            <CardDescription>
              Gerencie o acesso geral do aluno e consulte os cursos vinculados.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <StudentPlatformAccessControls
              student={{
                email: student.email,
                name: student.name,
                platformBlockedAt:
                  student.platformBlockedAt?.toISOString() ?? null,
                platformBlockedReason: student.platformBlockedReason,
                userId: student.userId,
              }}
            />
            <StudentCoursesSummary
              enrollments={student.enrollments.map((enrollment) => ({
                ...enrollment,
                expiresAt: enrollment.expiresAt.toISOString(),
                originalExpiresAt: enrollment.originalExpiresAt.toISOString(),
                startedAt: enrollment.startedAt.toISOString(),
                userId: student.userId,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
