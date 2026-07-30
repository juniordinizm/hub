import "server-only";
import { getPool } from "@/db";
import type { AsaasGateway, CreateAsaasCheckout } from "./asaas";
import { ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS } from "./asaas";
import { AsaasGatewayError } from "./asaas-client";
import { normalizeBuyerEmail } from "./buyer-identity";

const CHECKOUT_EXPIRATION_MINUTES = 60;
const CHECKOUT_ITEM_NAME_MAX_LENGTH = 30;
const CHECKOUT_ITEM_DESCRIPTION_MAX_LENGTH = 150;
const BUYER_EMAIL_MAX_LENGTH = 254;
const BUYER_EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const BUYER_NAME_MAX_LENGTH = 120;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUYER_EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

interface CheckoutCallbacks {
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
  | {
      email: string;
      kind: "public";
      name: string;
    };

export interface CreateAsaasCheckoutIntentInput {
  attemptId: string;
  authorizeNewIntent?: (input: { courseId: string }) => Promise<void>;
  buyer: CheckoutBuyer;
  callbacks: CheckoutCallbacks;
  courseId?: string;
  courseSlug?: string;
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

const CHECKOUT_INTENT_ERROR_MESSAGES: Record<CheckoutIntentErrorKind, string> =
  {
    conflict: "Tentativa de checkout em conflito.",
    unavailable: "Checkout indisponível.",
    validation: "Dados de checkout inválidos.",
  };
type CheckoutIntentErrorReason =
  | "active_access"
  | "attempt_invalid"
  | "callbacks_invalid"
  | "course_id_invalid"
  | "course_selection_invalid"
  | "course_unavailable"
  | "identity_invalid";
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
};

export class CheckoutIntentError extends Error {
  readonly kind: CheckoutIntentErrorKind;

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
  }
}

interface CheckoutCourse {
  access_duration_months: number;
  description: string | null;
  id: string;
  price_in_cents: number;
  slug: string;
  status: string;
  title: string;
}

