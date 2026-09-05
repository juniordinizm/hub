import "server-only";
import { getPool } from "@/db";
import {
  assertScheduleFitsAccessDuration,
  buildContentReleaseScheduleSnapshot,
  type ContentReleaseScheduleSnapshot,
} from "@/features/courses/module-content-release";
import {
  CONTENT_RELEASE_SCHEDULE_DIGEST_PATTERN,
  getContentReleaseScheduleDigest,
} from "@/features/courses/module-content-release-digest";
import type { AsaasGateway, CreateAsaasCheckout } from "./asaas";
import { ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS } from "./asaas";
import { AsaasGatewayError } from "./asaas-client";
import { parseBuyerIdentity } from "./buyer-identity";
import { getEffectiveMaxInstallmentCount } from "./course-payment-offer";
import { getApplicationUrl } from "./provider";

const CHECKOUT_EXPIRATION_MINUTES = 60;
const CHECKOUT_ITEM_NAME_MAX_LENGTH = 30;
const CHECKOUT_ITEM_DESCRIPTION_MAX_LENGTH = 150;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PROVIDER_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export interface CheckoutCallbacks {
  cancelUrl: string;
  expiredUrl: string;
  successUrl: string;
}

type CheckoutBuyer =
  | {
      email: string;
      kind: "authenticated";
      name: string;
      userId: string;
    }
  | { kind: "provider_pending" };

export interface CreateAsaasCheckoutIntentInput {
  attemptId: string;
  authorizeNewIntent?: (input: { courseId: string }) => Promise<void>;
  buyer: CheckoutBuyer;
  callbacks: CheckoutCallbacks;
  courseId?: string;
  courseSlug?: string;
  expectedContentReleaseScheduleDigest: string;
  gateway: AsaasGateway;
  now?: () => Date;
}

export type CheckoutIntentResult =
  | {
      orderId: string;
      redirectUrl: string;
      status: "ready";
    }
  | {
      orderId: string;
      status: "failed" | "processing";
    };

export type CheckoutIntentErrorKind = "conflict" | "unavailable" | "validation";
export type CheckoutIntentErrorReason =
  | "active_access"
  | "attempt_invalid"
  | "callbacks_invalid"
  | "course_id_invalid"
  | "course_selection_invalid"
  | "course_unavailable"
  | "identity_invalid"
  | "revoked_access"
  | "schedule_changed"
  | "schedule_digest_invalid";

const CHECKOUT_INTENT_ERROR_MESSAGES: Record<CheckoutIntentErrorKind, string> =
  {
    conflict: "Tentativa de checkout em conflito.",
    unavailable: "Checkout indisponível.",
    validation: "Dados de checkout inválidos.",
  };
const CHECKOUT_INTENT_REASON_MESSAGES: Record<
  CheckoutIntentErrorReason,
  string
> = {
  active_access: "Acesso ao curso já está ativo.",
  attempt_invalid: "Tentativa de checkout inválida.",
  callbacks_invalid: "Callbacks de checkout inválidos.",
  course_id_invalid: "Identificador de curso inválido.",
  course_selection_invalid: "Informe exatamente um curso.",
  course_unavailable: "Curso indisponível para checkout pago.",
  identity_invalid: "Identidade local inválida.",
  revoked_access: "Acesso ao curso está revogado.",
  schedule_changed: "O cronograma do Curso foi atualizado.",
  schedule_digest_invalid: "Digest de cronograma inválido.",
};

export class CheckoutIntentError extends Error {
  readonly kind: CheckoutIntentErrorKind;
  readonly reason: CheckoutIntentErrorReason | null;

  constructor(
    kind: CheckoutIntentErrorKind,
    reason?: CheckoutIntentErrorReason
  ) {
    super(
      reason
        ? CHECKOUT_INTENT_REASON_MESSAGES[reason]
        : CHECKOUT_INTENT_ERROR_MESSAGES[kind]
    );
    this.name = "CheckoutIntentError";
    this.kind = kind;
    this.reason = reason ?? null;
  }
}

interface CheckoutCourse {
  access_duration_months: number;
  description: string | null;
  has_published_publication: boolean;
  id: string;
  payment_allow_credit_card: boolean;
  payment_allow_pix: boolean;
  payment_max_installment_count: number;
  price_in_cents: number;
  release_modules?: Array<{
    releaseDelayDays: number;
    sortOrder: number;
    title: string;
  }> | null;
  sales_status: "closed" | "open";
  slug: string;
  status: string;
  title: string;
}

