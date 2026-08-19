"use client";

import { CopyLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type CopyStatus = "error" | "idle" | "success";

const getCopyFeedback = (status: CopyStatus): string => {
  if (status === "success") {
    return "Link copiado.";
  }
  if (status === "error") {
    return "Não foi possível copiar o link. Tente novamente.";
  }
  return "";
};

export function CertificateCopyLinkButton({
  publicUrl,
}: {
  publicUrl: string;
}): React.JSX.Element {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const copyLink = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(publicUrl);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          copyLink().catch(() => setCopyStatus("error"));
        }}
        type="button"
        variant="outline"
      >
        <HugeiconsIcon data-icon="inline-start" icon={CopyLinkIcon} />
        {copyStatus === "success" ? "Link copiado" : "Copiar link"}
      </Button>
      <span aria-atomic="true" aria-live="polite" className="sr-only">
        {getCopyFeedback(copyStatus)}
      </span>
    </>
  );
}
