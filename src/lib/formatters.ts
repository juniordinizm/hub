export const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(date);

export const formatPercent = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value / 100);

export const formatCurrencyInCents = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);

/**
 * Normalizes a WhatsApp contact value into a `https://wa.me/<digits>` URL.
 * Accepts raw phone numbers (e.g. "+55 11 91234-5678"), wa.me links,
 * or api.whatsapp.com links. Returns `null` when no digits can be extracted.
 */
export const formatWhatsappUrl = (value: string): string | null => {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  return `https://wa.me/${digits}`;
};
