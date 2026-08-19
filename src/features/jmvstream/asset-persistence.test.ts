import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));

import {
  getJmvstreamLessonContext,
  getJmvstreamLessonVideo,
} from "./asset-persistence";

const normalizeSql = (value: unknown): string =>
  String(value).replace(/\s+/g, " ").trim().toLowerCase();

describe("JMVStream lesson publication boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it("loads upload context only for lessons in a draft publication", async () => {
    await expect(getJmvstreamLessonContext("lesson-1")).resolves.toBeNull();

    const sql = normalizeSql(query.mock.calls[0]?.[0]);
    expect(sql).toContain(
      "join course_publications cp on cp.id = l.course_publication_id"
    );
    expect(sql).toContain("cp.status = 'draft'");
    expect(query.mock.calls[0]?.[1]).toEqual(["lesson-1"]);
  });

  it("loads a lesson video for manual synchronization only from a draft publication", async () => {
    await expect(getJmvstreamLessonVideo("lesson-1")).resolves.toBeNull();

    const sql = normalizeSql(query.mock.calls[0]?.[0]);
    expect(sql).toContain(
      "join course_publications cp on cp.id = l.course_publication_id"
    );
    expect(sql).toContain("cp.status = 'draft'");
    expect(query.mock.calls[0]?.[1]).toEqual(["lesson-1"]);
  });
});
