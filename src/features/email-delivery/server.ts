import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import type { HostedEmailTemplateName } from "@/features/email/templates-contract";

export const EMAIL_DELIVERY_TOPIC_TAGS = {
  "auth.account-activation": "auth_account_activation",
  "auth.password-reset": "auth_password_reset",
  "email.access-expiry-warning": "email_access_expiry_warning",
  "email.access-released": "email_access_released",
  "email.certificate-issued": "email_certificate_issued",
  "email.course-sales-opened": "email_course_sales_opened",
  "email.support-request": "email_support_request",
} as const;

export type EmailDeliveryTopic = keyof typeof EMAIL_DELIVERY_TOPIC_TAGS;

export interface EmailDeliveryContext {
  correlationId: string;
  idempotencyKey: string;
  outboxMessageId?: string;
  templateAlias: HostedEmailTemplateName;
  topic: EmailDeliveryTopic;
}

interface EmailAttemptRow {
  accepted_at: Date | null;
  automatic_retry_deadline_at: Date | null;
  database_now: Date;
  first_provider_attempt_at: Date | null;
  id: string;
  provider_message_id: string | null;
  request_fingerprint: string;
  status: string;
}

export type EmailDeliveryAttemptDecision =
  | {
      acceptedAt: Date;
      action: "accepted";
      emailMessageId: string;
      providerMessageId: string;
    }
  | { acceptedAt: Date; action: "satisfied"; emailMessageId: string }
  | { action: "send"; emailMessageId: string }
  | { action: "unresolved"; emailMessageId: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TAG_VALUE_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

const canonicalize = (value: unknown): string => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  throw new Error("Email request contains an unsupported fingerprint value.");
};

export const createEmailRequestFingerprint = ({
  authSecret,
  request,
}: {
  authSecret: string;
  request: unknown;
}): string =>
  createHmac("sha256", authSecret)
    .update("email-delivery-request:v1\0", "utf8")
    .update(canonicalize(request), "utf8")
    .digest("hex");

const validateEmailDeliveryContext = (context: EmailDeliveryContext): void => {
  if (!UUID_PATTERN.test(context.correlationId)) {
    throw new Error("Email delivery correlation must be a UUID.");
  }
  if (context.outboxMessageId && !UUID_PATTERN.test(context.outboxMessageId)) {
    throw new Error("Email delivery outbox message must be a UUID.");
  }
  if (
    !context.idempotencyKey ||
    context.idempotencyKey.length > 256 ||
    !(context.topic in EMAIL_DELIVERY_TOPIC_TAGS)
  ) {
    throw new Error("Email delivery topic or idempotency key is invalid.");
  }
};

export const buildResendLifecycleTags = (
  context: EmailDeliveryContext
): Array<{ name: string; value: string }> => {
  validateEmailDeliveryContext(context);
  const topicTag = EMAIL_DELIVERY_TOPIC_TAGS[context.topic];
  const tags = [
    { name: "hub_topic", value: topicTag },
    { name: "hub_correlation", value: context.correlationId },
  ];
  if (
    tags.some(
      ({ name, value }) =>
        !(TAG_VALUE_PATTERN.test(name) && TAG_VALUE_PATTERN.test(value))
    )
  ) {
    throw new Error("Email delivery tag is invalid.");
  }
  return tags;
};

const markAcceptanceUnresolved = async (
  client: Pick<PoolClient, "query">,
  emailMessageId: string
): Promise<void> => {
  await client.query(
    `
      update email_messages
      set status = 'acceptance_unknown',
          acceptance_unknown_at = coalesce(acceptance_unknown_at, now()),
          last_error_code = 'resend_acceptance_unresolved',
          updated_at = now()
      where id = $1 and provider_message_id is null
    `,
    [emailMessageId]
  );
};

export const beginEmailDeliveryAttempt = async ({
  client,
  context,
  requestFingerprint,
}: {
  client: Pick<PoolClient, "query">;
  context: EmailDeliveryContext;
  requestFingerprint: string;
}): Promise<EmailDeliveryAttemptDecision> => {
  validateEmailDeliveryContext(context);
  await client.query(
    `
      insert into email_messages (
        id,
        outbox_message_id,
        correlation_id,
        topic,
        template_alias,
        request_fingerprint
      )
      values ($1, $2, $1, $3, $4, $5)
      on conflict (correlation_id) do nothing
    `,
    [
      context.correlationId,
      context.outboxMessageId ?? null,
      context.topic,
      context.templateAlias,
      requestFingerprint,
    ]
  );
  const selected = await client.query<EmailAttemptRow>(
    `
      select
        id,
        status,
        accepted_at,
        provider_message_id,
        request_fingerprint,
        first_provider_attempt_at,
        automatic_retry_deadline_at,
        now() as database_now
      from email_messages
      where correlation_id = $1
      for update
    `,
    [context.correlationId]
  );
  const row = selected.rows[0];
  if (!row) {
    throw new Error("Email delivery state could not be created.");
  }
  if (row.provider_message_id) {
    return {
      action: "accepted",
      acceptedAt: row.accepted_at ?? row.database_now,
      emailMessageId: row.id,
      providerMessageId: row.provider_message_id,
    };
  }
  if (row.status === "accepted") {
    return {
      acceptedAt: row.accepted_at ?? row.database_now,
      action: "satisfied",
      emailMessageId: row.id,
    };
  }
  const deadlineElapsed =
    row.automatic_retry_deadline_at !== null &&
    row.automatic_retry_deadline_at.getTime() <= row.database_now.getTime();
  if (row.request_fingerprint !== requestFingerprint || deadlineElapsed) {
    await markAcceptanceUnresolved(client, row.id);
    return { action: "unresolved", emailMessageId: row.id };
  }
  if (!row.first_provider_attempt_at) {
    await client.query(
      `
        update email_messages
        set first_provider_attempt_at = now(),
            automatic_retry_deadline_at = now() + interval '23 hours',
            updated_at = now()
        where id = $1 and first_provider_attempt_at is null
      `,
      [row.id]
    );
  }
  return { action: "send", emailMessageId: row.id };
};

