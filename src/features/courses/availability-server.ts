import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  createCheckoutCancellationMessage,
  createCourseSalesOpenedMessage,
} from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import { ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS } from "@/features/payments/asaas";
import { getServerEnv } from "@/lib/env";
import {
  type CourseAvailabilityPreset,
  type CourseCatalogVisibility,
  type CourseDeliveryStatus,
  type CourseSalesStatus,
  parseCourseLaunchLandingUrl,
  resolveCourseAvailability,
} from "./availability";
import { assertMaxReleaseDelayFitsAccessDuration } from "./module-content-release";

interface LockedCourseAvailabilityRow {
  access_duration_months: number;
  catalog_visibility: CourseCatalogVisibility;
  has_commercial_history: boolean;
  has_published_publication: boolean;
  id: string;
  max_release_delay_days: number;
  payment_allow_credit_card: boolean;
  payment_allow_pix: boolean;
  price_in_cents: number;
  sales_status: CourseSalesStatus;
  slug: string;
  status: CourseDeliveryStatus;
}

interface AvailabilityTarget {
  catalogVisibility: CourseCatalogVisibility;
  deliveryStatus: CourseDeliveryStatus;
  launchDate: string | null;
  launchLandingUrl: string | null;
  preset: CourseAvailabilityPreset | "archived";
  salesStatus: CourseSalesStatus;
}

interface AvailabilityCommandResult {
  checkoutCancellationsEnqueued: number;
  notificationsEnqueued: number;
  preset: CourseAvailabilityPreset | "archived";
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const readLockedCourse = async (
  client: PoolClient,
  courseId: string
): Promise<LockedCourseAvailabilityRow> => {
  const result = await client.query<LockedCourseAvailabilityRow>(
    `
      select c.id,
             c.slug,
             c.status,
             c.catalog_visibility,
             c.sales_status,
             c.access_duration_months,
             c.price_in_cents,
             c.payment_allow_pix,
             c.payment_allow_credit_card,
             exists (
               select 1 from course_publications cp
               where cp.course_id = c.id and cp.status = 'published'
             ) as has_published_publication,
             coalesce((
               select max(m.release_delay_days)
               from modules m
               join course_publications cp on cp.id = m.course_publication_id
               where cp.course_id = c.id
                 and cp.status = 'published'
                 and m.status = 'active'
             ), 0)::int as max_release_delay_days,
             (
               exists (
                 select 1 from orders o
                 where o.course_id = c.id and o.status = 'paid'
               ) or exists (
                 select 1 from enrollment_grants eg where eg.course_id = c.id
               ) or exists (
                 select 1 from enrollments e where e.course_id = c.id
               )
             ) as has_commercial_history
      from courses c
      where c.id = $1
      limit 1
      for update
    `,
    [courseId]
  );
  const course = result.rows[0];
  if (!course) {
    throw new Error("Curso não encontrado.");
  }
  return course;
};

const parseLaunchDate = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error("Data de lançamento inválida.");
  }
  return normalized;
};

const getTarget = ({
  course,
  launchDate,
  launchLandingUrl,
  preset,
  showInCatalog,
}: {
  course: LockedCourseAvailabilityRow;
  launchDate?: string | null;
  launchLandingUrl?: string | null;
  preset: CourseAvailabilityPreset;
  showInCatalog?: boolean;
}): AvailabilityTarget => {
  if (preset === "draft") {
    return {
      catalogVisibility: "hidden",
      deliveryStatus: "draft",
      launchDate: null,
      launchLandingUrl: null,
      preset,
      salesStatus: "closed",
    };
  }

  if (preset === "coming_soon") {
    const landingUrl = parseCourseLaunchLandingUrl({
      applicationUrl: getServerEnv().NEXT_PUBLIC_APP_URL,
      courseSlug: course.slug,
      landingUrl: launchLandingUrl ?? "",
    });
    return {
      catalogVisibility: "listed",
      deliveryStatus: "draft",
      launchDate: parseLaunchDate(launchDate),
      launchLandingUrl: landingUrl,
      preset,
      salesStatus: "closed",
    };
  }

  if (preset === "available") {
    return {
      catalogVisibility: "listed",
      deliveryStatus: "active",
      launchDate: null,
      launchLandingUrl: null,
      preset,
      salesStatus: "open",
    };
  }

  return {
    catalogVisibility: showInCatalog === false ? "hidden" : "listed",
    deliveryStatus: "active",
    launchDate: null,
    launchLandingUrl: parseCourseLaunchLandingUrl({
      applicationUrl: getServerEnv().NEXT_PUBLIC_APP_URL,
      courseSlug: course.slug,
      landingUrl: launchLandingUrl ?? "",
    }),
    preset,
    salesStatus: "closed",
  };
};

