"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CopyStatus = "idle" | "success" | "error";

const getCopyStatusMessage = (status: CopyStatus): string => {
  if (status === "success") {
    return "Link copiado.";
  }
  if (status === "error") {
    return "Não foi possível copiar o link. Copie o endereço da página manualmente.";
  }
  return "";
};

export function CertificatePublicActions({
  code,
  pdfHref,
}: {
  code: string;
  pdfHref: string;
}): React.JSX.Element {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const certificateHref = `/certificados/${encodeURIComponent(code)}`;

  const copyCertificateLink = async (): Promise<void> => {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(
        new URL(certificateHref, window.location.origin).toString()
      );
      setCopyStatus("success");
      toast.success("Link copiado.");
    } catch {
      setCopyStatus("error");
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button asChild>
        <a download href={pdfHref}>
          Baixar PDF
        </a>
      </Button>
      <Button
        onClick={() => {
          copyCertificateLink().catch(() => setCopyStatus("error"));
        }}
        variant="outline"
      >
        Copiar link
      </Button>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {getCopyStatusMessage(copyStatus)}
      </p>
    </div>
  );
}