export const markEmailAccepted = async ({
  client,
  emailMessageId,
  providerMessageId,
}: {
  client: Pick<PoolClient, "query">;
  emailMessageId: string;
  providerMessageId: string;
}): Promise<{ acceptedAt: Date } | null> => {
  const result = await client.query<{ accepted_at: Date }>(
    `
      update email_messages
      set provider_message_id = $2,
          status = case
            when status in ('sending', 'acceptance_unknown') then 'accepted'
            else status
          end,
          accepted_at = coalesce(accepted_at, now()),
          last_error_code = null,
          updated_at = now()
      where id = $1
        and (provider_message_id is null or provider_message_id = $2)
      returning accepted_at
    `,
    [emailMessageId, providerMessageId]
  );
  const acceptedAt = result.rows[0]?.accepted_at;
  return acceptedAt ? { acceptedAt } : null;
};

export const markEmailIdempotencySatisfied = async ({
  client,
  emailMessageId,
}: {
  client: Pick<PoolClient, "query">;
  emailMessageId: string;
}): Promise<{ acceptedAt: Date } | null> => {
  const result = await client.query<{ accepted_at: Date }>(
    `
      update email_messages
      set status = 'accepted',
          accepted_at = coalesce(accepted_at, now()),
          last_error_code = null,
          updated_at = now()
      where id = $1 and provider_message_id is null
      returning accepted_at
    `,
    [emailMessageId]
  );
  const acceptedAt = result.rows[0]?.accepted_at;
  return acceptedAt ? { acceptedAt } : null;
};

export const markEmailAcceptanceUnknown = async ({
  client,
  emailMessageId,
}: {
  client: Pick<PoolClient, "query">;
  emailMessageId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update email_messages
      set status = 'acceptance_unknown',
          acceptance_unknown_at = coalesce(acceptance_unknown_at, now()),
          last_error_code = 'resend_acceptance_unknown',
          updated_at = now()
      where id = $1
        and provider_message_id is null
        and status in ('sending', 'acceptance_unknown')
    `,
    [emailMessageId]
  );
  return result.rowCount === 1;
};

export const markEmailProviderRejected = async ({
  client,
  emailMessageId,
}: {
  client: Pick<PoolClient, "query">;
  emailMessageId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update email_messages
      set status = 'failed',
          failed_at = coalesce(failed_at, now()),
          last_error_code = 'resend_provider_rejected',
          updated_at = now()
      where id = $1
        and provider_message_id is null
        and status in ('sending', 'acceptance_unknown', 'accepted', 'delayed')
    `,
    [emailMessageId]
  );
  return result.rowCount === 1;
};

export const pruneEmailDeliveryRecords = async ({
  client,
}: {
  client: Pick<PoolClient, "query">;
}): Promise<{ events: number; messages: number }> => {
  const processedEvents = await client.query(`
    with candidates as (
      select id
      from resend_webhook_events
      where status in ('processed', 'ignored')
        and processed_at < now() - interval '180 days'
      order by processed_at
      limit 500
    )
    delete from resend_webhook_events as event
    using candidates
    where event.id = candidates.id
  `);
  const deadLetterEvents = await client.query(`
    with candidates as (
      select id
      from resend_webhook_events
      where status = 'dead_letter'
        and updated_at < now() - interval '365 days'
      order by updated_at
      limit 500
    )
    delete from resend_webhook_events as event
    using candidates
    where event.id = candidates.id
  `);
  const messages = await client.query(`
    with candidates as (
      select message.id
      from email_messages as message
      where message.status in (
        'delivered', 'failed', 'suppressed', 'bounced', 'complained'
      )
        and message.updated_at < now() - interval '365 days'
        and not exists (
          select 1
          from resend_webhook_events as event
          where event.email_message_id = message.id
            and event.status in ('received', 'processing', 'retrying')
        )
      order by message.updated_at
      limit 500
    )
    delete from email_messages as message
    using candidates
    where message.id = candidates.id
  `);
  return {
    events: (processedEvents.rowCount ?? 0) + (deadLetterEvents.rowCount ?? 0),
    messages: messages.rowCount ?? 0,
  };
};
