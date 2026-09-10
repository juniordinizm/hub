import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import {
  getLessonAnalyticsMetrics,
  getLessonAnalyticsMetricsPage,
  recordLearningAnalyticsEvent,
  setLearningAnalyticsPreference,
} from "./server";

describe("learning analytics preference persistence", () => {
  it("derives completed metrics from the current publication without an undeclared alias", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(getLessonAnalyticsMetrics()).resolves.toEqual([]);

    const metricsQuery = String(query.mock.calls[0]?.[0]);
    expect(metricsQuery).toContain("cp.course_id = e.course_id");
    expect(metricsQuery).toContain("e.starts_at <= now()");
    expect(metricsQuery).toContain("c.status = 'active'");
    expect(metricsQuery).not.toContain("m.course_id");
    expect(metricsQuery).toContain(
      "current_lesson.curriculum_key = completed_lesson.curriculum_key"
    );
    expect(metricsQuery).toContain(
      "date_trunc('day', current_timestamp at time zone 'America/Sao_Paulo')"
    );
    expect(metricsQuery).not.toContain("where occurred_at >= current_date");
    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageLearningAnalytics"
    );
  });

  it("pages aggregate lesson metrics without changing the export reader", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          completed: "1",
          course_publication_id: "publication-1",
          course_title: "Curso",
          eligible: "2",
          error_count: "0",
          lesson_id: "lesson-1",
          lesson_title: "Aula",
          median_checkpoint_percent: null,
          median_hours_to_complete: null,
          median_hours_to_next_lesson: null,
          publication_number: 1,
          started: "1",
          total_count: 21,
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      getLessonAnalyticsMetricsPage({ page: 2 })
    ).resolves.toMatchObject({
      hasNextPage: false,
      page: 2,
      pageSize: 20,
      totalCount: 21,
    });

    expect(String(query.mock.calls[0]?.[0])).toContain("limit $1 offset $2");
    expect(query.mock.calls[0]?.[1]).toEqual([21, 20]);
  });

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
    const eventSql = String(query.mock.calls[0]?.[0]);
    expect(eventSql).toContain("e.starts_at <= now()");
    expect(eventSql).toContain("c.status = 'active'");
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
