import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { route } from "@/lib/routes";
import { RequestPasswordResetForm } from "./request-password-reset-form";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

export default function RequestPasswordResetPage(): React.JSX.Element {
  return (
    <AuthShell>
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardDescription>PROTEA-R Hub</CardDescription>
          <CardTitle as="h1" className="text-3xl">
            Recuperar senha
          </CardTitle>
          <CardDescription>
            Enviaremos um link seguro para o seu e-mail cadastrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestPasswordResetForm />
        </CardContent>
        <CardFooter>
          <Link
            className="inline-flex text-muted-foreground text-sm hover:text-foreground"
            href={route("/entrar")}
          >
            Voltar para login
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
