"use client";

import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function AutoCloseDialogForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setIsPending(true);

    try {
      await action(formData);
      closeRef.current?.click();
    } catch {
      setError("Nao foi possivel salvar. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      aria-busy={isPending}
      className={cn(className)}
      onSubmit={handleSubmit}
    >
      {children}
      {error ? (
        <p className="mt-3 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <DialogClose asChild>
        <button className="sr-only" ref={closeRef} type="button">
          Fechar
        </button>
      </DialogClose>
    </form>
  );
}
