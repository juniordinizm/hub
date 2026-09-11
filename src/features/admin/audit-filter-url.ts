import type { AdminAuditSource, AdminAuditTargetType } from "./audit-filters";

export const getAuditFilterHref = ({
  from,
  page = 1,
  search,
  source,
  targetType,
  to,
}: {
  from: string;
  page?: number;
  search: string;
  source: AdminAuditSource;
  targetType: AdminAuditTargetType;
  to: string;
}): string => {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("page", String(page));
  }
  if (search) {
    params.set("q", search);
  }
  if (source !== "all") {
    params.set("source", source);
  }
  if (targetType !== "all") {
    params.set("target", targetType);
  }
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }
  const query = params.toString();
  return query ? `/admin/auditoria?${query}` : "/admin/auditoria";
};
