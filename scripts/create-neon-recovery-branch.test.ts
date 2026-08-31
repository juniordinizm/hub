import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createNeonRecoveryBranch,
  writeNeonRecoveryBranchOutputs,
} from "./create-neon-recovery-branch";

const validOptions = {
  apiKey: "neon-secret",
  branchName: "production-release-123-1",
  expiresAt: "2026-09-14T12:00:00.000Z",
  now: () => new Date("2026-08-31T12:00:00.000Z"),
  parentBranchId: "br-production",
  projectId: "project-production",
};

describe("createNeonRecoveryBranch", () => {
  it("creates an expiring branch without provisioning a compute endpoint", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            branch: {
              current_state: "creating",
              expires_at: validOptions.expiresAt,
              id: "br-recovery",
              name: validOptions.branchName,
              parent_id: validOptions.parentBranchId,
              project_id: validOptions.projectId,
            },
          }),
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            branch: {
              current_state: "ready",
              expires_at: validOptions.expiresAt,
              id: "br-recovery",
              name: validOptions.branchName,
              parent_id: validOptions.parentBranchId,
              project_id: validOptions.projectId,
            },
          }),
          { status: 200 }
        )
      );

    await expect(
      createNeonRecoveryBranch({
        ...validOptions,
        fetchImpl,
        sleep: vi.fn().mockResolvedValue(undefined),
      })
    ).resolves.toEqual({
      branchId: "br-recovery",
      branchName: validOptions.branchName,
      expiresAt: validOptions.expiresAt,
      parentBranchId: validOptions.parentBranchId,
      projectId: validOptions.projectId,
    });

    const createRequest = fetchImpl.mock.calls[0];
    expect(createRequest?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(createRequest?.[1]?.body))).toEqual({
      branch: {
        expires_at: validOptions.expiresAt,
        name: validOptions.branchName,
        parent_id: validOptions.parentBranchId,
      },
    });
    expect(JSON.parse(String(createRequest?.[1]?.body))).not.toHaveProperty(
      "endpoints"
    );
  });

  it("rejects missing or expired recovery-branch inputs before calling Neon", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      createNeonRecoveryBranch({
        ...validOptions,
        branchName: "",
        fetchImpl,
      })
    ).rejects.toThrow("branchName is required");
    await expect(
      createNeonRecoveryBranch({
        ...validOptions,
        expiresAt: "2026-08-30T12:00:00.000Z",
        fetchImpl,
      })
    ).rejects.toThrow("expiresAt must be in the future");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when the returned branch belongs to another parent", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          branch: {
            current_state: "ready",
            expires_at: validOptions.expiresAt,
            id: "br-recovery",
            name: validOptions.branchName,
            parent_id: "br-unexpected",
            project_id: validOptions.projectId,
          },
        }),
        { status: 201 }
      )
    );

    await expect(
      createNeonRecoveryBranch({
        ...validOptions,
        fetchImpl,
      })
    ).rejects.toThrow("parent branch does not match");
  });

  it("bounds Neon API error diagnostics", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("x".repeat(1000), { status: 500 }));

    await expect(
      createNeonRecoveryBranch({
        ...validOptions,
        fetchImpl,
      })
    ).rejects.toThrow("Neon API branch creation failed with HTTP 500");
  });

  it("writes only safe branch metadata to GitHub outputs", () => {
    const outputPath = join(
      mkdtempSync(join(tmpdir(), "hub-neon-output-")),
      "output"
    );

    writeNeonRecoveryBranchOutputs(
      {
        branchId: "br-recovery",
        branchName: validOptions.branchName,
        expiresAt: validOptions.expiresAt,
        parentBranchId: validOptions.parentBranchId,
        projectId: validOptions.projectId,
      },
      outputPath
    );

    expect(readFileSync(outputPath, "utf8")).toBe(
      `branch_id=br-recovery\nbranch_name=${validOptions.branchName}\nexpires_at=${validOptions.expiresAt}\n`
    );
  });
});
