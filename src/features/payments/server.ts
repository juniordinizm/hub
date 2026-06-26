import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { sendAccessReleasedEmail } from "@/features/email/server";
import {
  applyPaidWebhookAccess,
  applyPaymentRevocation,
} from "@/features/enrollments/server";
import {
  type AbacatePayOrderPayload,
  type AbacatePayOrderTransition,
  buildAbacatePayCheckoutRequest,
  buildAbacatePayProductRequest,
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  getAbacatePayOrderTransition,
  mapAbacatePayEventToOrderStatus,
  type PersistedOrderStatus,
} from "@/features/payments/abacatepay";
import { AbacatePayClient } from "@/features/payments/abacatepay-client";
import { getServerEnv } from "@/lib/env";

interface WebhookResult {
  eventKey: string;
  status: "processed" | "ignored" | "duplicate";
}

interface CreatedCourseProduct {
  productId: string;
}

interface CourseCheckoutResult {
  redirectUrl: string;
}

interface WebhookCourse {
  access_duration_months: number;
  id: string;
  payment_provider_product_id: string | null;
  title: string;
}

const getAbacatePayClient = (): AbacatePayClient => {
  const env = getServerEnv();
  const apiKey = env.ABACATE_PAY_API_KEY ?? env.ABACATEPAY_API_KEY;

  if (!apiKey) {
    throw new Error("Configure ABACATE_PAY_API_KEY para usar o AbacatePay.");
  }

  return new AbacatePayClient({
    apiKey,
    baseUrl: env.ABACATEPAY_API_BASE_URL,
  });
};

const appUrl = (path: string): string =>
  new URL(path, getServerEnv().NEXT_PUBLIC_APP_URL).toString();

const notifyAccessReleased = async (
  payload: {
    courseTitle: string;
    to: string;
    userName: string;
  } | null
): Promise<void> => {
  if (!payload) {
    return;
  }

  try {
    await sendAccessReleasedEmail(payload);
  } catch {
    // E-mail failure must not block paid webhook processing.
  }
};

const resolveWebhookUserId = async ({
  client,
  customerEmail,
  customerName,
  metadataUserId,
}: {
  client: PoolClient;
  customerEmail: string;
  customerName: string;
  metadataUserId: string | null;
}): Promise<string> => {
  if (metadataUserId) {
    const existingUser = await client.query<{ id: string }>(
      `
        select id
        from users
        where id = $1
        limit 1
      `,
      [metadataUserId]
    );

    if (!existingUser.rows[0]) {
      throw new Error("Usuario do checkout nao foi localizado.");
    }

    return metadataUserId;
  }

  const userResult = await client.query<{ id: string }>(
    `
      insert into users (id, name, email, email_verified)
      values ($1, $2, $3, true)
      on conflict (email) do update set name = excluded.name
      returning id
    `,
    [randomUUID(), customerName, customerEmail]
  );
  const userId = userResult.rows[0]?.id;

  if (!userId) {
    throw new Error("Nao foi possivel criar ou localizar a aluna.");
  }

  return userId;
};

const resolveWebhookCourse = async ({
  client,
  metadataCourseId,
  providerProductId,
  warnings,
}: {
  client: PoolClient;
  metadataCourseId: string | null;
  providerProductId: string | null;
  warnings: string[];
}): Promise<WebhookCourse> => {
  if (metadataCourseId) {
    const courseResult = await client.query<{
      access_duration_months: number;
      id: string;
      payment_provider_product_id: string | null;
      title: string;
    }>(
      `
        select id, title, access_duration_months, payment_provider_product_id
        from courses
        where id = $1
        limit 1
      `,
      [metadataCourseId]
    );
    const course = courseResult.rows[0];

    if (!course) {
      throw new Error("Curso informado no checkout nao foi localizado.");
    }

    if (
      providerProductId &&
      course.payment_provider_product_id !== providerProductId
    ) {
      throw new Error(
        "Produto AbacatePay nao confere com o curso informado no checkout."
      );
    }

    if (!providerProductId) {
      warnings.push(
        "Webhook AbacatePay sem item de produto; curso resolvido pela metadata."
      );
    }

    return course;
  }

  if (!providerProductId) {
    throw new Error("Webhook AbacatePay sem produto mapeavel.");
  }

  warnings.push(
    "Webhook AbacatePay sem metadata.courseId; curso resolvido pelo produto."
  );

  const courseResult = await client.query<{
    title: string;
    id: string;
    access_duration_months: number;
    payment_provider_product_id: string | null;
  }>(
    `
      select id, title, access_duration_months, payment_provider_product_id
      from courses
      where payment_provider_product_id = $1
      limit 1
    `,
    [providerProductId]
  );
  const course = courseResult.rows[0];

  if (!course) {
    throw new Error("Produto AbacatePay nao esta mapeado para nenhum curso.");
  }

  return course;
};

