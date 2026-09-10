export interface AdminEnrollmentSummaryInput {
  courseTitle: string;
  email: string;
  expiresAt: Date;
  id: string;
  lastAccessAt: Date | null;
  name: string;
  startsAt: Date;
  status: string;
  userId: string;
}

export interface AdminStudentProfileInput {
  email: string;
  lastAccessAt: Date | null;
  name: string;
  platformBlockedAt: Date | null;
  platformBlockedReason: string | null;
  userId: string;
}

export interface AdminStudentEffectiveAccessInput {
  activeEnrollments: number;
  nextExpiration: Date | null;
}

export interface AdminStudentSummary {
  activeEnrollments: number;
  courseCount: number;
  email: string;
  firstEnrollmentAt: Date | null;
  lastAccessAt: Date | null;
  latestExpiration: Date | null;
  name: string;
  nextExpiration: Date | null;
  platformBlockedAt: Date | null;
  platformBlockedReason: string | null;
  revokedEnrollments: number;
  status: string;
  userId: string;
}

const createEmptyStudentSummary = (
  student: AdminStudentProfileInput
): AdminStudentSummary => ({
  activeEnrollments: 0,
  courseCount: 0,
  email: student.email,
  firstEnrollmentAt: null,
  lastAccessAt: student.lastAccessAt,
  latestExpiration: null,
  name: student.name,
  nextExpiration: null,
  platformBlockedAt: student.platformBlockedAt,
  platformBlockedReason: student.platformBlockedReason,
  revokedEnrollments: 0,
  status: student.platformBlockedAt ? "blocked" : "not_enrolled",
  userId: student.userId,
});

const createStudentSummary = (
  enrollment: AdminEnrollmentSummaryInput
): AdminStudentSummary => ({
  activeEnrollments: enrollment.status === "active" ? 1 : 0,
  courseCount: 1,
  email: enrollment.email,
  firstEnrollmentAt: enrollment.startsAt,
  lastAccessAt: enrollment.lastAccessAt,
  latestExpiration: enrollment.expiresAt,
  name: enrollment.name,
  nextExpiration: enrollment.status === "active" ? enrollment.expiresAt : null,
  platformBlockedAt: null,
  platformBlockedReason: null,
  revokedEnrollments: enrollment.status === "revoked" ? 1 : 0,
  status: enrollment.status,
  userId: enrollment.userId,
});

const resolveAggregateStatus = (
  currentStatus: string,
  nextStatus: string
): string => {
  if (currentStatus === "active" || nextStatus === "active") {
    return "active";
  }

  if (currentStatus === "expired" || nextStatus === "expired") {
    return "expired";
  }

  return nextStatus;
};

const mergeEnrollmentIntoSummary = (
  current: AdminStudentSummary,
  enrollment: AdminEnrollmentSummaryInput
): void => {
  current.courseCount += 1;
  current.activeEnrollments += enrollment.status === "active" ? 1 : 0;
  current.revokedEnrollments += enrollment.status === "revoked" ? 1 : 0;
  current.status = current.platformBlockedAt
    ? "blocked"
    : resolveAggregateStatus(current.status, enrollment.status);

  if (
    !current.latestExpiration ||
    enrollment.expiresAt > current.latestExpiration
  ) {
    current.latestExpiration = enrollment.expiresAt;
  }

  if (
    enrollment.status === "active" &&
    (!current.nextExpiration || enrollment.expiresAt < current.nextExpiration)
  ) {
    current.nextExpiration = enrollment.expiresAt;
  }

  if (
    !current.firstEnrollmentAt ||
    enrollment.startsAt < current.firstEnrollmentAt
  ) {
    current.firstEnrollmentAt = enrollment.startsAt;
  }

  if (
    enrollment.lastAccessAt &&
    (!current.lastAccessAt || enrollment.lastAccessAt > current.lastAccessAt)
  ) {
    current.lastAccessAt = enrollment.lastAccessAt;
  }
};

const getEffectiveStudentStatus = (
  summary: AdminStudentSummary,
  access: AdminStudentEffectiveAccessInput
): string => {
  if (summary.platformBlockedAt) {
    return "blocked";
  }
  if (access.activeEnrollments > 0) {
    return "active";
  }
  if (summary.courseCount === 0) {
    return "not_enrolled";
  }
  if (summary.revokedEnrollments === summary.courseCount) {
    return "revoked";
  }
  return "inactive";
};

const applyEffectiveAccessProjection = (
  summary: AdminStudentSummary,
  access: AdminStudentEffectiveAccessInput
): void => {
  summary.activeEnrollments = access.activeEnrollments;
  summary.nextExpiration = access.nextExpiration;
  summary.status = getEffectiveStudentStatus(summary, access);
};

export const summarizeAdminStudents = (
  enrollments: AdminEnrollmentSummaryInput[],
  studentProfiles: AdminStudentProfileInput[] = [],
  effectiveAccessByUserId?: ReadonlyMap<
    string,
    AdminStudentEffectiveAccessInput
  >
): AdminStudentSummary[] => {
  const byUserId = new Map<string, AdminStudentSummary>();

  for (const student of studentProfiles) {
    byUserId.set(student.userId, createEmptyStudentSummary(student));
  }

  for (const enrollment of enrollments) {
    const current = byUserId.get(enrollment.userId);

    if (!current) {
      byUserId.set(enrollment.userId, createStudentSummary(enrollment));
      continue;
    }

    mergeEnrollmentIntoSummary(current, enrollment);
  }

  if (effectiveAccessByUserId) {
    for (const [userId, access] of effectiveAccessByUserId) {
      const summary = byUserId.get(userId);
      if (!summary) {
        continue;
      }

      applyEffectiveAccessProjection(summary, access);
    }
  }

  return [...byUserId.values()].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR")
  );
};
