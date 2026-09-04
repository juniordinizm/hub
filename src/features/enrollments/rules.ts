export type EnrollmentStatus = "active" | "expired" | "revoked";

export interface EnrollmentContentReleaseState {
  mode: "full_access" | "scheduled";
  startedAt: Date | null;
}

export interface EnrollmentContentReleaseTransition
  extends EnrollmentContentReleaseState {
  event: "content_release_scheduled" | null;
}

export type EnrollmentAccessState =
  | {
      canAccessLessons: true;
      reason: "active";
    }
  | {
      canAccessLessons: false;
      reason: "expired" | "not_started" | "revoked";
    };

const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;

export type EnrollmentExpiryWarningKind = "7d" | "1d";

export const getEnrollmentContentReleaseTransition = ({
  hasDelayedModules,
  now,
  preserveExisting,
  previous,
  wasContinuouslyActive,
}: {
  hasDelayedModules: boolean;
  now: Date;
  preserveExisting: boolean;
  previous: EnrollmentContentReleaseState | null;
  wasContinuouslyActive: boolean;
}): EnrollmentContentReleaseTransition => {
  if (previous?.mode === "scheduled" && !previous.startedAt) {
    throw new Error("Matricula agendada sem inicio da entrega.");
  }

  if (previous && (preserveExisting || wasContinuouslyActive)) {
    return { ...previous, event: null };
  }

  if (hasDelayedModules) {
    return {
      event: "content_release_scheduled",
      mode: "scheduled",
      startedAt: now,
    };
  }

  return { event: null, mode: "full_access", startedAt: null };
};

export const addMonths = (date: Date, months: number): Date => {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate;
};

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * MILLISECONDS_PER_HOUR);

export const validateEnrollmentAdjustmentReason = (reason: string): string => {
  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    throw new Error("Informe o motivo do ajuste de expiracao.");
  }

  return normalizedReason;
};

export const getExtendedEnrollmentExpiration = ({
  currentEffectiveExpiresAt,
  days,
  months,
  now,
}: {
  currentEffectiveExpiresAt: Date;
  days: number;
  months: number;
  now: Date;
}): Date => {
  const base =
    currentEffectiveExpiresAt > now ? currentEffectiveExpiresAt : now;
  const withMonths = months ? addMonths(base, months) : new Date(base);

  return days ? addDays(withMonths, days) : withMonths;
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
  accessDurationMonths,
  currentExpiresAt,
  paidAt,
}: {
  accessDurationMonths: number;
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
    expiresAt: addMonths(renewalBase, accessDurationMonths),
  };
};
