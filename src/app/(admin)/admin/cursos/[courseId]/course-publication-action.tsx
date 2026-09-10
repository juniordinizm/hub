"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CoursePublicationActionResult } from "@/features/admin/actions";
import {
  createCoursePublicationDraftAction,
  publishCoursePublicationAction,
} from "@/features/admin/actions";

type CoursePublicationActionType = "prepare" | "publish";

const ACTION_COPY = {
  prepare: {
    idle: "Preparar alterações",
    pending: "Preparando…",
    success: "Alterações preparadas.",
  },
  publish: {
    idle: "Publicar alterações",
    pending: "Publicando…",
    success: "Alterações publicadas.",
  },
} as const;

interface CoursePublicationActionProps {
  action: CoursePublicationActionType;
  courseId: string;
}

export function CoursePublicationAction({
  action,
  courseId,
}: CoursePublicationActionProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submissionInFlight = useRef(false);
  const copy = ACTION_COPY[action];

  const submit = (): Promise<CoursePublicationActionResult> =>
    action === "prepare"
      ? createCoursePublicationDraftAction(courseId)
      : publishCoursePublicationAction(courseId);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (submissionInFlight.current) {
      return;
    }

    submissionInFlight.current = true;
    setErrorMessage(null);
    const toastId = toast.loading(copy.pending);

    startTransition(async () => {
      try {
        const result = await submit();
        if (!result.ok) {
          setErrorMessage(result.message);
          toast.error(result.message, { id: toastId });
          return;
        }

        toast.success(copy.success, { id: toastId });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação. Tente novamente.";
        setErrorMessage(message);
        toast.error(message, { id: toastId });
      } finally {
        submissionInFlight.current = false;
      }
    });
  };

  return (
    <form className="flex flex-col items-start gap-2" onSubmit={handleSubmit}>
      <Button loading={isPending} size="sm" type="submit">
        {copy.idle}
      </Button>
      {errorMessage ? (
        <p
          aria-live="assertive"
          className="text-destructive text-xs"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
