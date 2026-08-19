"use client";

import { BellIcon, BellOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { setCourseSaleInterestAction } from "@/app/(student)/app/actions";
import { Button } from "@/components/ui/button";

export function CourseInterestButton({
  className,
  courseId,
  isInterested,
  variant = "default",
}: {
  className?: string;
  courseId: string;
  isInterested: boolean;
  variant?: "default" | "outline";
}): React.JSX.Element {
  const router = useRouter();
  const [interested, setInterested] = useState(isInterested);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setInterested(isInterested);
  }, [isInterested]);

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            const result = await setCourseSaleInterestAction(formData);
            setInterested(result.interested);
            toast.success(
              result.interested
                ? "Aviso ativado. Você será avisada quando as inscrições abrirem."
                : "Aviso cancelado."
            );
            router.refresh();
          } catch {
            toast.error("Não foi possível atualizar o aviso. Tente novamente.");
          }
        });
      }}
    >
      <input name="courseId" type="hidden" value={courseId} />
      <input
        name="interested"
        type="hidden"
        value={interested ? "false" : "true"}
      />
      <Button
        className="w-full"
        disabled={isPending}
        size="sm"
        type="submit"
        variant={variant}
      >
        <HugeiconsIcon icon={interested ? BellOffIcon : BellIcon} size={16} />
        {interested ? "Cancelar aviso" : "Quero ser avisada"}
      </Button>
    </form>
  );
}