const validateTarget = ({
  course,
  target,
}: {
  course: LockedCourseAvailabilityRow;
  target: AvailabilityTarget;
}): void => {
  resolveCourseAvailability({
    catalogVisibility: target.catalogVisibility,
    deliveryStatus: target.deliveryStatus,
    salesStatus: target.salesStatus,
  });

  if (
    (target.preset === "coming_soon" || target.preset === "draft") &&
    course.has_commercial_history
  ) {
    throw new Error(
      target.preset === "coming_soon"
        ? "Curso com histórico comercial não pode voltar para Em breve."
        : "Curso com histórico comercial não pode voltar para Rascunho."
    );
  }

  if (
    (target.preset === "available" || target.preset === "sales_paused") &&
    !course.has_published_publication
  ) {
    throw new Error("Publique o conteúdo antes de alterar a disponibilidade.");
  }

  if (
    target.preset === "available" &&
    (course.price_in_cents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS ||
      !(course.payment_allow_pix || course.payment_allow_credit_card))
  ) {
    throw new Error(
      "Configure uma oferta comercial válida antes de abrir vendas."
    );
  }

  if (target.preset === "available") {
    assertMaxReleaseDelayFitsAccessDuration({
      accessDurationMonths: course.access_duration_months,
      maxReleaseDelayDays: course.max_release_delay_days,
    });
  }
};

