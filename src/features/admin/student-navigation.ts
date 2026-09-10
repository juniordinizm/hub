export type AdminCourseStudentAction = "certificate" | "details" | "enrollment";

export const ADMIN_COURSE_STUDENT_ID_PARAM = "enrollmentStudentId";
export const ADMIN_COURSE_STUDENT_ACTION_PARAM = "enrollmentAction";

const isAdminCourseStudentAction = (
  value: string | undefined
): value is AdminCourseStudentAction =>
  value === "certificate" || value === "details" || value === "enrollment";

export const parseAdminCourseStudentAction = (
  value: string | undefined
): AdminCourseStudentAction =>
  isAdminCourseStudentAction(value) ? value : "details";

export const getAdminCourseStudentUrl = (
  courseId: string,
  userId: string,
  action: AdminCourseStudentAction = "details"
): string => {
  const params = new URLSearchParams({
    tab: "students",
    [ADMIN_COURSE_STUDENT_ID_PARAM]: userId,
  });
  if (action !== "details") {
    params.set(ADMIN_COURSE_STUDENT_ACTION_PARAM, action);
  }

  return `/admin/cursos/${encodeURIComponent(courseId)}?${params.toString()}`;
};
