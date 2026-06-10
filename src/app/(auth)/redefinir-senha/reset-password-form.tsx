"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm({
  token,
}: Readonly<{ token: string }>): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if (password !== confirmation) {
      setIsPending(false);
      setMessage("As senhas precisam ser iguais.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      body: JSON.stringify({ newPassword: password, token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    setIsPending(false);
    setMessage(
      response.ok
        ? "Senha definida. Voce ja pode entrar."
        : "Link invalido ou expirado."
    );
  };

  if (!token) {
    return (
      <p className="rounded-md border border-orange-200/20 bg-orange-500/10 p-4 text-orange-100 text-sm">
        Link invalido ou expirado. Solicite uma nova recuperacao de senha.
      </p>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="font-semibold text-[0.7rem] text-teal-100/70 uppercase tracking-[0.14em]"
          htmlFor="password"
        >
          Nova senha
        </label>
        <input
          autoComplete="new-password"
          className="h-12 w-full rounded-md border border-teal-200/10 bg-[#162b2d] px-4 text-teal-50 outline-none transition focus:border-teal-300/50 focus:ring-4 focus:ring-teal-400/10"
          id="password"
          minLength={10}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="space-y-2">
        <label
          className="font-semibold text-[0.7rem] text-teal-100/70 uppercase tracking-[0.14em]"
          htmlFor="confirmation"
        >
          Confirmar senha
        </label>
        <input
          autoComplete="new-password"
          className="h-12 w-full rounded-md border border-teal-200/10 bg-[#162b2d] px-4 text-teal-50 outline-none transition focus:border-teal-300/50 focus:ring-4 focus:ring-teal-400/10"
          id="confirmation"
          minLength={10}
          name="confirmation"
          required
          type="password"
        />
      </div>
      {message ? <p className="text-orange-200 text-sm">{message}</p> : null}
      <Button
        className="h-12 w-full rounded-md bg-[#326c71] font-bold hover:bg-[#28595d]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Salvando..." : "Salvar senha"}
      </Button>
    </form>
  );
}
