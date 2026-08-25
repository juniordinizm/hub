import { getSupportCourseOperations } from "@/features/admin/support-server";
import { SupportDashboard } from "../../support-dashboard";

export const dynamic = "force-dynamic";

export default async function SupportCoursesPage(): Promise<React.JSX.Element> {
  const courses = await getSupportCourseOperations();

  return <SupportDashboard courses={courses} />;
}
