"use client";

import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveLessonAction } from "@/features/admin/actions";

interface LessonSidebarActionsProps {
  coursePublicationStatus: "draft" | "published" | "retired";
  formId: string;
  initialStatus: string;
}

export function LessonSidebarActions({
  coursePublicationStatus,
  formId,
  initialStatus,
}: LessonSidebarActionsProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleSave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) {
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    formData.set("status", status);
    setErrorMessage(null);

    const toastId = toast.loading("Salvando aula...");

    startTransition(async () => {
      try {
        const result = await saveLessonAction(formData);
        if (!result.ok) {
          setErrorMessage(result.message);
          toast.error(result.message, { id: toastId });
          return;
        }

        toast.success("Aula salva com sucesso!", { id: toastId });
      } catch {
        const message = "Não foi possível salvar a aula. Tente novamente.";
        setErrorMessage(message);
        toast.error(message, { id: toastId });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Oculto, mas ainda envia o status no form data nativo (caso precise) */}
      <input form={formId} name="status" type="hidden" value={status} />

      <Select
        disabled={coursePublicationStatus === "published"}
        onValueChange={setStatus}
        value={status}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Rascunho</SelectItem>
          <SelectItem value="active">Publicada</SelectItem>
          <SelectItem value="archived">Arquivada</SelectItem>
        </SelectContent>
      </Select>

      <Button
        className="w-full"
        disabled={isPending}
        form={formId}
        onClick={handleSave}
        type="submit"
      >
        <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
        {isPending ? "Salvando..." : "Salvar aula"}
      </Button>
      {errorMessage ? (
        <div
          aria-live="assertive"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
