import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateInput,
  formatDateTime,
  formatShortDate,
} from "./formatters";
import { APP_TIME_ZONE } from "./timezone";

const INSTANT = new Date("2026-08-05T12:00:00.000Z");

describe("application date formatters", () => {
  it("uses the fixed application timezone for dates and times", () => {
    expect(APP_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(formatDate(INSTANT)).toBe("5 de ago. de 2026");
    expect(formatShortDate(INSTANT)).toBe("05/08/2026");
    expect(formatDateTime(INSTANT)).toBe("05/08/2026, 09:00");
  });

  it("formats calendar inputs from the application timezone", () => {
    expect(formatDateInput("2026-08-05")).toBe("2026-08-05");
    expect(formatDateInput(new Date("2026-08-06T02:59:59.999Z"))).toBe(
      "2026-08-05"
    );
  });
});
