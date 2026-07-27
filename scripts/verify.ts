import { spawnSync } from "node:child_process";
import {
  getVerificationEnvironmentOverrides,
  runVerificationProfile,
  type VerificationGate,
  type VerificationProfile,
} from "../src/tooling/verification-profiles";

const isVerificationProfile = (value: string): value is VerificationProfile =>
  value === "quick" || value === "full";

const profile = process.argv[2];
if (!(profile && isVerificationProfile(profile))) {
  throw new Error("Usage: bun scripts/verify.ts <quick|full>");
}

const executeGate = (gate: VerificationGate): number => {
  process.stdout.write(`\n==> bun run ${gate}\n\n`);
  const result = spawnSync(process.execPath, ["run", gate], {
    env: {
      ...process.env,
      ...getVerificationEnvironmentOverrides(gate),
    },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
};

process.exitCode = runVerificationProfile(profile, executeGate);
