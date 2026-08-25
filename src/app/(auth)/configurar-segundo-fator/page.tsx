import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { TwoFactorSetupForm } from "./two-factor-setup-form";

export const metadata: Metadata = {
  title: "Segurança da conta",
};

export default async function TwoFactorSetupPage(): Promise<React.JSX.Element> {
  await connection();
  const session = await requireSession();

  if (session.role === "student") {
    redirect(route("/app"));
  }

  const isRecovery = session.twoFactorEnabled;

  return (
    <AuthShell>
      <Card className="mx-auto w-full max-w-xl bg-card/95">
        <CardHeader>
          <CardDescription>Proteção da conta privilegiada</CardDescription>
          <CardTitle as="h1" className="text-3xl">
            {isRecovery ? "Recuperar autenticador" : "Configurar segundo fator"}
          </CardTitle>
          <CardDescription>
            {isRecovery
              ? "Confirme sua senha para cadastrar novamente o autenticador e renovar os códigos de recuperação."
              : "Use um aplicativo autenticador e guarde os códigos de recuperação fora do Hub."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetupForm mode={isRecovery ? "recovery" : "setup"} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
