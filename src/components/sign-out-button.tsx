"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
      className={`gap-2 ${className ?? ""}`}
      disabled={isPending}
      onClick={handleSignOut}
      type="button"
      variant={variant}
    >
      <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.5} />
      {isPending ? "Saindo..." : "Sair"}
    </Button>
  );
}