interface CheckoutOrder {
  access_duration_months: number | null;
  amount_in_cents: number;
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
  course_id: string;
  customer_email: string | null;
  customer_name: string | null;
  id: string;
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

const validateInput = ({
  attemptId,
  buyer,
  callbacks,
  courseId,
  courseSlug,
}: Omit<CreateAsaasCheckoutIntentInput, "gateway" | "now">): {
  courseSlug: string | undefined;
  customerEmail: string;
  customerName: string;
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

  const customerEmail = normalizeBuyerEmail(buyer.email);
  const customerName = normalizeRequired(buyer.name);
  const emailLocalPart = customerEmail.split("@", 1)[0] ?? "";
  if (
    customerEmail.length > BUYER_EMAIL_MAX_LENGTH ||
    emailLocalPart.length > BUYER_EMAIL_LOCAL_PART_MAX_LENGTH ||
    !BUYER_EMAIL_PATTERN.test(customerEmail) ||
    !customerName ||
    Array.from(customerName).length > BUYER_NAME_MAX_LENGTH
  ) {
    throw new CheckoutIntentError("validation", "identity_invalid");
  }
  if (buyer.kind === "authenticated" && !buyer.userId.trim()) {
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
    customerEmail,
    customerName,
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
  customerEmail,
  customerName,
  order,
}: {
  buyer: CheckoutBuyer;
  customerEmail: string;
  customerName: string;
  order: CheckoutOrder;
}): boolean => {
  if (buyer.kind === "authenticated") {
    return order.user_id === buyer.userId;
  }

  return (
    order.user_id === null &&
    order.customer_email !== null &&
    normalizeBuyerEmail(order.customer_email) === customerEmail &&
    order.customer_name?.trim() === customerName
  );
};

const resolveDuplicate = ({
  buyer,
  customerEmail,
  customerName,
  order,
  requestedCourseId,
  requestedCourseSlug,
}: {
  buyer: CheckoutBuyer;
  customerEmail: string;
  customerName: string;
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
    !isSameBuyer({ buyer, customerEmail, customerName, order })
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
    return error.outcome === "rejected"
      ? {
          checkoutStatus: "failed",
          message: `asaas_${error.kind}_rejected`,
          resultStatus: "failed",
        }
      : {
          checkoutStatus: "uncertain",
          message: `asaas_${error.kind}_unknown`,
          resultStatus: "processing",
        };
  }

  return {
    checkoutStatus: "uncertain",
    message: "asaas_unexpected_unknown",
    resultStatus: "processing",
  };
};

const ensureNoActiveAccess = async ({
  buyer,
  courseId,
}: {
  buyer: CheckoutBuyer;
  courseId: string;
}): Promise<void> => {
  if (buyer.kind !== "authenticated") {
    return;
  }

  const activeEnrollment = await getPool().query<{ id: string }>(
    `
      select id from enrollments
      where user_id = $1
        and course_id = $2
        and status = 'active'
        and starts_at <= now()
        and expires_at >= now()
      limit 1
    `,
    [buyer.userId, courseId]
  );
  if (activeEnrollment.rows[0]) {
    throw new CheckoutIntentError("conflict", "active_access");
  }
};

interface AttemptResolutionContext {
  buyer: CheckoutBuyer;
  customerEmail: string;
  customerName: string;
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
        id, course_id, user_id, provider, checkout_status, checkout_url,
        provider_checkout_status, amount_in_cents, access_duration_months,
        customer_email, customer_name, checkout_course_slug, checkout_item_name,
        checkout_item_description
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
    customerEmail: context.customerEmail,
    customerName: context.customerName,
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

export const createAsaasCheckoutIntent = async (
  input: CreateAsaasCheckoutIntentInput
): Promise<CheckoutIntentResult> => {
  const {
    courseSlug: requestedCourseSlug,
    customerEmail,
    customerName,
  } = validateInput(input);
  const pool = getPool();
  const existingAttempt = await pool.query<CheckoutOrder>(
    `
      select
        id, course_id, user_id, provider, checkout_status, checkout_url,
        provider_checkout_status, amount_in_cents, access_duration_months,
        customer_email, customer_name, checkout_course_slug, checkout_item_name,
        checkout_item_description
      from orders
      where id = $1
      limit 1
    `,
    [input.attemptId]
  );
  if (existingAttempt.rows[0]) {
    return resolveDuplicate({
      buyer: input.buyer,
      customerEmail,
      customerName,
      order: existingAttempt.rows[0],
      requestedCourseId: input.courseId,
      requestedCourseSlug,
    });
  }

  const courseResult = await pool.query<CheckoutCourse>(
    `
      select id, title, slug, description, price_in_cents, access_duration_months, status
      from courses
      where ($1::uuid is not null and id = $1::uuid)
         or ($2::text is not null and slug = $2::text)
      limit 1
    `,
    [input.courseId ?? null, requestedCourseSlug ?? null]
  );
  const course = courseResult.rows[0];

  if (
    course?.status !== "active" ||
    course.price_in_cents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS
  ) {
    throw new CheckoutIntentError("unavailable", "course_unavailable");
  }

  await ensureNoActiveAccess({ buyer: input.buyer, courseId: course.id });

  const item = buildItemSnapshot(course);
  const externalReference = `order_${input.attemptId}`;
  const timestamp = (input.now ?? (() => new Date()))();
  const inserted = await pool.query<CheckoutOrder>(
    `
      insert into orders (
        id,
        course_id,
        user_id,
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
        customer_email,
        customer_name,
        checkout_course_slug,
        checkout_item_name,
        checkout_item_description,
        checkout_attempt_count
      )
      values (
        $1, $2, $3, 'asaas', null, null, null, $4, 'pending', 'pending',
        null, $5, $6, $7, $8, $9, $10, $11, 0
      )
      on conflict (id) do nothing
      returning
        id, course_id, user_id, provider, checkout_status, checkout_url,
        provider_checkout_status, amount_in_cents, access_duration_months,
        customer_email, customer_name, checkout_course_slug, checkout_item_name,
        checkout_item_description
    `,
    [
      input.attemptId,
      course.id,
      input.buyer.kind === "authenticated" ? input.buyer.userId : null,
      externalReference,
      item.valueInCents,
      course.access_duration_months,
      customerEmail,
      customerName,
      normalizeCourseSlug(course.slug),
      item.name,
      item.description,
    ]
  );
  const createdOrder = inserted.rows[0];

  if (!createdOrder) {
    const existing = await pool.query<CheckoutOrder>(
      `
        select
          id, course_id, user_id, provider, checkout_status, checkout_url,
          provider_checkout_status, amount_in_cents, access_duration_months,
          customer_email, customer_name, checkout_course_slug, checkout_item_name,
          checkout_item_description
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
      customerEmail,
      customerName,
      order: existingOrder,
      requestedCourseId: input.courseId,
      requestedCourseSlug,
    });
  }

  const attemptContext: AttemptResolutionContext = {
    buyer: input.buyer,
    customerEmail,
    customerName,
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
