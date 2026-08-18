"use client";

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CertificateRenderStatus = "failed" | "pending" | "ready";
type CertificateStatus = "revoked" | "valid";

const getStatusPresentation = ({
  renderStatus,
  status,
}: {
  renderStatus: CertificateRenderStatus;
  status: CertificateStatus;
}): {
  description: string;
  label: string;
  tone: "danger" | "success" | "warning";
} => {
  if (status === "revoked") {
    return {
      description:
        "Este certificado foi revogado e não é válido para comprovar a conclusão.",
      label: "Certificado revogado",
      tone: "danger",
    };
  }
  if (renderStatus === "pending") {
    return {
      description:
        "Estamos preparando o documento. O PDF ficará disponível assim que a emissão terminar.",
      label: "Certificado em preparação",
      tone: "warning",
    };
  }
  if (renderStatus === "failed") {
    return {
      description:
        "Não foi possível preparar o documento. Entre em contato com o Suporte para revisar este certificado.",
      label: "Certificado indisponível",
      tone: "danger",
    };
  }
  return {
    description: "Documento válido e verificável pelo código público.",
    label: "Certificado válido",
    tone: "success",
  };
};

const toneClassNames = {
  danger: "border-destructive bg-card text-destructive",
  success:
    "border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700",
  warning: "border-accent bg-card text-accent",
} as const;

const getStatusIcon = (tone: "danger" | "success" | "warning") => {
  if (tone === "success") {
    return CheckmarkCircle02Icon;
  }
  if (tone === "warning") {
    return InformationCircleIcon;
  }
  return Alert02Icon;
};

const getStatusDataValue = ({
  renderStatus,
  status,
}: {
  renderStatus: CertificateRenderStatus;
  status: CertificateStatus;
}): "failed" | "pending" | "revoked" | "valid" => {
  if (status === "revoked") {
    return "revoked";
  }
  return renderStatus === "ready" ? "valid" : renderStatus;
};

export function CertificatePublicStatus({
  renderStatus,
  status,
}: {
  renderStatus: CertificateRenderStatus;
  status: CertificateStatus;
}): React.JSX.Element {
  const presentation = getStatusPresentation({ renderStatus, status });

  return (
    <section
      aria-live="polite"
      className="shrink-0"
      data-certificate-status={getStatusDataValue({ renderStatus, status })}
      role="status"
    >
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={`${presentation.label}: ${presentation.description}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                toneClassNames[presentation.tone]
              )}
              type="button"
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={getStatusIcon(presentation.tone)}
                size={14}
                strokeWidth={2}
              />
              <span>{presentation.label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {presentation.description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </section>
  );
}
