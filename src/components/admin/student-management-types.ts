export interface StudentSheetEnrollment {
  courseId: string;
  courseTitle: string;
  expiresAt: string;
  id: string;
  originalExpiresAt: string;
  revokedReason: string | null;
  startedAt: string;
  status: string;
  userId: string;
}

export interface StudentSheetCertificate {
  canReissue: boolean;
  code: string;
  courseId: string;
  courseTitle: string;
  id: string;
  issuedAt: string;
  renderStatus: "failed" | "pending" | "ready";
  revokedAt: string | null;
  revokedReasonCategory: string | null;
  status: "revoked" | "valid";
  studentName: string;
  workloadHours: number;
}

export interface StudentSheetPayload {
  certificates: StudentSheetCertificate[];
  context: {
    courseId: string | null;
    courseTitle: string | null;
  };
  student: {
    email: string;
    enrollments: StudentSheetEnrollment[];
    name: string;
    platformBlockedAt: string | null;
    platformBlockedReason: string | null;
    userId: string;
  };
}