interface CheckoutOrder {
  access_duration_months: number | null;
  amount_in_cents: number;
  buyer_identity_status: "pending" | "resolved" | "review_required";
  checkout_course_slug: string;
  checkout_item_description: string;
  checkout_item_name: string;
  checkout_status:
    | "active"
    | "cancelled"
    | "creating"
    | "expired"
    | "failed"
    | "pending"
    | "uncertain";
  checkout_url: string | null;
  content_release_schedule_snapshot: ContentReleaseScheduleSnapshot;
  course_id: string;
  customer_email: string | null;
  customer_name: string | null;
  id: string;
  payment_allow_credit_card: boolean;
  payment_allow_pix: boolean;
  payment_max_installment_count: number;
  provider: string;
  provider_checkout_status: string | null;
  user_id: string | null;
}

const normalizeRequired = (value: string): string => value.trim();
const normalizeCourseSlug = (value: string): string =>
  value.trim().toLowerCase();

const truncateUnicode = (value: string, maximumLength: number): string =>
  Array.from(value).slice(0, maximumLength).join("");

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const createCheckoutCallbacks = (
  attemptId: string
): CheckoutCallbacks => {
  if (!UUID_PATTERN.test(attemptId)) {
    throw new CheckoutIntentError("validation", "attempt_invalid");
  }
  const query = `?attemptId=${encodeURIComponent(attemptId)}`;
  return {
    cancelUrl: getApplicationUrl(`/checkout/cancelado${query}`),
    expiredUrl: getApplicationUrl(`/checkout/expirado${query}`),
    successUrl: getApplicationUrl("/checkout/sucesso"),
  };
};

export const resolveCheckoutRetryPath = async (
  attemptId: string | undefined
): Promise<string | null> => {
  if (!(attemptId && UUID_PATTERN.test(attemptId))) {
    return null;
  }

  const result = await getPool().query<{ checkout_course_slug: string }>(
    "select checkout_course_slug from orders where id = $1 and provider = 'asaas' limit 1",
    [attemptId]
  );
  const courseSlug = result.rows[0]?.checkout_course_slug;

  return courseSlug ? `/comprar/${encodeURIComponent(courseSlug)}` : null;
};

const validateInput = ({
  attemptId,
  buyer,
  callbacks,
  courseId,
  courseSlug,
  expectedContentReleaseScheduleDigest,
}: Omit<CreateAsaasCheckoutIntentInput, "gateway" | "now">): {
  courseSlug: string | undefined;
  customerEmail: string | null;
  customerName: string | null;
  expectedContentReleaseScheduleDigest: string;
} => {
  if (!UUID_PATTERN.test(attemptId)) {
    throw new CheckoutIntentError("validation", "attempt_invalid");
  }

  if (Boolean(courseId) === Boolean(courseSlug)) {
    throw new CheckoutIntentError("validation", "course_selection_invalid");
  }
  if (courseId && !UUID_PATTERN.test(courseId)) {
    throw new CheckoutIntentError("validation", "course_id_invalid");
  }
  if (
    !CONTENT_RELEASE_SCHEDULE_DIGEST_PATTERN.test(
      expectedContentReleaseScheduleDigest
    )
  ) {
    throw new CheckoutIntentError("validation", "schedule_digest_invalid");
  }

  const buyerIdentity =
    buyer.kind === "authenticated" ? parseBuyerIdentity(buyer) : null;
  if (
    buyer.kind === "authenticated" &&
    !(buyerIdentity && buyer.userId.trim())
  ) {
    throw new CheckoutIntentError("validation", "identity_invalid");
  }

  if (
    !(
      isHttpUrl(callbacks.cancelUrl) &&
      isHttpUrl(callbacks.expiredUrl) &&
      isHttpUrl(callbacks.successUrl)
    )
  ) {
    throw new CheckoutIntentError("validation", "callbacks_invalid");
  }

  return {
    courseSlug: courseSlug ? normalizeCourseSlug(courseSlug) : undefined,
    customerEmail: buyerIdentity?.email ?? null,
    customerName: buyerIdentity?.name ?? null,
    expectedContentReleaseScheduleDigest,
  };
};

