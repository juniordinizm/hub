import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  applyPaidWebhookAccess,
  applyPaymentRevocation,
} from "@/features/enrollments/server";
import { createPaidAccessReleasedMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import {
  type AbacatePayOrderPayload,
  type AbacatePayOrderTransition,
  buildAbacatePayCheckoutRequest,
  buildAbacatePayProductRequest,
  getAbacatePayEventKey,
  getAbacatePayOrderPayload,
  getAbacatePayOrderTransition,
  getPaymentReviewRequired,
  mapAbacatePayEventToOrderStatus,
  type PersistedOrderStatus,
} from "@/features/payments/abacatepay";
import { AbacatePayClient } from "@/features/payments/abacatepay-client";
import { normalizeBuyerEmail } from "@/features/payments/buyer-identity";
import { getAuth } from "@/lib/auth";
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

interface PersistedWebhookOrder {
  amountInCents: number;
  status: PersistedOrderStatus;
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

const notifyActivationRequired = async (
  email: string | null
): Promise<void> => {
  if (!email) {
    return;
  }

  try {
    await getAuth().api.requestPasswordReset({
      body: {
        email,
        redirectTo: appUrl("/redefinir-senha"),
      },
    });
  } catch {
    // E-mail failure must not block paid webhook processing.
  }
};

const hasCredentialAccount = async ({
  client,
  userId,
}: {
  client: PoolClient;
  userId: string;
}): Promise<boolean> => {
  const credentialAccount = await client.query<{ id: string }>(
    `
      select id from accounts
      where user_id = $1
        and provider_id = 'credential'
      limit 1
    `,
    [userId]
  );

  return Boolean(credentialAccount.rows[0]);
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

  const normalizedEmail = normalizeBuyerEmail(customerEmail);
  const existingUserByEmail = await client.query<{ id: string }>(
    `
      select id
      from users
      where lower(email) = $1
      limit 1
    `,
    [normalizedEmail]
  );

  if (existingUserByEmail.rows[0]) {
    await client.query(
      `
        update users
        set name = $2,
            email = $3,
            updated_at = now()
        where id = $1
      `,
      [existingUserByEmail.rows[0].id, customerName, normalizedEmail]
    );

    return existingUserByEmail.rows[0].id;
  }

  const userResult = await client.query<{ id: string }>(
    `
      insert into users (id, name, email, email_verified)
      values ($1, $2, $3, true)
      on conflict (email) do update set
        name = excluded.name,
        email = excluded.email
      returning id
    `,
    [randomUUID(), customerName, normalizedEmail]
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

const getWebhookOrder = async ({
  client,
  providerOrderId,
}: {
  client: PoolClient;
  providerOrderId: string;
}): Promise<PersistedWebhookOrder | null> => {
  const existingOrder = await client.query<{
    amount_in_cents: number;
    status: PersistedOrderStatus;
  }>(
    `
      select status, amount_in_cents
      from orders
      where provider = 'abacatepay'
        and provider_order_id = $1
      limit 1
    `,
    [providerOrderId]
  );
  const order = existingOrder.rows[0];

  return order
    ? { amountInCents: order.amount_in_cents, status: order.status }
    : null;
};

const createPaymentReview = async ({
  client,
  orderId,
  reason,
  type,
  webhookEventId,
}: {
  client: PoolClient;
  orderId: string;
  reason: string;
  type: "amount_mismatch" | "terminal_conflict";
  webhookEventId: string;
}): Promise<void> => {
  await client.query(
    `
      insert into payment_reviews (order_id, webhook_event_id, type, reason)
      values ($1, $2, $3, $4)
    `,
    [orderId, webhookEventId, type, reason]
  );
};

const confirmRefundRequest = async ({
  client,
  orderId,
}: {
  client: PoolClient;
  orderId: string;
}): Promise<void> => {
  await client.query(
    `
      update refund_requests
      set status = 'confirmed',
          confirmed_at = now(),
          updated_at = now()
      where order_id = $1
        and status = 'requested'
    `,
    [orderId]
  );
};

const registerWebhookEvent = async ({
  client,
  eventKey,
  eventName,
  payload,
  retryFailed,
}: {
  client: PoolClient;
  eventKey: string;
  eventName: string;
  payload: Record<string, unknown>;
  retryFailed: boolean;
}): Promise<string | null> => {
  const inserted = await client.query<{ id: string }>(
    `
      insert into webhook_events (provider, event_key, event_name, payload)
      values ('abacatepay', $1, $2, $3::jsonb)
      on conflict (provider, event_key) do nothing
      returning id
    `,
    [eventKey, eventName, JSON.stringify(payload)]
  );
  const insertedId = inserted.rows[0]?.id;

  if (insertedId || !retryFailed) {
    return insertedId ?? null;
  }

  const retried = await client.query<{ id: string }>(
    `
      update webhook_events
      set status = 'received', error_message = null, processed_at = null
      where provider = 'abacatepay'
        and event_key = $1
        and status = 'failed'
      returning id
    `,
    [eventKey]
  );

  return retried.rows[0]?.id ?? null;
};

const upsertWebhookOrder = async ({
  accessDurationMonths,
  client,
  courseId,
  finalOrderStatus,
  now,
  orderPayload,
  preserveExistingOrder,
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
  preserveExistingOrder: boolean;
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
        user_id = case when $15 then orders.user_id else excluded.user_id end,
        status = case when $15 then orders.status else excluded.status end,
        amount_in_cents = orders.amount_in_cents,
        paid_amount_in_cents = case when $15 then orders.paid_amount_in_cents else excluded.paid_amount_in_cents end,
        payment_method = case when $15 then orders.payment_method else excluded.payment_method end,
        receipt_url = case when $15 then orders.receipt_url else excluded.receipt_url end,
        paid_at = case when $15 then orders.paid_at else coalesce(orders.paid_at, excluded.paid_at) end,
        refunded_at = case when $15 then orders.refunded_at else coalesce(excluded.refunded_at, orders.refunded_at) end,
        customer_email = case when $15 then orders.customer_email else excluded.customer_email end,
        customer_name = case when $15 then orders.customer_name else excluded.customer_name end,
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
      preserveExistingOrder,
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
  activationEmail: string | null;
}> => {
  const orderId = await client
    .query<{ id: string }>(
      `
        select id
        from orders
        where provider = 'abacatepay'
          and provider_order_id = $1
        limit 1
      `,
      [orderPayload.providerOrderId]
    )
    .then((result) => result.rows[0]?.id);

  if (!orderId) {
    throw new Error("Pedido AbacatePay nao foi localizado.");
  }

  if (shouldApplyPaidAccess) {
    const activationRequired = !(await hasCredentialAccount({
      client,
      userId,
    }));

    await applyPaidWebhookAccess({
      accessDurationMonths,
      client,
      courseId: course.id,
      now,
      orderId,
      userId,
    });

    if (!activationRequired) {
      await enqueueOutboxMessage({
        client,
        message: createPaidAccessReleasedMessage({
          courseId: course.id,
          orderId,
          userId,
        }),
      });
    }

    return {
      activationEmail: activationRequired ? orderPayload.customerEmail : null,
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

    if (shouldApplyRefundRevocation) {
      await confirmRefundRequest({ client, orderId });
    }
  }

  return { activationEmail: null };
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
  payload: Record<string, unknown>,
  { retryFailed = false }: { retryFailed?: boolean } = {}
): Promise<WebhookResult> => {
  const eventName =
    typeof payload.event === "string" ? payload.event : "unknown";
  const eventKey = getAbacatePayEventKey(payload);
  const incomingOrderStatus = mapAbacatePayEventToOrderStatus(eventName);
  const pool = getPool();
  const client = await pool.connect();
  const warnings: string[] = [];
  let activationEmail: string | null = null;

  try {
    await client.query("begin");

    const webhookEventId = await registerWebhookEvent({
      client,
      eventKey,
      eventName,
      payload,
      retryFailed,
    });

    if (!webhookEventId) {
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

    const existingOrder = await getWebhookOrder({
      client,
      providerOrderId: orderPayload.providerOrderId,
    });
    const review = getPaymentReviewRequired({
      currentAmountInCents: existingOrder?.amountInCents ?? null,
      currentStatus: existingOrder?.status ?? null,
      incomingAmountInCents:
        orderPayload.paidAmountInCents ?? orderPayload.amountInCents,
      incomingStatus: incomingOrderStatus,
    });
    const transition = getAbacatePayOrderTransition({
      currentStatus: existingOrder?.status ?? null,
      incomingStatus: incomingOrderStatus,
    });
    const effectiveTransition: AbacatePayOrderTransition = review
      ? {
          finalOrderStatus: existingOrder?.status ?? "pending",
          shouldApplyDisputeRevocation: false,
          shouldApplyPaidAccess: false,
          shouldApplyRefundRevocation: false,
        }
      : transition;

    if (review) {
      warnings.push(`Revisao financeira pendente: ${review.reason}`);
    } else if (incomingOrderStatus !== transition.finalOrderStatus) {
      warnings.push(
        `Evento ${incomingOrderStatus} preservou status terminal ${transition.finalOrderStatus}.`
      );
    }

    const order = await upsertWebhookOrder({
      accessDurationMonths: course.access_duration_months,
      client,
      courseId: course.id,
      finalOrderStatus: effectiveTransition.finalOrderStatus,
      now,
      orderPayload,
      preserveExistingOrder: Boolean(review && existingOrder),
      shouldApplyPaidAccess: effectiveTransition.shouldApplyPaidAccess,
      shouldApplyRefundRevocation:
        effectiveTransition.shouldApplyRefundRevocation,
      userId,
    });
    if (review) {
      await createPaymentReview({
        client,
        orderId: order.orderId,
        reason: review.reason,
        type: review.type,
        webhookEventId,
      });
    }
    const accessTransition = await applyWebhookEnrollmentTransition({
      accessDurationMonths: order.accessDurationMonths,
      client,
      course,
      now,
      orderPayload,
      shouldApplyDisputeRevocation:
        effectiveTransition.shouldApplyDisputeRevocation,
      shouldApplyPaidAccess: effectiveTransition.shouldApplyPaidAccess,
      shouldApplyRefundRevocation:
        effectiveTransition.shouldApplyRefundRevocation,
      userId,
    });
    activationEmail = accessTransition.activationEmail;

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

    await notifyActivationRequired(activationEmail);

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

export const resolvePaymentReview = async ({
  actorUserId,
  canResolveTerminalConflicts,
  decision,
  decisionReason,
  reviewId,
}: {
  actorUserId: string;
  canResolveTerminalConflicts: boolean;
  decision: "approved" | "rejected";
  decisionReason: string;
  reviewId: string;
}): Promise<void> => {
  if (!decisionReason.trim()) {
    throw new Error("Informe o motivo da decisao financeira.");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const review = await client.query<{
      access_duration_months: number | null;
      course_id: string;
      order_id: string;
      status: "pending" | "paid" | "cancelled" | "refunded" | "disputed";
      type: "amount_mismatch" | "terminal_conflict";
      user_id: string | null;
    }>(
      `
        select
          payment_reviews.order_id,
          payment_reviews.type,
          orders.status,
          orders.course_id,
          orders.user_id,
          orders.access_duration_months
        from payment_reviews
        join orders on orders.id = payment_reviews.order_id
        where payment_reviews.id = $1
          and payment_reviews.status = 'pending'
        for update of payment_reviews, orders
      `,
      [reviewId]
    );
    const selectedReview = review.rows[0];

    if (!selectedReview) {
      throw new Error("Revisao financeira invalida ou ja resolvida.");
    }

    if (
      selectedReview.type === "terminal_conflict" &&
      !canResolveTerminalConflicts
    ) {
      throw new Error("Somente administradores resolvem conflitos terminais.");
    }

    if (selectedReview.type === "amount_mismatch" && decision === "approved") {
      if (!(selectedReview.user_id && selectedReview.access_duration_months)) {
        throw new Error("Pedido sem dados suficientes para liberar o acesso.");
      }

      const paid = await client.query<{ id: string }>(
        `
          update orders
          set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
          where id = $1 and status = 'pending'
          returning id
        `,
        [selectedReview.order_id]
      );

      if (!paid.rows[0]) {
        throw new Error(
          "O pedido nao esta mais pendente para liberacao manual."
        );
      }

      await applyPaidWebhookAccess({
        accessDurationMonths: selectedReview.access_duration_months,
        client,
        courseId: selectedReview.course_id,
        now: new Date(),
        orderId: selectedReview.order_id,
        userId: selectedReview.user_id,
      });
    }

    await client.query(
      `
        update payment_reviews
        set status = $2,
            decision_reason = $3,
            resolved_by_user_id = $4,
            resolved_at = now(),
            updated_at = now()
        where id = $1
      `,
      [reviewId, decision, decisionReason.trim(), actorUserId]
    );
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, $2, 'payment_review', $3, jsonb_build_object('decision', $4, 'reason', $5))
      `,
      [
        actorUserId,
        "payment_review.resolved",
        reviewId,
        decision,
        decisionReason.trim(),
      ]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const retryFailedAbacatePayWebhook = async ({
  actorUserId,
  webhookEventId,
}: {
  actorUserId: string;
  webhookEventId: string;
}): Promise<WebhookResult> => {
  const event = await getPool().query<{ payload: Record<string, unknown> }>(
    `
      select payload
      from webhook_events
      where id = $1
        and provider = 'abacatepay'
        and status = 'failed'
      limit 1
    `,
    [webhookEventId]
  );
  const payload = event.rows[0]?.payload;

  if (!payload) {
    throw new Error(
      "Somente webhooks AbacatePay falhos podem ser reprocessados."
    );
  }

  const result = await processAbacatePayWebhook(payload, { retryFailed: true });
  await getPool().query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, 'webhook.retried', 'webhook_event', $2)
    `,
    [actorUserId, webhookEventId]
  );
  return result;
};
