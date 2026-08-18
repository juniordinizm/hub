"use client";

import { useState } from "react";
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
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <a download href={pdfHref}>
          Baixar PDF
        </a>
      </Button>
      <Button
        onClick={() => {
          copyCertificateLink().catch(() => setCopyStatus("error"));
        }}
        size="lg"
        variant="outline"
      >
        {copyStatus === "success" ? "Link copiado" : "Copiar link"}
      </Button>
      <p aria-atomic="true" aria-live="polite" role="status">
        {getCopyStatusMessage(copyStatus)}
      </p>
    </div>
  );
}
