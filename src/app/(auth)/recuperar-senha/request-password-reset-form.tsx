"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RequestPasswordResetForm(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/request-password-reset", {
      body: JSON.stringify({
        email: formData.get("email"),
        redirectTo: `${window.location.origin}/redefinir-senha`,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    setIsPending(false);
    setMessage(
      response.ok
        ? "Se o e-mail estiver cadastrado, o link sera enviado em instantes."
        : "Nao foi possivel solicitar a redefinicao agora."
    );
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="font-semibold text-[0.7rem] text-teal-100/70 uppercase tracking-[0.14em]"
          htmlFor="email"
        >
          E-mail
        </label>
        <input
          autoComplete="email"
          className="h-12 w-full rounded-md border border-teal-200/10 bg-[#162b2d] px-4 text-teal-50 outline-none transition focus:border-teal-300/50 focus:ring-4 focus:ring-teal-400/10"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      {message ? <p className="text-orange-200 text-sm">{message}</p> : null}
      <Button
        className="h-12 w-full rounded-md bg-[#326c71] font-bold hover:bg-[#28595d]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
