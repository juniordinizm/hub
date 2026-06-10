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
