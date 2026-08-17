import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  courseCatalogVisibilityEnum,
  courseSaleInterests,
  courseSalesStatusEnum,
  courses,
} from "./schema";

const columnNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map((column) => column.name);

const checkNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).checks.map((tableCheck) => tableCheck.name);

const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((tableIndex) => tableIndex.config.name);
const DESTRUCTIVE_AVAILABILITY_DELETE_PATTERN =
  /delete\s+from\s+(courses|orders|enrollments)/i;

describe("Course availability persistence contract", () => {
  it("separates catalog visibility and sales state from delivery", () => {
    expect(courseCatalogVisibilityEnum.enumValues).toEqual([
      "listed",
      "hidden",
    ]);
    expect(courseSalesStatusEnum.enumValues).toEqual(["open", "closed"]);
    expect(columnNames(courses)).toEqual(
      expect.arrayContaining([
        "catalog_visibility",
        "sales_status",
        "launch_date",
        "launch_landing_url",
        "interest_notifications_sent",
      ])
    );
    expect(checkNames(courses)).toEqual(
      expect.arrayContaining([
        "courses_availability_combination_valid",
        "courses_interest_notifications_sent_non_negative",
        "courses_launch_fields_only_for_coming_soon",
      ])
    );
  });

  it("stores only local identities for reversible sale interest", () => {
    expect(columnNames(courseSaleInterests)).toEqual([
      "id",
      "course_id",
      "user_id",
      "notification_enqueued_at",
      "created_at",
      "updated_at",
    ]);
    expect(indexNames(courseSaleInterests)).toEqual(
      expect.arrayContaining([
        "course_sale_interests_course_user_unique_idx",
        "course_sale_interests_notification_idx",
      ])
    );
  });

  it("backfills existing courses without changing their behavior", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0060_course_availability_and_interest.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      "WHEN status = 'active' THEN 'listed'::course_catalog_visibility"
    );
    expect(migration).toContain(
      "WHEN status = 'active' THEN 'open'::course_sales_status"
    );
    expect(migration).not.toMatch(DESTRUCTIVE_AVAILABILITY_DELETE_PATTERN);
  });

  it("allows a paused course to keep an optional visitor landing", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0061_paused_course_landing_url.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("courses_launch_fields_only_for_coming_soon");
    expect(migration).toContain('"courses"."sales_status" = \'closed\'');
    expect(migration).toContain('"courses"."status" = \'active\'');
  });
});
