import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import { APP_TIME_ZONE } from "@/lib/timezone";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readOptionalNumber = (formData: FormData, key: string): number | null => {
  const rawValue = readString(formData, key);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
};

const requiredEnrollmentId = z.string().trim().min(1, "Matricula invalida.");
const requiredUserId = z.string().trim().min(1, "Aluno invalido.");
const optionalUserId = z.string().trim();
const reason = z.string().trim();

const enrollmentAccessSchema = z.object({
  enrollmentId: requiredEnrollmentId,
  reason,
  userId: optionalUserId,
});

const createStudentPlatformAccessSchema = (reasonErrorMessage: string) =>
  z.object({
    reason: z.string().trim().min(1, reasonErrorMessage),
    userId: requiredUserId,
  });

const getStartOfToday = (): Date => {
  const today = new TZDate(Date.now(), APP_TIME_ZONE);
  return new TZDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
    0,
    APP_TIME_ZONE
  );
};

const assertExpirationDateIsNotInPast = (date: Date): void => {
  const selectedDate = new TZDate(date, APP_TIME_ZONE);
  const selectedDayStart = new TZDate(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    0,
    0,
    0,
    0,
    APP_TIME_ZONE
  );

  if (selectedDayStart.getTime() < getStartOfToday().getTime()) {
    throw new Error("A data de expiracao nao pode ser anterior a hoje.");
  }
};

export const parseExpirationDateSelection = (value: string): Date => {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    const parsed = new Date(value);

    if (Number.isFinite(parsed.getTime())) {
      assertExpirationDateIsNotInPast(parsed);
      return parsed;
    }

    throw new Error("Informe a nova data de expiracao.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const selectedDayStart = new TZDate(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0,
    APP_TIME_ZONE
  );

  if (
    selectedDayStart.getFullYear() !== year ||
    selectedDayStart.getMonth() !== month - 1 ||
    selectedDayStart.getDate() !== day
  ) {
    throw new Error("Informe a nova data de expiracao.");
  }

  assertExpirationDateIsNotInPast(selectedDayStart);

  return new TZDate(year, month - 1, day, 23, 59, 59, 999, APP_TIME_ZONE);
};

export const parseExtendEnrollmentExpirationInput = (formData: FormData) => ({
  ...enrollmentAccessSchema.parse({
    enrollmentId: readString(formData, "enrollmentId"),
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  }),
  days: readOptionalNumber(formData, "days"),
  months: readOptionalNumber(formData, "months"),
});

export const parseSetEnrollmentExpirationInput = (formData: FormData) => {
  const input = enrollmentAccessSchema.parse({
    enrollmentId: readString(formData, "enrollmentId"),
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  });

  return {
    ...input,
    newExpiresAt: parseExpirationDateSelection(
      readString(formData, "newExpiresAt")
    ),
  };
};

export const parseAdjustEnrollmentExpirationInput = (formData: FormData) => ({
  ...enrollmentAccessSchema.parse({
    enrollmentId: readString(formData, "enrollmentId"),
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  }),
  adjustment: readString(formData, "adjustment"),
  newExpiresAtValue: readString(formData, "newExpiresAt"),
});

export const parseEnrollmentAccessInput = (formData: FormData) =>
  enrollmentAccessSchema.parse({
    enrollmentId: readString(formData, "enrollmentId"),
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  });

export const parseGrantEnrollmentFullContentAccessInput = (
  formData: FormData
) =>
  z
    .object({
      enrollmentId: requiredEnrollmentId,
      reason: z.string().trim().min(1, "Informe o motivo da liberação."),
    })
    .parse({
      enrollmentId: readString(formData, "enrollmentId"),
      reason: readString(formData, "reason"),
    });

export const parseStudentPlatformAccessInput = (
  formData: FormData,
  reasonErrorMessage: string
) =>
  createStudentPlatformAccessSchema(reasonErrorMessage).parse({
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  });
