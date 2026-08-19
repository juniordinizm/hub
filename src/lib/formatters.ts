import { APP_TIME_ZONE } from "./timezone";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: APP_TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const dateInputFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIME_ZONE,
  year: "numeric",
});

const DATE_ONLY_VALUE = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const getDatePart = (parts: Intl.DateTimeFormatPart[], type: string): string =>
  parts.find((part) => part.type === type)?.value ?? "";

export const formatDate = (value: Date | string): string =>
  dateFormatter.format(toDate(value));

export const formatShortDate = (value: Date | string): string =>
  shortDateFormatter.format(toDate(value));

export const formatDateTime = (value: Date | string): string =>
  dateTimeFormatter.format(toDate(value));

export const formatDateInput = (value: Date | string): string => {
  if (typeof value === "string" && DATE_ONLY_VALUE.test(value)) {
    return value;
  }

  const parts = dateInputFormatter.formatToParts(toDate(value));
  const year = getDatePart(parts, "year");
  const month = getDatePart(parts, "month");
  const day = getDatePart(parts, "day");

  return `${year}-${month}-${day}`;
};

export const formatCurrencyInCents = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);
