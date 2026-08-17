"use client";

import { useRef, useTransition } from "react";
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
    const toastId = toast.loading(copy.pending);

    startTransition(async () => {
      try {
        const result = await submit();
        if (!result.ok) {
          toast.error(result.message, { id: toastId });
          return;
        }

        toast.success(copy.success, { id: toastId });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação. Tente novamente.",
          { id: toastId }
        );
      } finally {
        submissionInFlight.current = false;
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Button disabled={isPending} size="sm" type="submit">
        {isPending ? copy.pending : copy.idle}
      </Button>
    </form>
  );
}
