import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: dependencies.connect, query: dependencies.query }),
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import {
  archiveCourse,
  restoreCourse,
  setCourseAvailability,
  setCourseSaleInterest,
} from "./availability-server";

const ACTIVE_COURSE = {
  catalog_visibility: "listed",
  has_commercial_history: true,
  has_published_publication: true,
  id: "course-1",
  payment_allow_credit_card: true,
  payment_allow_pix: true,
  price_in_cents: 10_000,
  sales_status: "open",
  slug: "curso-publico",
  status: "active",
};

const createClient = (course = ACTIVE_COURSE) => {
  const query = vi.fn((sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.startsWith("select c.id")) {
      return { rows: [course] };
    }
    if (normalized.includes("from course_sale_interests")) {
      return { rows: [{ id: "interest-1" }, { id: "interest-2" }] };
    }
    if (
      normalized.includes("from orders") &&
      normalized.includes("checkout_status")
    ) {
      return { rows: [{ id: "order-1" }] };
    }
    if (normalized.includes("returning id")) {
      return { rows: [{ id: "interest-1" }] };
    }
    return { rows: [] };
  });
  return { query, release: vi.fn() };
};

describe("Course availability commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-1",
      inserted: true,
    });
  });

  it("pauses sales, preserves delivery, and enqueues active checkout cancellation", async () => {
    const client = createClient();
    dependencies.connect.mockResolvedValue(client);

    await expect(
      setCourseAvailability({
        actorUserId: "admin-1",
        courseId: "course-1",
        preset: "sales_paused",
        showInCatalog: true,
      })
    ).resolves.toEqual({
      checkoutCancellationsEnqueued: 1,
      notificationsEnqueued: 0,
      preset: "sales_paused",
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("catalog_visibility = $3"),
      expect.arrayContaining(["course-1", "active", "listed", "closed"])
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        aggregateId: "order-1",
        topic: "payments.checkout-cancel",
      }),
    });
    const auditSql = String(
      client.query.mock.calls.find(([sql]) =>
        String(sql).includes("jsonb_build_object")
      )?.[0]
    );
    expect(auditSql).toContain("'fromStatus', $3::text");
    expect(auditSql).toContain("'fromCatalogVisibility', $4::text");
    expect(auditSql).toContain("'fromSalesStatus', $5::text");
    expect(auditSql).toContain("'toPreset', $6::text");
  });

  it("opens sales and enqueues every current interest once", async () => {
    const client = createClient({
      ...ACTIVE_COURSE,
      sales_status: "closed",
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      setCourseAvailability({
        actorUserId: "admin-1",
        courseId: "course-1",
        preset: "available",
      })
    ).resolves.toEqual({
      checkoutCancellationsEnqueued: 0,
      notificationsEnqueued: 2,
      preset: "available",
    });

    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledTimes(2);
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: expect.objectContaining({
        aggregateId: "interest-1",
        topic: "email.course-sales-opened",
      }),
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("notification_enqueued_at = now()"),
      [["interest-1", "interest-2"]]
    );
  });

  it("rejects coming soon after commercial history exists", async () => {
    const client = createClient();
    dependencies.connect.mockResolvedValue(client);

    await expect(
      setCourseAvailability({
        actorUserId: "admin-1",
        courseId: "course-1",
        preset: "coming_soon",
      })
    ).rejects.toThrow(
      "Curso com histórico comercial não pode voltar para Em breve."
    );
    expect(client.query).toHaveBeenCalledWith("rollback");
  });

  it("archives and restores a published course with sales paused", async () => {
    const archiveClient = createClient();
    const restoreClient = createClient({
      ...ACTIVE_COURSE,
      catalog_visibility: "hidden",
      sales_status: "closed",
      status: "archived",
    });
    dependencies.connect
      .mockResolvedValueOnce(archiveClient)
      .mockResolvedValueOnce(restoreClient);

    await expect(
      archiveCourse({ actorUserId: "admin-1", courseId: "course-1" })
    ).resolves.toMatchObject({ preset: "archived" });
    await expect(
      restoreCourse({ actorUserId: "admin-1", courseId: "course-1" })
    ).resolves.toEqual({ preset: "sales_paused" });

    expect(restoreClient.query).toHaveBeenCalledWith(
      expect.stringContaining("catalog_visibility = $3"),
      expect.arrayContaining(["course-1", "active", "listed", "closed"])
    );
  });
});

describe("Course sale interest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates and cancels one reversible interest", async () => {
    const client = createClient({
      ...ACTIVE_COURSE,
      catalog_visibility: "listed",
      has_commercial_history: false,
      has_published_publication: false,
      sales_status: "closed",
      status: "draft",
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      setCourseSaleInterest({
        courseId: "course-1",
        interested: true,
        userId: "student-1",
      })
    ).resolves.toEqual({ interested: true });
    await expect(
      setCourseSaleInterest({
        courseId: "course-1",
        interested: false,
        userId: "student-1",
      })
    ).resolves.toEqual({ interested: false });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("notification_enqueued_at is null"),
      ["course-1", "student-1"]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("for update"),
      ["course-1"]
    );
  });
});
