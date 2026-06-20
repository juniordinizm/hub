import { redirect } from "next/navigation";
import { getHomeHrefForRole } from "@/features/courses/preview";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export default async function Home(): Promise<never> {
  const session = await requireSession();

  redirect(route(getHomeHrefForRole(session.role)));
}
