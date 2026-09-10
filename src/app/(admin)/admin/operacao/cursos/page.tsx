import { redirect } from "next/navigation";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function SupportCoursesPage(): never {
  redirect(route("/admin"));
}