const getWebhookTransition = async ({
  client,
  incomingOrderStatus,
  providerOrderId,
}: {
  client: PoolClient;
  incomingOrderStatus: PersistedOrderStatus;
  providerOrderId: string;
}): Promise<AbacatePayOrderTransition> => {
  const existingOrder = await client.query<{
    status: PersistedOrderStatus;
  }>(
    `
      select status
      from orders
      where provider = 'abacatepay'
        and provider_order_id = $1
      limit 1
    `,
    [providerOrderId]
  );
  return getAbacatePayOrderTransition({
    currentStatus: existingOrder.rows[0]?.status ?? null,
    incomingStatus: incomingOrderStatus,
  });
};

const upsertWebhookOrder = async ({
  accessDurationMonths,
  client,
  courseId,
  finalOrderStatus,
  now,
  orderPayload,
  shouldApplyPaidAccess,
  shouldApplyRefundRevocation,
  userId,
}: {
  accessDurationMonths: number;
  client: PoolClient;
  courseId: string;
  finalOrderStatus: PersistedOrderStatus;
  now: Date;
  orderPayload: AbacatePayOrderPayload;
  shouldApplyPaidAccess: boolean;
  shouldApplyRefundRevocation: boolean;
  userId: string;
}): Promise<{ accessDurationMonths: number; orderId: string }> => {
  const result = await client.query<{
    access_duration_months: number | null;
    id: string;
  }>(
    `
      insert into orders (
        course_id,
        user_id,
        provider_order_id,
        external_id,
        status,
        amount_in_cents,
        paid_amount_in_cents,
        payment_method,
        receipt_url,
        paid_at,
        refunded_at,
        customer_email,
        customer_name,
        access_duration_months
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      on conflict (provider, provider_order_id) do update set
        user_id = excluded.user_id,
        status = excluded.status,
        amount_in_cents = excluded.amount_in_cents,
        paid_amount_in_cents = excluded.paid_amount_in_cents,
        payment_method = excluded.payment_method,
        receipt_url = excluded.receipt_url,
        paid_at = coalesce(orders.paid_at, excluded.paid_at),
        refunded_at = coalesce(excluded.refunded_at, orders.refunded_at),
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
        access_duration_months = coalesce(
          orders.access_duration_months,
          excluded.access_duration_months
        ),
        updated_at = now()
      returning id, access_duration_months
    `,
    [
      courseId,
      userId,
      orderPayload.providerOrderId,
      orderPayload.externalId,
      finalOrderStatus,
      orderPayload.amountInCents,
      orderPayload.paidAmountInCents,
      orderPayload.paymentMethod,
      orderPayload.receiptUrl,
      shouldApplyPaidAccess ? now : null,
      shouldApplyRefundRevocation ? now : null,
      orderPayload.customerEmail,
      orderPayload.customerName,
      accessDurationMonths,
    ]
  );

  const order = result.rows[0];

  if (!order) {
    throw new Error("Nao foi possivel registrar o pedido AbacatePay.");
  }

  return {
    accessDurationMonths: order.access_duration_months ?? accessDurationMonths,
    orderId: order.id,
  };
};

