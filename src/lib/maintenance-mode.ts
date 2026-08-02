export type MaintenanceMode = "full" | "off";
export type MaintenanceRequestDecision =
  | "allow"
  | "maintenance-page"
  | "service-unavailable";

const ALLOWED_EXACT_PATHS = new Set([
  "/api/health",
  "/api/health/ready",
  "/manutencao",
]);

export const getMaintenanceRequestDecision = ({
  maintenanceMode,
  method,
  pathname,
}: {
  maintenanceMode: MaintenanceMode;
  method: string;
  pathname: string;
}): MaintenanceRequestDecision => {
  if (
    maintenanceMode === "off" ||
    ALLOWED_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/api/cron/")
  ) {
    return "allow";
  }
  if (
    !["GET", "HEAD"].includes(method) ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  ) {
    return "service-unavailable";
  }
  return "maintenance-page";
};
