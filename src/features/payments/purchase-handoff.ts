import "server-only";
import { getPool } from "@/db";
import { assertCheckoutAvailable } from "@/features/payments/checkout-availability";
import { getServerEnv } from "@/lib/env";
import type { AppSession } from "@/lib/session";

export type PurchaseHandoffView =
  | {
      courseId: string;
      courseSlug: string;
      courseTitle: string;
      kind: "checkout";
    }
  | {
      courseId: string;
      courseTitle: string;
      href: string;
      kind: "access";
    }
  | {
      kind: "blocked";
      reason: "account_blocked" | "course_revoked" | "team_account";
    }
  | {
      acceptsInterest: true;
      courseId: string;
      courseTitle: string;
      isInterested: boolean;
      kind: "sales_closed";
    }
  | {
      acceptsInterest: true;
      courseId: string;
      courseTitle: string;
      isInterested: boolean;
      kind: "coming_soon";
      launchDate: string | null;
    }
  | {
      href: string;
      kind: "external_redirect";
    }
  | {
      kind: "unavailable";
      reason: "checkout_disabled" | "course_unavailable";
    };

interface PurchaseHandoffRow {
  catalog_visibility: "hidden" | "listed";
  course_id: string;
  course_slug: string;
  course_title: string;
  enrollment_status: "active" | "expired" | "revoked" | null;
  has_effective_access: boolean;
  has_published_publication: boolean;
  is_interested: boolean;
  launch_date: string | null;
  launch_landing_url: string | null;
  price_in_cents: number;
  sales_status: "closed" | "open";
  status: "active" | "archived" | "draft";
}

const PURCHASE_HANDOFF_QUERY = `
  select c.id as course_id,
    c.slug as course_slug,
    c.title as course_title,
    c.status,
    c.catalog_visibility,
    c.sales_status,
    c.launch_date,
    c.launch_landing_url,
    c.price_in_cents,
    exists (
      select 1
      from course_publications cp
      where cp.course_id = c.id
        and cp.status = 'published'
    ) as has_published_publication,
    e.status as enrollment_status,
    case
      when e.status = 'active'
       and e.starts_at <= now()
       and (e.expires_at is null or e.expires_at >= now())
      then true
      else false
    end as has_effective_access
    ,exists (
      select 1
      from course_sale_interests csi
      where csi.course_id = c.id and csi.user_id = $2
    ) as is_interested
  from courses c
  left join enrollments e
    on e.course_id = c.id
   and e.user_id = $2
  where c.slug = $1
  limit 1
`;

export const getPurchaseHandoffView = async ({
  session,
  slug,
}: {
  session: AppSession | null;
  slug: string;
}): Promise<PurchaseHandoffView> => {
  const { rows } = await getPool().query<PurchaseHandoffRow>(
    PURCHASE_HANDOFF_QUERY,
    [slug, session?.user.id ?? null]
  );
  const course = rows[0];

  if (!course || course.status === "archived") {
    return { kind: "unavailable", reason: "course_unavailable" };
  }

  if (session?.role === "admin" || session?.role === "support") {
    return { kind: "blocked", reason: "team_account" };
  }

  if (session?.platformBlockedAt) {
    return { kind: "blocked", reason: "account_blocked" };
  }

  if (course.enrollment_status === "revoked") {
    return { kind: "blocked", reason: "course_revoked" };
  }

  if (session && course.has_effective_access) {
    return {
      courseId: course.course_id,
      courseTitle: course.course_title,
      href: `/app/cursos/${course.course_id}`,
      kind: "access",
    };
  }

  if (
    course.status === "draft" &&
    course.catalog_visibility === "listed" &&
    course.sales_status === "closed"
  ) {
    if (course.launch_landing_url) {
      return { href: course.launch_landing_url, kind: "external_redirect" };
    }
    return {
      acceptsInterest: true,
      courseId: course.course_id,
      courseTitle: course.course_title,
      isInterested: course.is_interested,
      kind: "coming_soon",
      launchDate: course.launch_date,
    };
  }

  if (course.status === "active" && course.sales_status === "closed") {
    if (course.launch_landing_url) {
      return { href: course.launch_landing_url, kind: "external_redirect" };
    }
    return {
      acceptsInterest: true,
      courseId: course.course_id,
      courseTitle: course.course_title,
      isInterested: course.is_interested,
      kind: "sales_closed",
    };
  }

  if (
    course.status !== "active" ||
    course.sales_status !== "open" ||
    course.price_in_cents <= 0 ||
    !course.has_published_publication
  ) {
    return { kind: "unavailable", reason: "course_unavailable" };
  }

  try {
    assertCheckoutAvailable({
      entry: "public",
      mode: getServerEnv().PAYMENTS_CHECKOUT_MODE,
    });
  } catch {
    return { kind: "unavailable", reason: "checkout_disabled" };
  }

  return {
    courseId: course.course_id,
    courseSlug: course.course_slug,
    courseTitle: course.course_title,
    kind: "checkout",
  };
};
