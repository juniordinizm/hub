"use client";

import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDiscardDialog } from "./discard-aware-dialog";

interface SubmitterValue {
  disabled?: boolean;
  name?: string;
  value?: string;
}

const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof (error as { digest?: unknown }).digest === "string" &&
  ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Nao foi possivel salvar. Tente novamente.";

const getSubmitter = (event: Event): SubmitterValue | null => {
  if (!("submitter" in event)) {
    return null;
  }

  return (event as SubmitEvent).submitter as SubmitterValue | null;
};

export const appendSubmitterValue = (
  formData: FormData,
  submitter: SubmitterValue | null
): void => {
  if (!(submitter?.name && !submitter.disabled)) {
    return;
  }

  formData.append(submitter.name, submitter.value ?? "");
};

export interface AdminMutationFormProps {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  closeOnSuccess?: boolean;
  id?: string;
  onSuccess?: (() => void | Promise<void>) | undefined;
}

export function AdminMutationForm({
  action,
  children,
  className,
  closeOnSuccess = false,
  id,
  onSuccess,
}: AdminMutationFormProps): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const discardDialog = useDiscardDialog();

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    appendSubmitterValue(formData, getSubmitter(event.nativeEvent));
    setError(null);
    setIsPending(true);

    const toastId = toast.loading("Salvando...");

    try {
      await action(formData);
      await onSuccess?.();
      discardDialog?.setDirty(false);
      toast.success("Salvo com sucesso!", { id: toastId });
      if (closeOnSuccess) {
        closeRef.current?.click();
      }
    } catch (err) {
      if (isRedirectError(err)) {
        toast.dismiss(toastId);
        throw err;
      }
      const message = getErrorMessage(err);
      toast.error(message, { id: toastId });
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      aria-busy={isPending}
      className={cn(className)}
      id={id}
      onSubmit={handleSubmit}
    >
      <fieldset className="contents" disabled={isPending}>
        {error ? (
          <div
            className="border-destructive/20 border-b bg-destructive/10 px-6 py-3 text-destructive text-sm"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {children}
      </fieldset>
      {closeOnSuccess ? (
        <DialogClose asChild>
          <button className="sr-only" ref={closeRef} type="button">
            Fechar
          </button>
        </DialogClose>
      ) : null}
    </form>
  );
}
