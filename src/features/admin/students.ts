export interface AdminEnrollmentSummaryInput {
  courseTitle: string;
  email: string;
  expiresAt: Date;
  id: string;
  name: string;
  status: string;
  userId: string;
}

export interface AdminStudentSummary {
  activeEnrollments: number;
  courseCount: number;
  email: string;
  latestExpiration: Date;
  name: string;
  revokedEnrollments: number;
  userId: string;
}

export const summarizeAdminStudents = (
  enrollments: AdminEnrollmentSummaryInput[]
): AdminStudentSummary[] => {
  const byUserId = new Map<string, AdminStudentSummary>();

  for (const enrollment of enrollments) {
    const current = byUserId.get(enrollment.userId);

    if (!current) {
      byUserId.set(enrollment.userId, {
        activeEnrollments: enrollment.status === "active" ? 1 : 0,
        courseCount: 1,
        email: enrollment.email,
        latestExpiration: enrollment.expiresAt,
        name: enrollment.name,
        revokedEnrollments: enrollment.status === "revoked" ? 1 : 0,
        userId: enrollment.userId,
      });
      continue;
    }

    current.courseCount += 1;

    if (enrollment.status === "active") {
      current.activeEnrollments += 1;
    }

    if (enrollment.status === "revoked") {
      current.revokedEnrollments += 1;
    }

    if (enrollment.expiresAt > current.latestExpiration) {
      current.latestExpiration = enrollment.expiresAt;
    }
  }

  return [...byUserId.values()].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR")
  );
};
