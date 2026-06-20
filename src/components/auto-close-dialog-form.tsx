"use client";

import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDiscardDialog } from "./discard-aware-dialog";

const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof (error as { digest?: unknown }).digest === "string" &&
  ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false);

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
  const discardDialog = useDiscardDialog();

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setIsPending(true);

    const toastId = toast.loading("Salvando...");

    try {
      await action(formData);
      discardDialog?.setDirty(false);
      toast.success("Salvo com sucesso!", { id: toastId });
      closeRef.current?.click();
    } catch (err) {
      if (isRedirectError(err)) {
        toast.dismiss(toastId);
        throw err;
      }
      toast.error("Não foi possível salvar.", { id: toastId });
      setError("Não foi possível salvar. Tente novamente.");
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
      <fieldset
        className="m-0 w-full min-w-0 border-0 p-0"
        disabled={isPending}
      >
        {children}
      </fieldset>
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