const persistTarget = async ({
  actorUserId,
  client,
  course,
  target,
}: {
  actorUserId: string;
  client: PoolClient;
  course: LockedCourseAvailabilityRow;
  target: AvailabilityTarget;
}): Promise<void> => {
  await client.query(
    `
      update courses
      set status = $2,
          catalog_visibility = $3,
          sales_status = $4,
          launch_date = $5,
          launch_landing_url = $6,
          updated_at = now()
      where id = $1
    `,
    [
      course.id,
      target.deliveryStatus,
      target.catalogVisibility,
      target.salesStatus,
      target.launchDate,
      target.launchLandingUrl,
    ]
  );
  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
      values (
        $1,
        'course.availability_changed',
        'course',
        $2,
        jsonb_build_object(
          'fromStatus', $3::text,
          'fromCatalogVisibility', $4::text,
          'fromSalesStatus', $5::text,
          'toPreset', $6::text
        )
      )
    `,
    [
      actorUserId,
      course.id,
      course.status,
      course.catalog_visibility,
      course.sales_status,
      target.preset,
    ]
  );
};

const enqueueCheckoutCancellations = async ({
  client,
  courseId,
}: {
  client: PoolClient;
  courseId: string;
}): Promise<number> => {
  const result = await client.query<{ id: string }>(
    `
      select o.id
      from orders o
      where o.course_id = $1
        and o.status = 'pending'
        and o.checkout_status = 'active'
        and o.provider = 'asaas'
        and o.provider_checkout_id is not null
      for update
    `,
    [courseId]
  );
  for (const order of result.rows) {
    await enqueueOutboxMessage({
      client,
      message: createCheckoutCancellationMessage({ orderId: order.id }),
    });
  }
  return result.rows.length;
};

const enqueueInterestNotifications = async ({
  client,
  courseId,
}: {
  client: PoolClient;
  courseId: string;
}): Promise<number> => {
  const result = await client.query<{ id: string }>(
    `
      select id
      from course_sale_interests
      where course_id = $1 and notification_enqueued_at is null
      for update
    `,
    [courseId]
  );
  const interestIds = result.rows.map((interest) => interest.id);
  for (const interestId of interestIds) {
    await enqueueOutboxMessage({
      client,
      message: createCourseSalesOpenedMessage({ interestId }),
    });
  }
  if (interestIds.length > 0) {
    await client.query(
      `
        update course_sale_interests
        set notification_enqueued_at = now(), updated_at = now()
        where id = any($1::uuid[]) and notification_enqueued_at is null
      `,
      [interestIds]
    );
    await client.query(
      `
        update outbox_messages
        set available_at = now(), updated_at = now()
        where topic = 'email.course-sales-opened'
          and status in ('pending', 'retrying')
          and (payload ->> 'interestId') = any($1::text[])
      `,
      [interestIds]
    );
  }
  return interestIds.length;
};

const applyTarget = async ({
  actorUserId,
  client,
  course,
  target,
}: {
  actorUserId: string;
  client: PoolClient;
  course: LockedCourseAvailabilityRow;
  target: AvailabilityTarget;
}): Promise<AvailabilityCommandResult> => {
  validateTarget({ course, target });
  await persistTarget({ actorUserId, client, course, target });
  const isClosingSales =
    course.sales_status === "open" && target.salesStatus === "closed";
  const isOpeningSales =
    course.sales_status === "closed" && target.salesStatus === "open";
  const checkoutCancellationsEnqueued = isClosingSales
    ? await enqueueCheckoutCancellations({ client, courseId: course.id })
    : 0;
  const notificationsEnqueued = isOpeningSales
    ? await enqueueInterestNotifications({ client, courseId: course.id })
    : 0;
  return {
    checkoutCancellationsEnqueued,
    notificationsEnqueued,
    preset: target.preset,
  };
};

const runAvailabilityTransaction = async (
  operation: (client: PoolClient) => Promise<AvailabilityCommandResult>
): Promise<AvailabilityCommandResult> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const setCourseAvailability = async ({
  actorUserId,
  courseId,
  launchDate,
  launchLandingUrl,
  preset,
  showInCatalog,
}: {
  actorUserId: string;
  courseId: string;
  launchDate?: string | null;
  launchLandingUrl?: string | null;
  preset: CourseAvailabilityPreset;
  showInCatalog?: boolean;
}): Promise<AvailabilityCommandResult> =>
  runAvailabilityTransaction(async (client) => {
    const course = await readLockedCourse(client, courseId);
    const target = getTarget({
      course,
      preset,
      ...(launchDate === undefined ? {} : { launchDate }),
      ...(launchLandingUrl === undefined ? {} : { launchLandingUrl }),
      ...(showInCatalog === undefined ? {} : { showInCatalog }),
    });
    return await applyTarget({ actorUserId, client, course, target });
  });

export const archiveCourse = async ({
  actorUserId,
  courseId,
}: {
  actorUserId: string;
  courseId: string;
}): Promise<AvailabilityCommandResult> =>
  runAvailabilityTransaction(async (client) => {
    const course = await readLockedCourse(client, courseId);
    const target: AvailabilityTarget = {
      catalogVisibility: "hidden",
      deliveryStatus: "archived",
      launchDate: null,
      launchLandingUrl: null,
      preset: "archived",
      salesStatus: "closed",
    };
    return await applyTarget({ actorUserId, client, course, target });
  });

export const restoreCourse = async ({
  actorUserId,
  courseId,
}: {
  actorUserId: string;
  courseId: string;
}): Promise<{ preset: "draft" | "sales_paused" }> =>
  runAvailabilityTransaction(async (client) => {
    const course = await readLockedCourse(client, courseId);
    if (course.status !== "archived") {
      throw new Error("Somente Curso arquivado pode ser restaurado.");
    }
    const preset = course.has_published_publication ? "sales_paused" : "draft";
    const target = getTarget({ course, preset, showInCatalog: true });
    return await applyTarget({ actorUserId, client, course, target });
  }).then(({ preset }) => ({
    preset: preset === "sales_paused" ? "sales_paused" : "draft",
  }));

export const setCourseSaleInterest = async ({
  courseId,
  interested,
  userId,
}: {
  courseId: string;
  interested: boolean;
  userId: string;
}): Promise<{ interested: boolean }> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const course = await readLockedCourse(client, courseId);
    if (!interested) {
      await client.query(
        `
          delete from course_sale_interests
          where course_id = $1
            and user_id = $2
            and notification_enqueued_at is null
          returning id
        `,
        [courseId, userId]
      );
      await client.query("commit");
      return { interested: false };
    }

    const availability = resolveCourseAvailability({
      catalogVisibility: course.catalog_visibility,
      deliveryStatus: course.status,
      salesStatus: course.sales_status,
    });
    if (!availability.acceptsInterest) {
      throw new Error("Este Curso não está aceitando interesse.");
    }
    await client.query(
      `
        insert into course_sale_interests (course_id, user_id)
        values ($1, $2)
        on conflict (course_id, user_id) do nothing
        returning id
      `,
      [courseId, userId]
    );
    await client.query("commit");
    return { interested: true };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
