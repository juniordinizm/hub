"use client";

import { CopyLinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CoursePurchaseLink as CoursePurchaseLinkValue } from "@/features/payments/course-purchase-link";

const unavailableMessages: Record<
  Extract<CoursePurchaseLinkValue, { available: false }>["reason"],
  string
> = {
  checkout_disabled: "o checkout público está desativado",
  course_inactive: "o curso não está ativo",
  course_unpublished: "o curso ainda não possui uma publicação publicada",
  invalid_price: "o preço não atende ao mínimo do checkout",
  sales_closed: "as vendas estão pausadas",
};

export function CoursePurchaseLink({
  link,
  publicUrl,
}: {
  link: CoursePurchaseLinkValue;
  publicUrl: string;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const selectLinkForManualCopy = (): void => {
    if (!mountedRef.current) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
    toast.error(
      "Não foi possível copiar automaticamente. O link foi selecionado; pressione Ctrl+C para copiar."
    );
  };

  const handleCopy = async (): Promise<void> => {
    if (!navigator.clipboard?.writeText) {
      selectLinkForManualCopy();
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      if (mountedRef.current) {
        toast.success("Link público copiado.");
      }
    } catch {
      selectLinkForManualCopy();
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        aria-label="Copiar link público"
        onClick={handleCopy}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={CopyLinkIcon}
          size={16}
          strokeWidth={2}
        />
        Link público
      </Button>
      <Input
        aria-label="Link público de compra"
        className="sr-only"
        id="course-purchase-link"
        readOnly
        ref={inputRef}
        value={publicUrl}
      />
      {link.available ? null : (
        <p className="max-w-xs text-muted-foreground text-xs sm:text-right">
          Checkout público indisponível: {unavailableMessages[link.reason]} (
          <code>{link.reason}</code>).
        </p>
      )}
    </div>
  );
}
