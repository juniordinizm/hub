import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getHomeHrefForRole } from "@/features/courses/preview";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export default async function Home(): Promise<never> {
  await connection();
  const session = await requireSession();

  redirect(route(getHomeHrefForRole(session.role)));
}
