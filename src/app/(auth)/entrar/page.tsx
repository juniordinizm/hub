import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
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
  const session = await getCurrentSession();

  if (session) {
    redirect(route(session.role === "student" ? "/app" : "/admin"));
  }

  return (
    <main className="grid min-h-screen bg-[#0f2224] text-teal-50 lg:grid-cols-[1fr_440px]">
      <section className="relative hidden overflow-hidden bg-[#1a3538] lg:block">
        <Image
          alt="Capa do curso PROTEA-R"
          className="object-cover"
          fill
          priority
          src="/protear/login-capa.png"
        />
      </section>
      <section className="flex min-h-screen items-center px-6 py-10 sm:px-10">
        <Card className="mx-auto w-full max-w-sm bg-card/95">
          <CardHeader>
            <CardDescription>PROTEA-R Hub</CardDescription>
            <CardTitle className="text-3xl">Bem-vinda de volta</CardTitle>
            <CardDescription>
              Acesse sua conta para continuar seus estudos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
