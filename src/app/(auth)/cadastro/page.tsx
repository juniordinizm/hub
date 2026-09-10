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
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function SignUpPage(): Promise<React.JSX.Element> {
  await connection();
  const session = await getCurrentSession();

  if (session && !(session.role === "student" && session.platformBlockedAt)) {
    redirect(route(session.role === "student" ? "/app" : "/admin"));
  }

  return (
    <AuthShell>
      <Card className="mx-auto w-full max-w-sm bg-card/95">
        <CardHeader>
          <CardTitle as="h1" className="type-page-title">
            Crie sua conta
          </CardTitle>
          <CardDescription>
            A conta dá acesso à plataforma. Os cursos são liberados
            separadamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
