import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function AdminSearchPill({
  href,
  value,
}: {
  href: string;
  value: string;
}): React.JSX.Element {
  const label = `Busca: ${value}`;

  return (
    <Badge
      asChild
      className="min-h-9 max-w-full cursor-pointer px-2.5 py-1"
      variant="secondary"
    >
      <Link
        aria-label={`Remover filtro ${label}`}
        className="flex min-h-9 max-w-full items-center gap-1.5"
        href={href}
        title={`Remover filtro ${label}`}
      >
        <span className="truncate">{label}</span>
        <HugeiconsIcon
          aria-hidden="true"
          icon={Cancel01Icon}
          size={14}
          strokeWidth={2}
        />
      </Link>
    </Badge>
  );
}
