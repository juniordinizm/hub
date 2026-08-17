"use client";

import { Edit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COURSE_WORKLOAD_MAX,
  parseCourseWorkloadOverride,
} from "@/features/courses/workload";

export interface CourseWorkloadDialogProps {
  calculatedHours: number;
  compact?: boolean;
  onValueChange: (value: number | null) => void;
  triggerId?: string;
  value: number | null;
}

type WorkloadMode = "automatic" | "manual";

export function CourseWorkloadDialog({
  calculatedHours,
  compact = false,
  onValueChange,
  triggerId,
  value,
}: CourseWorkloadDialogProps): React.JSX.Element {
  const [draftValue, setDraftValue] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<WorkloadMode>(
    value === null ? "automatic" : "manual"
  );
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);

    if (nextOpen) {
      setMode(value === null ? "automatic" : "manual");
      setDraftValue(value?.toString() ?? "");
      setError("");
    }
  };

  const handleModeChange = (nextMode: string): void => {
    if (nextMode !== "automatic" && nextMode !== "manual") {
      return;
    }

    setMode(nextMode);
    setError("");
    if (nextMode === "manual" && draftValue.trim() === "") {
      setDraftValue(calculatedHours.toString());
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    try {
      const nextValue =
        mode === "automatic" ? null : parseCourseWorkloadOverride(draftValue);
      if (mode === "manual" && nextValue === null) {
        throw new Error("Informe uma carga horária manual.");
      }
      onValueChange(nextValue);
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Informe uma carga horária válida."
      );
    }
  };
  const displayedHours = value ?? calculatedHours;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTriggerButton
        aria-label="Editar carga horária"
        className={
          compact
            ? "w-full justify-between border-transparent bg-input/50 font-normal hover:bg-muted"
            : undefined
        }
        id={triggerId}
        size={compact ? "default" : "sm"}
        type="button"
        variant="outline"
      >
        {compact ? (
          <>
            <span className="tabular-nums">
              {displayedHours} {displayedHours === 1 ? "hora" : "horas"}
            </span>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Edit01Icon}
              size={16}
              strokeWidth={2}
            />
          </>
        ) : (
          <>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Edit01Icon}
              size={16}
              strokeWidth={2}
            />
            Editar carga horária
          </>
        )}
      </DialogTriggerButton>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Carga horária</DialogTitle>
          <DialogDescription>
            Escolha como a carga horária será exibida para os alunos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 p-6">
            <Field>
              <FieldLabel htmlFor="course-workload-mode">
                Origem da carga horária
              </FieldLabel>
              <Select onValueChange={handleModeChange} value={mode}>
                <SelectTrigger id="course-workload-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automático</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Automático: {calculatedHours}{" "}
                {calculatedHours === 1 ? "hora" : "horas"} pela soma das aulas.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="course-settings-workload-dialog">
                Horas manuais
              </FieldLabel>
              <Input
                autoFocus={mode === "manual"}
                disabled={mode !== "manual"}
                id="course-settings-workload-dialog"
                inputMode="numeric"
                max={COURSE_WORKLOAD_MAX}
                min={0}
                name="workloadHoursOverrideDialog"
                onChange={(event) => {
                  setDraftValue(event.currentTarget.value);
                  setError("");
                }}
                type="number"
                value={draftValue}
              />
              <FieldDescription>
                Disponível quando a origem manual estiver selecionada.
              </FieldDescription>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit">Aplicar carga horária</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
