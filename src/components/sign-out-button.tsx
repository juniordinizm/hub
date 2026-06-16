"use client";

import { createAuthClient } from "better-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient();

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
    await authClient.signOut();
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
