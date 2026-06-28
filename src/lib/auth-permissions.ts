import "server-only";
import { redirect } from "next/navigation";
import {
  type AuthPermission,
  canPerform,
  rolesForPermission,
} from "@/lib/auth-policy";
import { route } from "@/lib/routes";
import { type AppSession, requireRole } from "@/lib/session";

export const requirePermission = async (
  permission: AuthPermission
): Promise<AppSession> => {
  const session = await requireRole(rolesForPermission(permission));

  if (!canPerform(session.role, permission)) {
    redirect(route("/app"));
  }

  return session;
};
