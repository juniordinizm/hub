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
