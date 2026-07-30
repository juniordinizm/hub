import { describe, expect, it, vi } from "vitest";
import { AsaasGatewayError } from "./asaas-client";
import { runCoordinatedAsaasQuery } from "./asaas-query-policy";

describe("Asaas query policy", () => {
  it("retries rate limiting with Retry-After before returning", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new AsaasGatewayError({
          httpStatus: 429,
          kind: "rate_limited",
          message: "rate limited",
          outcome: "rejected",
          retryAfterMs: 1250,
          retryable: true,
        })
      )
      .mockResolvedValue("ok");
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(runCoordinatedAsaasQuery({ operation, wait })).resolves.toBe(
      "ok"
    );
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1250);
  });

  it("does not retry non-rate-limit failures", async () => {
    const error = new AsaasGatewayError({
      kind: "provider_unavailable",
      message: "unavailable",
      outcome: "rejected",
      retryable: true,
    });
    const operation = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(runCoordinatedAsaasQuery({ operation, wait })).rejects.toBe(
      error
    );
    expect(operation).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("serializes concurrent query operations", async () => {
    const execution: string[] = [];
    let releaseFirst = (): void => undefined;
    let markStarted = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const first = runCoordinatedAsaasQuery({
      operation: async () => {
        execution.push("first:start");
        markStarted();
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        execution.push("first:end");
      },
    });
    const second = runCoordinatedAsaasQuery({
      operation: () => {
        execution.push("second");
        return Promise.resolve();
      },
    });

    await started;
    expect(execution).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(execution).toEqual(["first:start", "first:end", "second"]);
  });
});
