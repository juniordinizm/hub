"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { AdminEnrollment } from "@/features/admin/server";
import type { AdminEnrollmentStatusFilter } from "@/features/admin/student-filters";
import {
  ADMIN_COURSE_STUDENT_ACTION_PARAM,
  ADMIN_COURSE_STUDENT_ID_PARAM,
  type AdminCourseStudentAction,
} from "@/features/admin/student-navigation";
import {
  StudentsTable,
  type StudentTableRow,
} from "../../alunos/students-table";
import { createCourseStudentsTableContext } from "../../alunos/students-table-context";

export type CourseEnrollmentRow = AdminEnrollment;

const toStudentTableRow = (
  enrollment: CourseEnrollmentRow
): StudentTableRow => ({
  email: enrollment.email,
  lastAccessAt: enrollment.lastAccessAt?.toISOString() ?? null,
  name: enrollment.name,
  platformBlockedAt: null,
  platformBlockedReason: null,
  status: enrollment.status,
  userId: enrollment.userId,
});

export function CourseEnrollmentsTable({
  courseId,
  enrollments,
  hasNextPage = false,
  initialAction = "details",
  initialStudentId,
  page = 1,
  search = "",
  statusFilter = "all",
  totalCount = enrollments.length,
}: {
  courseId: string;
  enrollments: CourseEnrollmentRow[];
  hasNextPage?: boolean;
  initialAction?: AdminCourseStudentAction | undefined;
  initialStudentId?: string | undefined;
  page?: number;
  search?: string;
  statusFilter?: AdminEnrollmentStatusFilter;
  totalCount?: number;
}): React.JSX.Element {
  const router = useRouter();
  const clearInitialStudentAction = useCallback((): void => {
    const params = new URLSearchParams(window.location.search);
    params.delete(ADMIN_COURSE_STUDENT_ID_PARAM);
    params.delete(ADMIN_COURSE_STUDENT_ACTION_PARAM);
    const query = params.toString();
    router.replace(
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      { scroll: false }
    );
  }, [router]);

  return (
    <StudentsTable
      context={createCourseStudentsTableContext(courseId, statusFilter)}
      hasNextPage={hasNextPage}
      initialAction={initialAction}
      initialStudentId={initialStudentId}
      onInitialOverlayClose={
        initialStudentId ? clearInitialStudentAction : undefined
      }
      page={page}
      search={search}
      students={enrollments.map(toStudentTableRow)}
      totalCount={totalCount}
    />
  );
}
