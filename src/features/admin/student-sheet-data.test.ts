import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCertificateOperationsForUser, query, requirePermission } =
  vi.hoisted(() => ({
    getCertificateOperationsForUser: vi.fn(),
    query: vi.fn(),
    requirePermission: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/certificates/server", () => ({
  getCertificateOperationsForUser,
}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission }));

import { getAdminStudentSheetData } from "./server";

const student = {
  email: "student@example.test",
  enrollments: [
    {
      courseId: "course-1",
      courseTitle: "Curso 1",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      id: "enrollment-1",
      originalExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
      revokedReason: null,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      status: "active",
    },
    {
      courseId: "course-2",
      courseTitle: "Curso 2",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      id: "enrollment-2",
      originalExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
      revokedReason: null,
      startedAt: new Date("2026-02-01T00:00:00.000Z"),
      status: "expired",
    },
  ],
  name: "Student",
  platformBlockedAt: null,
  platformBlockedReason: null,
  userId: "student-1",
};
const courseOne = student.enrollments[0];
const courseTwo = student.enrollments[1];

if (!(courseOne && courseTwo)) {
  throw new Error("student fixture must include two enrollments");
}

const certificates = [
  {
    canReissue: true,
    code: "PRT-1",
    courseId: "course-1",
    courseTitle: "Curso 1",
    id: "certificate-1",
    issuedAt: new Date("2026-01-03T00:00:00.000Z"),
    renderStatus: "ready" as const,
    revokedAt: null,
    revokedReasonCategory: null,
    status: "valid" as const,
    studentName: "Student",
    workloadHours: 8,
  },
  {
    canReissue: true,
    code: "PRT-2",
    courseId: "course-2",
    courseTitle: "Curso 2",
    id: "certificate-2",
    issuedAt: new Date("2026-02-03T00:00:00.000Z"),
    renderStatus: "pending" as const,
    revokedAt: null,
    revokedReasonCategory: null,
    status: "valid" as const,
    studentName: "Student",
    workloadHours: 12,
  },
];

beforeEach(() => {
  getCertificateOperationsForUser.mockReset();
  requirePermission.mockReset();
  requirePermission.mockResolvedValue(undefined);
  query.mockReset();
});

describe("getAdminStudentSheetData", () => {
  it("returns all student operations for the global context", async () => {
    query.mockResolvedValue({
      rows: [
        {
          course_id: "course-1",
          course_title: "Curso 1",
          email: student.email,
          expires_at: courseOne.expiresAt,
          id: courseOne.id,
          name: student.name,
          original_expires_at: courseOne.originalExpiresAt,
          platform_blocked_at: student.platformBlockedAt,
          platform_blocked_reason: student.platformBlockedReason,
          revoked_reason: courseOne.revokedReason,
          starts_at: courseOne.startedAt,
          status: courseOne.status,
          user_id: student.userId,
        },
        {
          course_id: "course-2",
          course_title: "Curso 2",
          email: student.email,
          expires_at: courseTwo.expiresAt,
          id: courseTwo.id,
          name: student.name,
          original_expires_at: courseTwo.originalExpiresAt,
          platform_blocked_at: student.platformBlockedAt,
          platform_blocked_reason: student.platformBlockedReason,
          revoked_reason: courseTwo.revokedReason,
          starts_at: courseTwo.startedAt,
          status: courseTwo.status,
          user_id: student.userId,
        },
      ],
    });
    getCertificateOperationsForUser.mockResolvedValue(certificates);

    await expect(
      getAdminStudentSheetData({ userId: "student-1" })
    ).resolves.toMatchObject({
      context: { courseId: null, courseTitle: null },
      student: { userId: "student-1", enrollments: student.enrollments },
      certificates,
    });
  });

  it("requires the administrative read permission", async () => {
    query.mockResolvedValue({ rows: [] });
    getCertificateOperationsForUser.mockResolvedValue([]);

    await getAdminStudentSheetData({ userId: "student-1" });

    expect(requirePermission).toHaveBeenCalledWith("viewAdminPanel");
  });

  it("filters the course context to one enrollment and its certificates", async () => {
    query.mockResolvedValue({
      rows: [
        {
          course_id: "course-1",
          course_title: "Curso 1",
          email: student.email,
          expires_at: courseOne.expiresAt,
          id: courseOne.id,
          name: student.name,
          original_expires_at: courseOne.originalExpiresAt,
          platform_blocked_at: student.platformBlockedAt,
          platform_blocked_reason: student.platformBlockedReason,
          revoked_reason: courseOne.revokedReason,
          starts_at: courseOne.startedAt,
          status: courseOne.status,
          user_id: student.userId,
        },
      ],
    });
    getCertificateOperationsForUser.mockResolvedValue(certificates);

    await expect(
      getAdminStudentSheetData({ courseId: "course-1", userId: "student-1" })
    ).resolves.toMatchObject({
      context: { courseId: "course-1", courseTitle: "Curso 1" },
      student: { enrollments: [courseOne] },
      certificates: [certificates[0]],
    });
  });

  it("returns null for a course the student does not have", async () => {
    query.mockResolvedValue({
      rows: [
        {
          course_id: "course-1",
          course_title: "Curso 1",
          email: student.email,
          expires_at: courseOne.expiresAt,
          id: courseOne.id,
          name: student.name,
          original_expires_at: courseOne.originalExpiresAt,
          platform_blocked_at: student.platformBlockedAt,
          platform_blocked_reason: student.platformBlockedReason,
          revoked_reason: courseOne.revokedReason,
          starts_at: courseOne.startedAt,
          status: courseOne.status,
          user_id: student.userId,
        },
      ],
    });
    getCertificateOperationsForUser.mockResolvedValue(certificates);

    await expect(
      getAdminStudentSheetData({
        courseId: "course-missing",
        userId: "student-1",
      })
    ).resolves.toBeNull();
  });

  it("keeps a student without enrollment available in the global context", async () => {
    query.mockResolvedValue({
      rows: [
        {
          course_id: null,
          course_title: null,
          email: student.email,
          expires_at: null,
          id: null,
          name: student.name,
          original_expires_at: null,
          platform_blocked_at: student.platformBlockedAt,
          platform_blocked_reason: student.platformBlockedReason,
          revoked_reason: null,
          starts_at: null,
          status: null,
          user_id: student.userId,
        },
      ],
    });
    getCertificateOperationsForUser.mockResolvedValue([]);

    await expect(
      getAdminStudentSheetData({ userId: "student-1" })
    ).resolves.toMatchObject({
      context: { courseId: null },
      student: { enrollments: [] },
      certificates: [],
    });
  });
});
