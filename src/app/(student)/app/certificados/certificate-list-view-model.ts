import { certificateReasonLabel } from "@/features/certificates/reasons";
import type { CertificateRecord } from "@/features/certificates/server";
import { formatDate } from "@/lib/formatters";

type CertificateListViewModelInput = Pick<
  CertificateRecord,
  "renderStatus" | "revokedAt" | "revokedReasonCategory" | "status"
>;

export interface CertificateListViewModel {
  alert: {
    description: string;
    title: string;
    variant: "default" | "destructive";
  } | null;
  badgeVariant: "default" | "destructive" | "secondary";
  canDownload: boolean;
  kind: "available" | "failed" | "preparing" | "revoked";
  showSupportAction: boolean;
  statusLabel: string;
}

const getRevocationDescription = ({
  revokedAt,
  revokedReasonCategory,
}: CertificateListViewModelInput): string => {
  const revokedDate = revokedAt ? formatDate(revokedAt) : "data não registrada";
  const reason = revokedReasonCategory
    ? certificateReasonLabel(revokedReasonCategory)
    : "Motivo administrativo";

  return `Revogado em ${revokedDate}. Motivo: ${reason}.`;
};

export const getCertificateListViewModel = (
  certificate: CertificateListViewModelInput
): CertificateListViewModel => {
  if (certificate.status === "revoked") {
    return {
      alert: {
        description: getRevocationDescription(certificate),
        title: "Este certificado foi revogado",
        variant: "destructive",
      },
      badgeVariant: "destructive",
      canDownload: false,
      kind: "revoked",
      showSupportAction: false,
      statusLabel: "Revogado",
    };
  }

  if (certificate.renderStatus === "failed") {
    return {
      alert: {
        description:
          "Não foi possível preparar o arquivo. Fale com o suporte para verificarmos o certificado.",
        title: "Falha no preparo do PDF",
        variant: "destructive",
      },
      badgeVariant: "destructive",
      canDownload: false,
      kind: "failed",
      showSupportAction: true,
      statusLabel: "Falha no preparo",
    };
  }

  if (certificate.renderStatus === "ready") {
    return {
      alert: null,
      badgeVariant: "default",
      canDownload: true,
      kind: "available",
      showSupportAction: false,
      statusLabel: "Disponível",
    };
  }

  return {
    alert: {
      description:
        "O certificado já foi emitido. O download será liberado assim que o arquivo ficar pronto.",
      title: "Estamos preparando seu PDF",
      variant: "default",
    },
    badgeVariant: "secondary",
    canDownload: false,
    kind: "preparing",
    showSupportAction: false,
    statusLabel: "Preparando",
  };
};
