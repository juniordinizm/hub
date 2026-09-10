export const getStudentManagementDataUrl = (
  userId: string,
  courseId?: string
): string => {
  const params = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
  return `/api/admin/students/${encodeURIComponent(userId)}${params}`;
};
