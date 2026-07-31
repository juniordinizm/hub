import { describe, expect, it, vi } from "vitest";
import { observeOperation } from "./observe-operation";

describe("observe operation", () => {
  it("registra sucesso com duração e correlação", async () => {
    const write = vi.fn();

    await expect(
      observeOperation({
        correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
        execute: async () => "done",
        now: () => 142,
        operation: "cron.outbox",
        startedAt: 100,
        write,
      })
    ).resolves.toBe("done");

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"durationMs":42')
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"outcome":"success"')
    );
  });

  it("registra falha sem vazar a mensagem da exceção", async () => {
    const write = vi.fn();

    await expect(
      observeOperation({
        correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
        execute: () => Promise.reject(new Error("token=secret")),
        now: () => 142,
        operation: "webhook.asaas",
        startedAt: 100,
        write,
      })
    ).rejects.toThrow("token=secret");

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"errorCode":"operation_failed"')
    );
    expect(write).toHaveBeenCalledWith(
      expect.not.stringContaining("token=secret")
    );
  });
});
