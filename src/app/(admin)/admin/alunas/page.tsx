import { redirect } from "next/navigation";
import { route } from "@/lib/routes";

export default function AdminLegacyStudentsPage(): never {
  redirect(route("/admin/alunos"));
}
