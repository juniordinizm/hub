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
  courseVersionStatus: "draft" | "published" | "retired";
  formId: string;
  initialStatus: string;
}

export function LessonSidebarActions({
  courseVersionStatus,
  formId,
  initialStatus,
}: LessonSidebarActionsProps): React.JSX.Element {
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

    const toastId = toast.loading("Salvando aula...");

    startTransition(async () => {
      try {
        await saveLessonAction(formData);
        toast.success("Aula salva com sucesso!", { id: toastId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao salvar a aula",
          { id: toastId }
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Oculto, mas ainda envia o status no form data nativo (caso precise) */}
      <input form={formId} name="status" type="hidden" value={status} />

      <Select
        disabled={courseVersionStatus === "published"}
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
    </div>
  );
}