const buildItemSnapshot = (
  course: CheckoutCourse
): CreateAsaasCheckout["item"] => {
  const normalizedTitle = normalizeRequired(course.title);
  const normalizedDescription = course.description?.trim() || normalizedTitle;

  return {
    description: truncateUnicode(
      normalizedDescription,
      CHECKOUT_ITEM_DESCRIPTION_MAX_LENGTH
    ),
    name: truncateUnicode(normalizedTitle, CHECKOUT_ITEM_NAME_MAX_LENGTH),
    valueInCents: course.price_in_cents,
  };
};

const isSameBuyer = ({
  buyer,
  order,
}: {
  buyer: CheckoutBuyer;
  order: CheckoutOrder;
}): boolean =>
  buyer.kind === "authenticated"
    ? order.user_id === buyer.userId &&
      order.buyer_identity_status === "resolved"
    : order.user_id === null && order.buyer_identity_status === "pending";

const resolveDuplicate = ({
  buyer,
  order,
  requestedCourseId,
  requestedCourseSlug,
}: {
  buyer: CheckoutBuyer;
  order: CheckoutOrder;
  requestedCourseId: string | undefined;
  requestedCourseSlug: string | undefined;
}): CheckoutIntentResult => {
  const isSameCourse = requestedCourseId
    ? order.course_id === requestedCourseId
    : normalizeCourseSlug(order.checkout_course_slug) === requestedCourseSlug;

  if (
    order.provider !== "asaas" ||
    !isSameCourse ||
    !isSameBuyer({ buyer, order })
  ) {
    throw new CheckoutIntentError("conflict", "attempt_invalid");
  }

  if (order.checkout_status === "active" && order.checkout_url) {
    return {
      orderId: order.id,
      redirectUrl: order.checkout_url,
      status: "ready",
    };
  }

  if (
    order.checkout_status === "pending" ||
    order.checkout_status === "creating" ||
    order.checkout_status === "uncertain" ||
    order.checkout_status === "active"
  ) {
    return { orderId: order.id, status: "processing" };
  }

  return { orderId: order.id, status: "failed" };
};

const safeGatewayFailure = (
  error: unknown
): {
  checkoutStatus: "failed" | "uncertain";
  message: string;
  resultStatus: "failed" | "processing";
} => {
  if (error instanceof AsaasGatewayError) {
    const providerCode = error.providerCode?.trim();
    const safeProviderCode =
      providerCode && SAFE_PROVIDER_CODE_PATTERN.test(providerCode)
        ? providerCode
        : undefined;
    const messageSuffix = safeProviderCode ? `_${safeProviderCode}` : "";

    return error.outcome === "rejected"
      ? {
          checkoutStatus: "failed",
          message: `asaas_${error.kind}${messageSuffix}_rejected`,
          resultStatus: "failed",
        }
      : {
          checkoutStatus: "uncertain",
          message: `asaas_${error.kind}${messageSuffix}_unknown`,
          resultStatus: "processing",
        };
  }

  return {
    checkoutStatus: "uncertain",
    message: "asaas_unexpected_unknown",
    resultStatus: "processing",
  };
};

const ensureCheckoutAccessEligible = async ({
  buyer,
  courseId,
}: {
  buyer: CheckoutBuyer;
  courseId: string;
}): Promise<void> => {
  if (buyer.kind !== "authenticated") {
    return;
  }

  const enrollment = await getPool().query<{ status: "active" | "revoked" }>(
    `
      select status from enrollments
      where user_id = $1
        and course_id = $2
        and status in ('active', 'revoked')
        and (
          status = 'revoked'
          or (starts_at <= now() and expires_at >= now())
        )
      limit 1
    `,
    [buyer.userId, courseId]
  );
  if (enrollment.rows[0]?.status === "active") {
    throw new CheckoutIntentError("conflict", "active_access");
  }
  if (enrollment.rows[0]?.status === "revoked") {
    throw new CheckoutIntentError("conflict", "revoked_access");
  }
};

interface AttemptResolutionContext {
  buyer: CheckoutBuyer;
  orderId: string;
  pool: ReturnType<typeof getPool>;
  requestedCourseId: string | undefined;
  requestedCourseSlug: string | undefined;
}

const readCheckoutOrder = async ({
  orderId,
  pool,
}: Pick<AttemptResolutionContext, "orderId" | "pool">): Promise<
  CheckoutOrder | undefined
