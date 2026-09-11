import type { AdminAuditSource } from "./audit-filters";

export type AuditMetadataValue =
  | boolean
  | null
  | number
  | string
  | AuditMetadataValue[]
  | { [key: string]: AuditMetadataValue };

export interface AuditChange {
  after: AuditMetadataValue;
  before: AuditMetadataValue;
}

export interface AuditMetadata {
  changes?: Record<string, AuditChange>;
  correlationId?: string;
  reason?: string | null;
  targetLabelAfter?: string | null;
  targetLabelBefore?: string | null;
  [key: string]: AuditMetadataValue | Record<string, AuditChange> | undefined;
}

export interface AdminAuditLog {
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  createdAt: Date;
  id: string;
  metadata: AuditMetadata;
  source: Exclude<AdminAuditSource, "all">;
  targetId: string | null;
  targetName: string | null;
  targetType: string;
}
