import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  metrics: {
    count: vi.fn(),
    distribution: vi.fn(),
  },
  startSpan: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

import { observeOperation } from "./observe-operation";

const setEnvironmentValue = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const withProductionEnvironment = async (
  callback: () => Promise<void>
): Promise<void> => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
  };
  setEnvironmentValue("NODE_ENV", "production");
  setEnvironmentValue("VERCEL_ENV", "production");
  setEnvironmentValue("VERCEL_TARGET_ENV", undefined);

  try {
    await callback();
  } finally {
    setEnvironmentValue("NODE_ENV", previous.NODE_ENV);
    setEnvironmentValue("VERCEL_ENV", previous.VERCEL_ENV);
    setEnvironmentValue("VERCEL_TARGET_ENV", previous.VERCEL_TARGET_ENV);
  }
};

describe("observe operation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(sentry.startSpan).not.toHaveBeenCalled();
    expect(sentry.metrics.count).not.toHaveBeenCalled();
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

  it("cria span e métricas de baixa cardinalidade em Production", async () => {
    const span = {
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
    };
    sentry.startSpan.mockImplementationOnce(
      (
        _options: unknown,
        callback: (currentSpan: typeof span) => Promise<string>
      ) => callback(span)
    );

    await withProductionEnvironment(async () => {
      await expect(
        observeOperation({
          correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
          execute: async () => "done",
          now: () => 142,
          operation: "checkout.create",
          provider: "asaas",
          startedAt: 100,
          write: vi.fn(),
        })
      ).resolves.toBe("done");
    });

    expect(sentry.startSpan).toHaveBeenCalledWith(
      {
        attributes: {
          "hub.operation": "checkout.create",
          "hub.provider": "asaas",
        },
        kind: 0,
        name: "checkout.create",
        onlyIfParent: true,
        op: "hub.operation",
      },
      expect.any(Function)
    );
    expect(span.setAttribute).toHaveBeenCalledWith("hub.outcome", "success");
    expect(span.setStatus).toHaveBeenCalledWith({ code: 1 });
    expect(sentry.metrics.count).toHaveBeenCalledWith(
      "hub.operation.count",
      1,
      {
        attributes: {
          operation: "checkout.create",
          outcome: "success",
          provider: "asaas",
        },
      }
    );
    expect(sentry.metrics.distribution).toHaveBeenCalledWith(
      "hub.operation.duration",
      42,
      {
        attributes: {
          operation: "checkout.create",
          outcome: "success",
          provider: "asaas",
        },
        unit: "millisecond",
      }
    );
  });

  it("marca falha no span e nas métricas sem alterar a exceção", async () => {
    const span = {
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
    };
    const failure = new Error("provider failure");
    sentry.startSpan.mockImplementationOnce(
      (
        _options: unknown,
        callback: (currentSpan: typeof span) => Promise<never>
      ) => callback(span)
    );

    await withProductionEnvironment(async () => {
      await expect(
        observeOperation({
          correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
          execute: () => Promise.reject(failure),
          now: () => 142,
          operation: "webhook.asaas",
          provider: "asaas",
          startedAt: 100,
          write: vi.fn(),
        })
      ).rejects.toBe(failure);
    });

    expect(span.setAttribute).toHaveBeenCalledWith("hub.outcome", "failure");
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2 });
    expect(sentry.metrics.count).toHaveBeenCalledWith(
      "hub.operation.count",
      1,
      {
        attributes: {
          operation: "webhook.asaas",
          outcome: "failure",
          provider: "asaas",
        },
      }
    );
  });
});
