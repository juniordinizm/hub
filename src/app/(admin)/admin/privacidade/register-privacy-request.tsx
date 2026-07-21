"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { registerPrivacyRequestAction } from "@/features/privacy/actions";

export function RegisterPrivacyRequest({
  students,
}: {
  students: Array<{ email: string; id: string; name: string }>;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await registerPrivacyRequestAction(formData);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar a solicitação."
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <form action={submit} className="grid gap-3 rounded-lg border p-4">
      <h2 className="font-semibold">Registrar solicitação</h2>
      <label className="grid gap-1 text-sm">
        Aluna
        <select
          className="rounded border bg-background p-2"
          name="userId"
          required
        >
          <option value="">Selecione</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} ({student.email})
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Motivo e escopo solicitado
        <textarea
          className="min-h-20 rounded border bg-background p-2"
          name="reason"
          required
        />
      </label>
      <Button disabled={pending} type="submit" variant="outline">
        {pending ? "Registrando..." : "Registrar solicitação"}
      </Button>
      {error ? (
        <p aria-live="polite" className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
