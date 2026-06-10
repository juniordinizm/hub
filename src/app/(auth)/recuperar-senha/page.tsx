import type { Metadata } from "next";
import Link from "next/link";
import { route } from "@/lib/routes";
import { RequestPasswordResetForm } from "./request-password-reset-form";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

export default function RequestPasswordResetPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center bg-[#0f2224] px-6 py-10 text-teal-50">
      <div className="mx-auto w-full max-w-sm">
        <p className="font-semibold text-[#d97b34] text-xs uppercase tracking-[0.18em]">
          PROTEA-R Hub
        </p>
        <h1 className="mt-4 font-bold text-3xl tracking-tight">
          Recuperar senha
        </h1>
        <p className="mt-2 text-sm text-teal-100/60">
          Enviaremos um link seguro para o seu e-mail cadastrado.
        </p>
        <div className="mt-10">
          <RequestPasswordResetForm />
        </div>
        <Link
          className="mt-6 inline-flex text-sm text-teal-100/60 hover:text-teal-50"
          href={route("/entrar")}
        >
          Voltar para login
        </Link>
      </div>
    </main>
  );
}
