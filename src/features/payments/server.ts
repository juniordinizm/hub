import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getPool } from "@/db";
import { sendAccessReleasedEmail } from "@/features/email/server";
import { addMonths } from "@/features/enrollments/rules";
import {
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  mapAbacatePayEventToOrderStatus,
} from "@/features/payments/abacatepay";
import { getServerEnv } from "@/lib/env";

interface WebhookResult {
  eventKey: string;
  status: "processed" | "ignored" | "duplicate";
}

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

const getSignatureParts = (
  signature: string
): { timestamp: string; hash: string } | null => {
  const parts = new Map(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value] as const;
    })
  );
  const timestamp = parts.get("t");
  const hash = parts.get("v1");

  return timestamp && hash ? { timestamp, hash } : null;
};

export const verifyAbacatePaySignature = ({
  payload,
  signature,
  secret,
}: {
  payload: string;
  signature: string | null;
  secret: string | undefined;
}): boolean => {
  if (!secret) {
    return getServerEnv().NODE_ENV !== "production";
  }

  if (!signature) {
    return false;
  }

  const parts = getSignatureParts(signature);

  if (!parts) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${parts.timestamp}.${payload}`)
    .digest("hex");
  const receivedBuffer = Buffer.from(parts.hash, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
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
    const userResult = await client.query<{ id: string }>(
      `
        insert into users (id, name, email, email_verified)
        values ($1, $2, $3, true)
        on conflict (email) do update set name = excluded.name
        returning id
      `,
      [randomUUID(), orderPayload.customerName, orderPayload.customerEmail]
    );
    const userId = userResult.rows[0]?.id;

    if (!userId) {
      throw new Error("Nao foi possivel criar ou localizar a aluna.");
    }

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
          status = excluded.status,
          paid_amount_in_cents = excluded.paid_amount_in_cents,
          payment_method = excluded.payment_method,
          receipt_url = excluded.receipt_url,
          paid_at = coalesce(orders.paid_at, excluded.paid_at),
          refunded_at = excluded.refunded_at,
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
