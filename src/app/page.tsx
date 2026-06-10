import { redirect } from "next/navigation";
import { route } from "@/lib/routes";

export default function Home(): never {
  redirect(route("/app"));
}
