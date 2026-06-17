export type EnrollmentStatus = "active" | "expired" | "revoked";

export type EnrollmentAccessState =
  | {
      canAccessLessons: true;
      reason: "active";
    }
  | {
      canAccessLessons: false;
      reason: "expired" | "not_started" | "revoked";
    };

const DEFAULT_ACCESS_MONTHS = 12;
const MILLISECONDS_PER_DAY = 86_400_000;

export type EnrollmentExpiryWarningKind = "7d" | "1d";

export const addMonths = (date: Date, months: number): Date => {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate;
};

export const getEnrollmentAccessState = ({
  status,
  startsAt,
  expiresAt,
  now,
}: {
  status: EnrollmentStatus;
  startsAt: Date;
  expiresAt: Date;
  now: Date;
}): EnrollmentAccessState => {
  if (status === "revoked") {
    return { canAccessLessons: false, reason: "revoked" };
  }

  if (now < startsAt) {
    return { canAccessLessons: false, reason: "not_started" };
  }

  if (status === "expired" || now > expiresAt) {
    return { canAccessLessons: false, reason: "expired" };
  }

  return { canAccessLessons: true, reason: "active" };
};

export const shouldExpireEnrollment = ({
  expiresAt,
  now,
  status,
}: {
  expiresAt: Date;
  now: Date;
  status: EnrollmentStatus;
}): boolean => status === "active" && now > expiresAt;

export const getEnrollmentExpiryWarningKind = ({
  expiresAt,
  now,
  warning1dSentAt,
  warning7dSentAt,
}: {
  expiresAt: Date;
  now: Date;
  warning1dSentAt: Date | null;
  warning7dSentAt: Date | null;
}): EnrollmentExpiryWarningKind | null => {
  const daysUntilExpiration = Math.ceil(
    (expiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY
  );

  if (daysUntilExpiration < 0) {
    return null;
  }

  if (daysUntilExpiration <= 1) {
    return warning1dSentAt ? null : "1d";
  }

  if (daysUntilExpiration <= 7) {
    return warning7dSentAt ? null : "7d";
  }

  return null;
};

export const getRenewedAccessWindow = ({
  currentExpiresAt,
  paidAt,
}: {
  currentExpiresAt: Date | null;
  paidAt: Date;
}): {
  startsAt: Date;
  expiresAt: Date;
} => {
  const renewalBase =
    currentExpiresAt && currentExpiresAt > paidAt ? currentExpiresAt : paidAt;

  return {
    startsAt: paidAt,
    expiresAt: addMonths(renewalBase, DEFAULT_ACCESS_MONTHS),
  };
};