> => {
  const result = await pool.query<CheckoutOrder>(
    `
      select
        id, course_id, user_id, buyer_identity_status, provider, checkout_status, checkout_url,
        provider_checkout_status, amount_in_cents, access_duration_months,
        content_release_schedule_snapshot,
        customer_email, customer_name, checkout_course_slug, checkout_item_name,
        checkout_item_description, payment_allow_pix, payment_allow_credit_card,
        payment_max_installment_count
      from orders
      where id = $1
      limit 1
    `,
    [orderId]
  );
  return result.rows[0];
};

const resolveAfterLostCheckoutCas = async (
  context: AttemptResolutionContext
): Promise<CheckoutIntentResult> => {
  let order: CheckoutOrder | undefined;
  try {
    order = await readCheckoutOrder(context);
  } catch {
    return { orderId: context.orderId, status: "processing" };
  }

  if (!order) {
    return { orderId: context.orderId, status: "processing" };
  }

  return resolveDuplicate({
    buyer: context.buyer,
    order,
    requestedCourseId: context.requestedCourseId,
    requestedCourseSlug: context.requestedCourseSlug,
  });
};

const updateCreatingFailure = async ({
  checkoutStatus,
  message,
  orderId,
  pool,
}: {
  checkoutStatus: "failed" | "uncertain";
  message: string;
  orderId: string;
  pool: ReturnType<typeof getPool>;
}): Promise<boolean> => {
  const updated = await pool.query<{ id: string }>(
    `
      update orders
      set checkout_status = $2,
          checkout_error_message = $3,
          updated_at = now()
      where id = $1 and checkout_status = 'creating'
      returning id
    `,
    [orderId, checkoutStatus, message]
  );
  return Boolean(updated.rows[0]);
};

const preserveOrMarkUncertain = async ({
  context,
  message,
}: {
  context: AttemptResolutionContext;
  message: string;
}): Promise<CheckoutIntentResult> => {
  try {
    const updated = await updateCreatingFailure({
      checkoutStatus: "uncertain",
      message,
      orderId: context.orderId,
      pool: context.pool,
    });
    if (updated) {
      return { orderId: context.orderId, status: "processing" };
    }
  } catch {
    // A releitura abaixo distingue uma transição concorrente de falha do banco.
  }

  return await resolveAfterLostCheckoutCas(context);
};

const authorizeAndClaimAttempt = async ({
  authorizeNewIntent,
  courseId,
  orderId,
  pool,
  timestamp,
}: {
  authorizeNewIntent: CreateAsaasCheckoutIntentInput["authorizeNewIntent"];
  courseId: string;
  orderId: string;
  pool: ReturnType<typeof getPool>;
  timestamp: Date;
}): Promise<boolean> => {
  try {
    await authorizeNewIntent?.({ courseId });
  } catch (error) {
    await pool
      .query(
        `
          delete from orders
          where id = $1
            and provider = 'asaas'
            and status = 'pending'
            and checkout_status = 'pending'
            and provider_checkout_id is null
            and provider_payment_id is null
            and provider_customer_id is null
            and checkout_url is null
            and checkout_attempt_count = 0
            and checkout_last_attempt_at is null
            and checkout_next_attempt_at is null
            and checkout_error_message is null
            and provider_checkout_status is null
            and provider_payment_status is null
            and provider_risk_status is null
            and provider_settlement_status is null
            and provider_refund_status is null
            and provider_dispute_status is null
            and paid_amount_in_cents is null
            and payment_method is null
            and receipt_url is null
            and paid_at is null
            and refunded_at is null
          returning id
        `,
        [orderId]
      )
      .catch(() => undefined);
    throw error;
  }

  const claimed = await pool.query<{ id: string }>(
    `
      update orders
      set checkout_status = 'creating',
          checkout_attempt_count = checkout_attempt_count + 1,
          checkout_last_attempt_at = $2,
          checkout_error_message = null,
          updated_at = now()
      where id = $1 and checkout_status = 'pending'
      returning id
    `,
    [orderId, timestamp]
  );
  return Boolean(claimed.rows[0]);
};

const resolveCheckoutScheduleSnapshot = (
  course: CheckoutCourse
): ContentReleaseScheduleSnapshot => {
  const snapshot = buildContentReleaseScheduleSnapshot(
    (course.release_modules ?? []).map((module) => ({
      releaseDelayDays: module.releaseDelayDays,
      sortOrder: module.sortOrder,
      title: module.title,
    }))
  );
  try {
    assertScheduleFitsAccessDuration({
      accessDurationMonths: course.access_duration_months,
      snapshot,
    });
  } catch {
    throw new CheckoutIntentError("unavailable", "course_unavailable");
  }
  return snapshot;
};