const applyWebhookEnrollmentTransition = async ({
  accessDurationMonths,
  client,
  course,
  now,
  orderPayload,
  shouldApplyDisputeRevocation,
  shouldApplyPaidAccess,
  shouldApplyRefundRevocation,
  userId,
}: {
  accessDurationMonths: number;
  client: PoolClient;
  course: WebhookCourse;
  now: Date;
  orderPayload: AbacatePayOrderPayload;
  shouldApplyDisputeRevocation: boolean;
  shouldApplyPaidAccess: boolean;
  shouldApplyRefundRevocation: boolean;
  userId: string;
}): Promise<{
  courseTitle: string;
  to: string;
  userName: string;
} | null> => {
  const order = await client.query<{ id: string }>(
    `
      select id
      from orders
      where provider = 'abacatepay'
        and provider_order_id = $1
      limit 1
    `,
    [orderPayload.providerOrderId]
  );
  const orderId = order.rows[0]?.id;

  if (!orderId) {
    throw new Error("Pedido AbacatePay nao foi localizado.");
  }

  if (shouldApplyPaidAccess) {
    await applyPaidWebhookAccess({
      accessDurationMonths,
      client,
      courseId: course.id,
      now,
      orderId,
      userId,
    });

    return {
      courseTitle: course.title,
      to: orderPayload.customerEmail,
      userName: orderPayload.customerName,
    };
  }

  if (shouldApplyRefundRevocation || shouldApplyDisputeRevocation) {
    await applyPaymentRevocation({
      client,
      courseId: course.id,
      now,
      orderId,
      reason: shouldApplyDisputeRevocation
        ? "abacatepay_dispute"
        : "abacatepay_refund",
      userId,
    });
  }

  return null;
};

export const createAbacatePayCourseProduct = async (
  input: Parameters<typeof buildAbacatePayProductRequest>[0]
): Promise<CreatedCourseProduct> => {
  const request = buildAbacatePayProductRequest(input);
  const product = await getAbacatePayClient().createProduct(request);

  return { productId: product.id };
};

export const createCourseCheckout = async ({
  courseId,
  user,
}: {
  courseId: string;
  user: {
    email: string;
    id: string;
    name: string;
  };
}): Promise<CourseCheckoutResult> => {
  const { rows } = await getPool().query<{
    access_duration_months: number;
    id: string;
    payment_provider_product_id: string | null;
    price_in_cents: number;
    status: string;
  }>(
    `
      select id, payment_provider_product_id, price_in_cents, access_duration_months, status
      from courses
      where id = $1
      limit 1
    `,
    [courseId]
  );
  const course = rows[0];

  if (course?.status !== "active") {
    throw new Error("Curso indisponivel para compra.");
  }

  const enrollment = await getPool().query<{ id: string }>(
    `
      select id
      from enrollments
      where user_id = $1
        and course_id = $2
        and status = 'active'
        and starts_at <= now()
        and expires_at >= now()
      limit 1
    `,
    [user.id, course.id]
  );

  if (enrollment.rows[0]) {
    return { redirectUrl: `/app/cursos/${course.id}` };
  }

  if (!course.payment_provider_product_id) {
    throw new Error("Curso sem produto AbacatePay configurado.");
  }

  if (course.price_in_cents <= 0) {
    throw new Error("Curso sem preco configurado.");
  }

  const externalId = `order_${randomUUID()}`;
  const checkout = await getAbacatePayClient().createCheckout(
    buildAbacatePayCheckoutRequest({
      accessDurationMonths: course.access_duration_months,
      completionUrl: appUrl(
        `/app/checkout/sucesso?courseId=${encodeURIComponent(course.id)}`
      ),
      courseId: course.id,
      externalId,
      productId: course.payment_provider_product_id,
      returnUrl: appUrl("/app"),
      userId: user.id,
    })
  );

  await getPool().query(
    `
      insert into orders (
        course_id,
        user_id,
        provider_order_id,
        external_id,
        status,
        amount_in_cents,
        customer_email,
        customer_name,
        access_duration_months
      )
      values ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
      on conflict (provider, provider_order_id) do update set
        user_id = excluded.user_id,
        external_id = excluded.external_id,
        amount_in_cents = excluded.amount_in_cents,
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
        access_duration_months = excluded.access_duration_months,
        updated_at = now()
    `,
    [
      course.id,
      user.id,
      checkout.id,
      externalId,
      course.price_in_cents,
      user.email,
      user.name,
      course.access_duration_months,
    ]
  );

  return { redirectUrl: checkout.url };
};

