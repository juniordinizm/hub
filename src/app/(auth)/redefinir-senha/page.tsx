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
import { PASSWORD_MIN_LENGTH_MESSAGE } from "@/lib/password-policy";
import { route } from "@/lib/routes";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Definir senha",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await searchParams;

  return (
    <AuthShell>
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardDescription>PROTEA-R Hub</CardDescription>
          <CardTitle as="h1" className="text-3xl">
            Definir nova senha
          </CardTitle>
          <CardDescription>{PASSWORD_MIN_LENGTH_MESSAGE}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token ?? ""} />
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
