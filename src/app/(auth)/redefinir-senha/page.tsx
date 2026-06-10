import type { Metadata } from "next";
import Link from "next/link";
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
    <main className="flex min-h-screen items-center bg-[#0f2224] px-6 py-10 text-teal-50">
      <div className="mx-auto w-full max-w-sm">
        <p className="font-semibold text-[#d97b34] text-xs uppercase tracking-[0.18em]">
          PROTEA-R Hub
        </p>
        <h1 className="mt-4 font-bold text-3xl tracking-tight">
          Definir nova senha
        </h1>
        <p className="mt-2 text-sm text-teal-100/60">
          Crie uma senha com pelo menos 10 caracteres.
        </p>
        <div className="mt-10">
          <ResetPasswordForm token={token ?? ""} />
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
