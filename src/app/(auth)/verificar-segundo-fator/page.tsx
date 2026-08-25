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
import { getCurrentSession } from "@/lib/session";
import { TwoFactorChallengeForm } from "./two-factor-challenge-form";

export const metadata: Metadata = {
  title: "Verificar segundo fator",
};

export default async function TwoFactorChallengePage(): Promise<React.JSX.Element> {
  await connection();
  const session = await getCurrentSession();

  if (session) {
    if (session.role !== "student" && !session.twoFactorEnabled) {
      redirect(route("/configurar-segundo-fator"));
    }
    redirect(route(session.role === "student" ? "/app" : "/admin"));
  }

  return (
    <AuthShell>
      <Card className="mx-auto w-full max-w-sm bg-card/95">
        <CardHeader>
          <CardDescription>Proteção da conta</CardDescription>
          <CardTitle as="h1" className="text-3xl">
            Confirmar segundo fator
          </CardTitle>
          <CardDescription>
            Use o código atual do autenticador ou um código de recuperação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorChallengeForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
