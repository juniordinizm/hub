import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: vi.fn(),
}));

import {
  recordLearningAnalyticsEvent,
  setLearningAnalyticsPreference,
} from "./server";

describe("learning analytics preference persistence", () => {
  it("records a raw event only through the opt-out-aware enrollment query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await recordLearningAnalyticsEvent({
      eventType: "lesson_started",
      idempotencyKey: "event-1",
      lessonId: "lesson-1",
      userId: "student-1",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("learning_analytics_preferences preference"),
      ["lesson_started", "event-1", null, null, "lesson-1", "student-1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("preference.disabled_at is null"),
      expect.any(Array)
    );
  });

  it("removes only the opting-out student raw events before persisting the preference", async () => {
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await setLearningAnalyticsPreference({
      enabled: false,
      userId: "student-1",
    });

    expect(query).toHaveBeenNthCalledWith(1, "begin");
    expect(query).toHaveBeenNthCalledWith(
      2,
      "delete from learning_analytics_events where user_id = $1",
      ["student-1"]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("learning_analytics_preferences"),
      ["student-1", "2026-07-22"]
    );
    expect(query).toHaveBeenNthCalledWith(4, "commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("restores the default by removing only the student preference", async () => {
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await setLearningAnalyticsPreference({
      enabled: true,
      userId: "student-1",
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      "delete from learning_analytics_preferences where user_id = $1",
      ["student-1"]
    );
    expect(query).toHaveBeenNthCalledWith(3, "commit");
  });
});
