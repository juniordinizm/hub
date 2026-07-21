import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listPrivacyRequestStudents,
  listPrivacyRequests,
} from "@/features/privacy/server";
import { getServerEnv } from "@/lib/env";
import { formatDate } from "@/lib/formatters";
import { requireRole } from "@/lib/session";
import { PrivacyRequestOperations } from "./privacy-request-operations";
import { RegisterPrivacyRequest } from "./register-privacy-request";

export const dynamic = "force-dynamic";

export default async function PrivacyPage(): Promise<React.JSX.Element> {
  const [session, requests, students] = await Promise.all([
    requireRole(["admin", "support"]),
    listPrivacyRequests(),
    listPrivacyRequestStudents(),
  ]);
  const env = getServerEnv();
  const anonymizationEnabled =
    env.DATA_RETENTION_ENABLED && Boolean(env.LEGAL_APPROVAL_REFERENCE);

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <Badge variant="outline">Privacidade</Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            Solicitações de dados
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Registre, revise e acompanhe solicitações. A anonimização exige
            aprovação jurídica formal e três pessoas distintas.
          </p>
        </header>
        <RegisterPrivacyRequest students={students} />
        <Card>
          <CardHeader>
            <CardTitle>Inbox operacional</CardTitle>
            <CardDescription>
              {anonymizationEnabled
                ? "A execução continua restrita a outra administradora."
                : "Anonimização bloqueada: falta flag de retenção e/ou referência jurídica formal."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {requests.length ? (
              requests.map((request) => (
                <article className="rounded-lg border p-4" key={request.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{request.studentName}</h2>
                      <p className="text-muted-foreground text-sm">
                        {request.studentEmail}
                      </p>
                    </div>
                    <Badge
                      variant={
                        request.status === "completed" ? "secondary" : "outline"
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm">{request.reason}</p>
                  <p className="mt-2 text-muted-foreground text-xs">
                    Registrada em {formatDate(request.createdAt)}
                  </p>
                  <PrivacyRequestOperations
                    anonymizationEnabled={anonymizationEnabled}
                    canApprove={session.role === "admin"}
                    canExecute={session.role === "admin"}
                    request={request}
                  />
                </article>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhuma solicitação registrada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
