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

export interface AdminStudentSummary {
  activeEnrollments: number;
  courseCount: number;
  email: string;
  firstEnrollmentAt: Date;
  lastAccessAt: Date | null;
  latestExpiration: Date;
  name: string;
  revokedEnrollments: number;
  status: string;
  userId: string;
}

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
  current.status = resolveAggregateStatus(current.status, enrollment.status);

  if (enrollment.expiresAt > current.latestExpiration) {
    current.latestExpiration = enrollment.expiresAt;
  }

  if (enrollment.startsAt < current.firstEnrollmentAt) {
    current.firstEnrollmentAt = enrollment.startsAt;
  }

  if (
    enrollment.lastAccessAt &&
    (!current.lastAccessAt || enrollment.lastAccessAt > current.lastAccessAt)
  ) {
    current.lastAccessAt = enrollment.lastAccessAt;
  }
};

export const summarizeAdminStudents = (
  enrollments: AdminEnrollmentSummaryInput[]
): AdminStudentSummary[] => {
  const byUserId = new Map<string, AdminStudentSummary>();

  for (const enrollment of enrollments) {
    const current = byUserId.get(enrollment.userId);

    if (!current) {
      byUserId.set(enrollment.userId, createStudentSummary(enrollment));
      continue;
    }

    mergeEnrollmentIntoSummary(current, enrollment);
  }

  return [...byUserId.values()].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR")
  );
};
