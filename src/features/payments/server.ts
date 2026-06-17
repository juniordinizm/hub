import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { sendAccessReleasedEmail } from "@/features/email/server";
import { addMonths } from "@/features/enrollments/rules";
import {
  buildAbacatePayCheckoutRequest,
  buildAbacatePayProductRequest,
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  mapAbacatePayEventToOrderStatus,
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
    id: string;
    payment_provider_product_id: string | null;
    price_in_cents: number;
    status: string;
  }>(
    `
      select id, payment_provider_product_id, price_in_cents, status
      from courses
      where id = $1
      limit 1
    `,
    [courseId]
  );
  const course = rows[0];

  if (!course || course.status !== "active") {
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
        customer_name
      )
      values ($1, $2, $3, $4, 'pending', $5, $6, $7)
      on conflict (provider, provider_order_id) do update set
        user_id = excluded.user_id,
        external_id = excluded.external_id,
        amount_in_cents = excluded.amount_in_cents,
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
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
  const orderStatus = mapAbacatePayEventToOrderStatus(eventName);
  const pool = getPool();
  const client = await pool.connect();
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

    if (orderStatus === "ignored") {
      await client.query(
        `
          update webhook_events
          set status = 'ignored', processed_at = now()
          where provider = 'abacatepay' and event_key = $1
        `,
        [eventKey]
      );
      await client.query("commit");
      return { status: "ignored", eventKey };
    }

    const orderPayload = getAbacatePayOrderPayload(payload);

    if (!orderPayload?.providerProductId) {
      throw new Error("Webhook AbacatePay sem produto mapeavel.");
    }

    const courseResult = await client.query<{
      title: string;
      id: string;
      access_duration_months: number;
    }>(
      `
        select id, title, access_duration_months
        from courses
        where payment_provider_product_id = $1
        limit 1
      `,
      [orderPayload.providerProductId]
    );
    const course = courseResult.rows[0];

    if (!course) {
      throw new Error("Produto AbacatePay nao esta mapeado para nenhum curso.");
    }

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

    await client.query(
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
          customer_name
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        on conflict (provider, provider_order_id) do update set
          user_id = excluded.user_id,
          status = excluded.status,
          amount_in_cents = excluded.amount_in_cents,
          paid_amount_in_cents = excluded.paid_amount_in_cents,
          payment_method = excluded.payment_method,
          receipt_url = excluded.receipt_url,
          paid_at = coalesce(orders.paid_at, excluded.paid_at),
          refunded_at = excluded.refunded_at,
          customer_email = excluded.customer_email,
          customer_name = excluded.customer_name,
          updated_at = now()
      `,
      [
        course.id,
        userId,
        orderPayload.providerOrderId,
        orderPayload.externalId,
        orderStatus,
        orderPayload.amountInCents,
        orderPayload.paidAmountInCents,
        orderPayload.paymentMethod,
        orderPayload.receiptUrl,
        orderStatus === "paid" ? now : null,
        orderStatus === "refunded" ? now : null,
        orderPayload.customerEmail,
        orderPayload.customerName,
      ]
    );

    if (orderStatus === "paid") {
      const enrollment = await client.query<{ expires_at: Date | null }>(
        `
          select expires_at
          from enrollments
          where user_id = $1 and course_id = $2
          limit 1
        `,
        [userId, course.id]
      );
      const currentExpiresAt = enrollment.rows[0]?.expires_at ?? null;
      const renewalBase =
        currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
      const expiresAt = addMonths(renewalBase, course.access_duration_months);

      await client.query(
        `
          insert into enrollments (user_id, course_id, status, starts_at, expires_at)
          values ($1, $2, 'active', $3, $4)
          on conflict (user_id, course_id) do update set
            status = 'active',
            expires_at = excluded.expires_at,
            revoked_at = null,
            revoked_reason = null,
            updated_at = now()
        `,
        [userId, course.id, now, expiresAt]
      );
      accessEmailPayload = {
        courseTitle: course.title,
        to: orderPayload.customerEmail,
        userName: orderPayload.customerName,
      };
    }

    if (orderStatus === "refunded") {
      await client.query(
        `
          update enrollments
          set status = 'revoked',
              revoked_at = now(),
              revoked_reason = 'abacatepay_refund',
              updated_at = now()
          where user_id = $1 and course_id = $2
        `,
        [userId, course.id]
      );
    }

    await client.query(
      `
        update webhook_events
        set status = 'processed', processed_at = now()
        where provider = 'abacatepay' and event_key = $1
      `,
      [eventKey]
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
