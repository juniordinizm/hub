import "server-only";

import { createHash } from "node:crypto";
import type { ContentReleaseScheduleSnapshot } from "./module-content-release";

export const CONTENT_RELEASE_SCHEDULE_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export const getContentReleaseScheduleDigest = (
  snapshot: ContentReleaseScheduleSnapshot
): string =>
  createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
