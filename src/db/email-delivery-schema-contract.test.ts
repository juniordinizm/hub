import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(import.meta.dirname, "migrations");
const FORBIDDEN_COLUMN_PATTERN =
  /"(?:to|from|subject|html|text|url|token|payload|headers?)"/i;

describe("0067 Resend lifecycle schema", () => {
  it("creates only lifecycle metadata without message content or recipients", async () => {
    const sql = await readFile(
      join(migrationsDirectory, "0067_sparkling_ghost_rider.sql"),
      "utf8"
    );
    expect(sql).toContain('CREATE TABLE "email_messages"');
    expect(sql).toContain('CREATE TABLE "resend_webhook_events"');
    expect(sql).toContain('"request_fingerprint" text NOT NULL');
    expect(sql).toContain('"payload_sha256" text NOT NULL');
    expect(sql).not.toMatch(FORBIDDEN_COLUMN_PATTERN);
  });

  it("keeps provider IDs unique and queue/timeline lookups indexed", async () => {
    const sql = await readFile(
      join(migrationsDirectory, "0067_sparkling_ghost_rider.sql"),
      "utf8"
    );
    expect(sql).toContain("email_messages_provider_message_id_unique");
    expect(sql).toContain("email_messages_outbox_message_id_unique");
    expect(sql).toContain("email_messages_correlation_id_unique");
    expect(sql).toContain("resend_webhook_events_provider_event_id_unique");
    expect(sql).toContain("resend_webhook_events_available_idx");
    expect(sql).toContain("resend_webhook_events_timeline_idx");
  });
});
