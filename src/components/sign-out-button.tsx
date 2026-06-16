"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}): React.JSX.Element {
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = async () => {
    setIsPending(true);
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.assign("/entrar");
  };

  return (
    <Button
      className={className}
      disabled={isPending}
      onClick={handleSignOut}
      type="button"
      variant={variant}
    >
      {isPending ? "Saindo..." : "Sair"}
    </Button>
  );
}
