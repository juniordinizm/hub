import type { Metadata } from "next";
import Image from "next/image";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function SignInPage(): React.JSX.Element {
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
        <div className="mx-auto w-full max-w-sm">
          <p className="font-semibold text-[#d97b34] text-xs uppercase tracking-[0.18em]">
            PROTEA-R Hub
          </p>
          <h1 className="mt-4 font-bold text-3xl tracking-tight">
            Bem-vinda de volta
          </h1>
          <p className="mt-2 text-sm text-teal-100/60">
            Acesse sua conta para continuar seus estudos.
          </p>
          <div className="mt-10">
            <SignInForm />
          </div>
        </div>
      </section>
    </main>
  );
}
