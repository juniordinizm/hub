import { describe, expect, it } from "vitest";
import { getMaintenanceRequestDecision } from "./maintenance-mode";

describe("maintenance request decision", () => {
  it.each([
    "/api/health",
    "/api/health/ready",
    "/api/cron/asaas-webhooks",
    "/manutencao",
  ])("allows technical path %s", (pathname) => {
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "GET",
        pathname,
      })
    ).toBe("allow");
  });

  it("rewrites navigations and rejects APIs or mutations", () => {
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "GET",
        pathname: "/entrar",
      })
    ).toBe("maintenance-page");
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "POST",
        pathname: "/entrar",
      })
    ).toBe("service-unavailable");
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "full",
        method: "GET",
        pathname: "/api/courses",
      })
    ).toBe("service-unavailable");
  });

  it("allows every request when maintenance is off", () => {
    expect(
      getMaintenanceRequestDecision({
        maintenanceMode: "off",
        method: "POST",
        pathname: "/admin",
      })
    ).toBe("allow");
  });
});
