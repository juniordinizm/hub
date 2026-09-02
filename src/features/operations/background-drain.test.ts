import { describe, expect, it, vi } from "vitest";
import { scheduleAfterResponse } from "./background-drain";

describe("scheduleAfterResponse", () => {
  it("registers the callback with the supplied response scheduler", () => {
    const schedule = vi.fn();
    const callback = vi.fn();

    scheduleAfterResponse(callback, schedule);

    expect(schedule).toHaveBeenCalledWith(callback);
    expect(callback).not.toHaveBeenCalled();
  });
});
