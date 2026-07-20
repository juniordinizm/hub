import { getPool } from "@/db";
import { seedE2e } from "../../scripts/seed-e2e";

export default async function globalSetup(): Promise<void> {
  await seedE2e();
  await getPool().end();
}
