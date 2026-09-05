export interface StudentSheetEnrollment {
  contentReleaseMode?: "full_access" | "scheduled";
  contentReleaseStartedAt?: string | null;
  courseId: string;
  courseTitle: string;
  expiresAt: string;
  id: string;
  nextModuleReleaseAt?: string | null;
  originalExpiresAt: string;
  revokedReason: string | null;
  startedAt: string;
  status: string;
  userId: string;
}

export interface StudentManagementCapabilities {
  canManageCertificates: boolean;
  canManageEnrollmentAccess?: boolean;
  canManageEnrollmentSupport: boolean;
  canManagePlatformAccess: boolean;
  canReissueCertificates: boolean;
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
  supportContext?: {
    audit: Array<{
      action: string;
      createdAt: string;
      targetId: string | null;
      targetType: string;
    }>;
    orders: Array<{
      amountInCents: number;
      createdAt: string;
      id: string;
      paidAmountInCents: number | null;
      refundStatus: string | null;
      refundedAmountInCents: number | null;
      status: string;
    }>;
    progress: {
      completedRequiredLessons: number;
      requiredLessons: number;
    };
  };
}