const assertCheckoutScheduleDigest = ({
  expectedDigest,
  snapshot,
}: {
  expectedDigest: string;
  snapshot: ContentReleaseScheduleSnapshot;
}): void => {
  if (expectedDigest !== getContentReleaseScheduleDigest(snapshot)) {
    throw new CheckoutIntentError("conflict", "schedule_changed");
  }
};

export const createAsaasCheckoutIntent = async (
  input: CreateAsaasCheckoutIntentInput
): Promise<CheckoutIntentResult> => {
  const {
    courseSlug: requestedCourseSlug,
    customerEmail,
    customerName,
    expectedContentReleaseScheduleDigest,
  } = validateInput(input);
  const pool = getPool();
  const existingAttempt = await pool.query<CheckoutOrder>(
    `
      select
        id, course_id, user_id, buyer_identity_status, provider, checkout_status, checkout_url,
        provider_checkout_status, amount_in_cents, access_duration_months,
        content_release_schedule_snapshot,
        customer_email, customer_name, checkout_course_slug, checkout_item_name,
        checkout_item_description, payment_allow_pix, payment_allow_credit_card,
        payment_max_installment_count
      from orders
      where id = $1
      limit 1
    `,
    [input.attemptId]
  );
  if (existingAttempt.rows[0]) {
    return resolveDuplicate({
      buyer: input.buyer,
      order: existingAttempt.rows[0],
      requestedCourseId: input.courseId,
      requestedCourseSlug,
    });
  }

  const courseResult = await pool.query<CheckoutCourse>(
    `
      select c.id, c.title, c.slug, c.description, c.price_in_cents,
             c.payment_allow_pix, c.payment_allow_credit_card,
             c.payment_max_installment_count,
             c.access_duration_months, c.status, c.sales_status,
             exists (
               select 1 from course_publications cp
               where cp.course_id = c.id and cp.status = 'published'
             ) as has_published_publication,
             coalesce((
               select json_agg(
                 json_build_object(
                   'title', m.title,
                   'sortOrder', m.sort_order,
                   'releaseDelayDays', m.release_delay_days
                 ) order by m.sort_order asc
               )
               from modules m
               join course_publications cp on cp.id = m.course_publication_id
               where cp.course_id = c.id
                 and cp.status = 'published'
                 and m.status = 'active'
             ), '[]'::json) as release_modules
      from courses c
      where ($1::uuid is not null and c.id = $1::uuid)
         or ($2::text is not null and c.slug = $2::text)
      limit 1
    `,
    [input.courseId ?? null, requestedCourseSlug ?? null]
  );
  const course = courseResult.rows[0];

  if (
    course?.status !== "active" ||
    course.sales_status !== "open" ||
    !course.has_published_publication ||
    course.price_in_cents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS
  ) {
    throw new CheckoutIntentError("unavailable", "course_unavailable");
  }

  const contentReleaseScheduleSnapshot =
    resolveCheckoutScheduleSnapshot(course);
  assertCheckoutScheduleDigest({
    expectedDigest: expectedContentReleaseScheduleDigest,
    snapshot: contentReleaseScheduleSnapshot,
  });

  await ensureCheckoutAccessEligible({
    buyer: input.buyer,
    courseId: course.id,
  });

  const item = buildItemSnapshot(course);
  const externalReference = `order_${input.attemptId}`;
  const timestamp = (input.now ?? (() => new Date()))();
  const inserted = await pool.query<CheckoutOrder>(
    `
      insert into orders (
        id,
        course_id,
        user_id,
        buyer_identity_status,
        provider,
        provider_checkout_id,
        provider_payment_id,
        provider_customer_id,
        external_id,
        status,
        checkout_status,
        checkout_url,
        amount_in_cents,
        access_duration_months,
        content_release_schedule_snapshot,
        customer_email,
        customer_name,
        checkout_course_slug,
        checkout_item_name,
        checkout_item_description,
        payment_allow_pix,
        payment_allow_credit_card,
        payment_max_installment_count,
        checkout_attempt_count
      )
      values (
        $1, $2, $3, $4, 'asaas', null, null, null, $5, 'pending', 'pending',
        null, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 0
      )
      on conflict (id) do nothing
      returning
        id, course_id, user_id, buyer_identity_status, provider, checkout_status, checkout_url,
        provider_checkout_status, amount_in_cents, access_duration_months,
        content_release_schedule_snapshot,
        customer_email, customer_name, checkout_course_slug, checkout_item_name,
        checkout_item_description, payment_allow_pix, payment_allow_credit_card,
        payment_max_installment_count
    `,
    [
      input.attemptId,
      course.id,
      input.buyer.kind === "authenticated" ? input.buyer.userId : null,
      input.buyer.kind === "authenticated" ? "resolved" : "pending",
      externalReference,
      item.valueInCents,
      course.access_duration_months,
      JSON.stringify(contentReleaseScheduleSnapshot),
      customerEmail,
      customerName,
      normalizeCourseSlug(course.slug),
      item.name,
      item.description,
      course.payment_allow_pix,
      course.payment_allow_credit_card,
      getEffectiveMaxInstallmentCount({
        configuredMaxInstallmentCount: course.payment_max_installment_count,
        priceInCents: item.valueInCents,
      }),
    ]
  );
  const createdOrder = inserted.rows[0];

  if (!createdOrder) {
    const existing = await pool.query<CheckoutOrder>(
      `
        select
          id, course_id, user_id, buyer_identity_status, provider, checkout_status, checkout_url,
          provider_checkout_status, amount_in_cents, access_duration_months,
          content_release_schedule_snapshot,
          customer_email, customer_name, checkout_course_slug, checkout_item_name,
          checkout_item_description, payment_allow_pix, payment_allow_credit_card,
          payment_max_installment_count
        from orders
        where id = $1
        limit 1
      `,
      [input.attemptId]
    );
    const existingOrder = existing.rows[0];
    if (!existingOrder) {
      throw new CheckoutIntentError("conflict", "attempt_invalid");
    }
    return resolveDuplicate({
      buyer: input.buyer,
      order: existingOrder,
      requestedCourseId: input.courseId,
      requestedCourseSlug,
    });
  }

  const attemptContext: AttemptResolutionContext = {
    buyer: input.buyer,
    orderId: input.attemptId,
    pool,
    requestedCourseId: input.courseId,
    requestedCourseSlug,
  };

  const claimed = await authorizeAndClaimAttempt({
    authorizeNewIntent: input.authorizeNewIntent,
    courseId: course.id,
    orderId: input.attemptId,
    pool,
    timestamp,
  });
  if (!claimed) {
    return await resolveAfterLostCheckoutCas(attemptContext);
  }

  try {
    const checkout = await input.gateway.createCheckout({
      callback: input.callbacks,
      expirationMinutes: CHECKOUT_EXPIRATION_MINUTES,
      externalReference,
      item: {
        description: createdOrder.checkout_item_description,
        name: createdOrder.checkout_item_name,
        valueInCents: createdOrder.amount_in_cents,
      },
      paymentOptions: {
        allowCreditCard: createdOrder.payment_allow_credit_card,
        allowPix: createdOrder.payment_allow_pix,
        maxInstallmentCount: createdOrder.payment_max_installment_count,
      },
    });

    let successPersisted: boolean;
    try {
      const persisted = await pool.query<{ id: string }>(
        `
          update orders
          set provider_checkout_id = $2,
              checkout_url = $3,
              provider_checkout_status = $4,
              checkout_status = 'active',
              checkout_error_message = null,
              updated_at = now()
          where id = $1 and checkout_status = 'creating'
          returning id
        `,
        [input.attemptId, checkout.id, checkout.link, checkout.status]
      );
      successPersisted = Boolean(persisted.rows[0]);
    } catch {
      return await preserveOrMarkUncertain({
        context: attemptContext,
        message: "asaas_success_persistence_unknown",
      });
    }
    if (!successPersisted) {
      return await resolveAfterLostCheckoutCas(attemptContext);
    }

    return {
      orderId: input.attemptId,
      redirectUrl: checkout.link,
      status: "ready",
    };
  } catch (error) {
    const failure = safeGatewayFailure(error);
    let failurePersisted: boolean;
    try {
      failurePersisted = await updateCreatingFailure({
        checkoutStatus: failure.checkoutStatus,
        message: failure.message,
        orderId: input.attemptId,
        pool,
      });
    } catch {
      return await preserveOrMarkUncertain({
        context: attemptContext,
        message: "asaas_failure_persistence_unknown",
      });
    }
    if (!failurePersisted) {
      return await resolveAfterLostCheckoutCas(attemptContext);
    }

    return { orderId: input.attemptId, status: failure.resultStatus };
  }
};
