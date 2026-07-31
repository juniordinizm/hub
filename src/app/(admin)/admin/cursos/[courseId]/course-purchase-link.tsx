"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CoursePurchaseLink as CoursePurchaseLinkValue } from "@/features/payments/course-purchase-link";

const unavailableMessages: Record<
  Extract<CoursePurchaseLinkValue, { available: false }>["reason"],
  string
> = {
  checkout_disabled: "o checkout publico esta desativado",
  course_inactive: "o curso nao esta ativo",
  course_unpublished: "o curso ainda nao possui uma publicacao publicada",
  invalid_price: "o preco nao atende ao minimo do checkout",
};

export function CoursePurchaseLink({
  link,
}: {
  link: CoursePurchaseLinkValue;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!link.available) {
    return (
      <p className="text-muted-foreground text-sm">
        Link publico indisponivel: {unavailableMessages[link.reason]} (
        <code>{link.reason}</code>).
      </p>
    );
  }

  const selectLinkForManualCopy = (): void => {
    if (!mountedRef.current) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
    setFeedback(
      "Nao foi possivel copiar automaticamente. O link foi selecionado; pressione Ctrl+C para copiar."
    );
  };

  const handleCopy = async (): Promise<void> => {
    if (!navigator.clipboard?.writeText) {
      selectLinkForManualCopy();
      return;
    }

    try {
      await navigator.clipboard.writeText(link.url);
      if (mountedRef.current) {
        setFeedback("Link copiado.");
      }
    } catch {
      selectLinkForManualCopy();
    }
  };

  return (
    <div className="space-y-2">
      <label className="font-medium text-sm" htmlFor="course-purchase-link">
        Link publico de compra
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="font-mono text-xs"
          id="course-purchase-link"
          readOnly
          ref={inputRef}
          value={link.url}
        />
        <Button onClick={handleCopy} type="button" variant="outline">
          Copiar link
        </Button>
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {feedback}
      </p>
    </div>
  );
}
