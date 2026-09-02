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
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function SignInPage(): Promise<React.JSX.Element> {
  await connection();
  const session = await getCurrentSession();

  if (session && !(session.role === "student" && session.platformBlockedAt)) {
    redirect(route(session.role === "student" ? "/app" : "/admin"));
  }

  return (
    <AuthShell>
      <Card className="mx-auto w-full max-w-sm bg-card/95">
        <CardHeader>
          <CardDescription>PROTEA-R Hub</CardDescription>
          <CardTitle as="h1" className="text-3xl">
            Bem-vinda de volta
          </CardTitle>
          <CardDescription>
            Acesse sua conta para continuar seus estudos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