export const processAbacatePayWebhook = async (
  payload: Record<string, unknown>
): Promise<WebhookResult> => {
  const eventName =
    typeof payload.event === "string" ? payload.event : "unknown";
  const eventKey = getAbacatePayEventKey(payload);
  const incomingOrderStatus = mapAbacatePayEventToOrderStatus(eventName);
  const pool = getPool();
  const client = await pool.connect();
  const warnings: string[] = [];
  let accessEmailPayload: {
    courseTitle: string;
    to: string;
    userName: string;
  } | null = null;

  try {
    await client.query("begin");

    const inserted = await client.query<{ id: string }>(
      `
        insert into webhook_events (provider, event_key, event_name, payload)
        values ('abacatepay', $1, $2, $3::jsonb)
        on conflict (provider, event_key) do nothing
        returning id
      `,
      [eventKey, eventName, JSON.stringify(payload)]
    );

    if (inserted.rows.length === 0) {
      await client.query("rollback");
      return { status: "duplicate", eventKey };
    }

    if (incomingOrderStatus === "ignored") {
      await client.query(
        `
          update webhook_events
          set status = 'ignored',
              error_message = 'Evento AbacatePay nao mapeado para pedido.',
              processed_at = now()
          where provider = 'abacatepay' and event_key = $1
        `,
        [eventKey]
      );
      await client.query("commit");
      return { status: "ignored", eventKey };
    }

    const orderPayload = getAbacatePayOrderPayload(payload);

    if (!orderPayload) {
      throw new Error("Webhook AbacatePay sem pedido mapeavel.");
    }

    if (!orderPayload.userId) {
      warnings.push(
        "Webhook AbacatePay sem metadata.userId; aluna resolvida pelo e-mail do pagador."
      );
    }

    const course = await resolveWebhookCourse({
      client,
      metadataCourseId: orderPayload.courseId,
      providerProductId: orderPayload.providerProductId,
      warnings,
    });
    const now = new Date();
    const userId = await resolveWebhookUserId({
      client,
      customerEmail: orderPayload.customerEmail,
      customerName: orderPayload.customerName,
      metadataUserId: orderPayload.userId,
    });

    await client.query(
      `
        insert into profiles (user_id, role, invited_at)
        values ($1, 'student', now())
        on conflict (user_id) do nothing
      `,
      [userId]
    );

    const transition = await getWebhookTransition({
      client,
      incomingOrderStatus,
      providerOrderId: orderPayload.providerOrderId,
    });

    if (incomingOrderStatus !== transition.finalOrderStatus) {
      warnings.push(
        `Evento ${incomingOrderStatus} preservou status terminal ${transition.finalOrderStatus}.`
      );
    }

    const { accessDurationMonths } = await upsertWebhookOrder({
      accessDurationMonths: course.access_duration_months,
      client,
      courseId: course.id,
      finalOrderStatus: transition.finalOrderStatus,
      now,
      orderPayload,
      shouldApplyPaidAccess: transition.shouldApplyPaidAccess,
      shouldApplyRefundRevocation: transition.shouldApplyRefundRevocation,
      userId,
    });
    accessEmailPayload = await applyWebhookEnrollmentTransition({
      accessDurationMonths,
      client,
      course,
      now,
      orderPayload,
      shouldApplyDisputeRevocation: transition.shouldApplyDisputeRevocation,
      shouldApplyPaidAccess: transition.shouldApplyPaidAccess,
      shouldApplyRefundRevocation: transition.shouldApplyRefundRevocation,
      userId,
    });

    await client.query(
      `
        update webhook_events
        set status = 'processed',
            error_message = $2,
            processed_at = now()
        where provider = 'abacatepay' and event_key = $1
      `,
      [eventKey, warnings.length ? warnings.join(" ") : null]
    );

    await client.query("commit");

    await notifyAccessReleased(accessEmailPayload);

    return { status: "processed", eventKey };
  } catch (error) {
    await client.query("rollback");
    await pool.query(
      `
        update webhook_events
        set status = 'failed', error_message = $2
        where provider = 'abacatepay' and event_key = $1
      `,
      [eventKey, error instanceof Error ? error.message : "Erro desconhecido"]
    );
    throw error;
  } finally {
    client.release();
  }
};
