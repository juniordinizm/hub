import { createHash } from "node:crypto";
import { scanBuyerIdentityCollisions } from "../src/features/payments/identity-collision-audit";

const SUMMARY_MODE = "--summary";
const DETAILS_MODE = "--details";

const hashIdentifier = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const main = async (): Promise<void> => {
  const mode = process.argv[2];
  if (mode !== SUMMARY_MODE && mode !== DETAILS_MODE) {
    throw new Error("Use --summary ou --details.");
  }
  if (
    mode === DETAILS_MODE &&
    process.env.IDENTITY_AUDIT_CONFIRMATION !== "read-only"
  ) {
    throw new Error(
      "IDENTITY_AUDIT_CONFIRMATION=read-only é obrigatório para exibir identidades."
    );
  }

  const collisions = await scanBuyerIdentityCollisions();
  if (mode === SUMMARY_MODE) {
    process.stdout.write(
      `${JSON.stringify({
        collisionCount: collisions.length,
        groups: collisions.map((collision) => ({
          canonicalEmailHash: hashIdentifier(collision.canonicalEmail),
          userCount: collision.userIds.length,
        })),
      })}\n`
    );
    return;
  }

  process.stdout.write(`${JSON.stringify(collisions)}\n`);
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Identity audit failed."}\n`
    );
    process.exitCode = 1;
  }
}
