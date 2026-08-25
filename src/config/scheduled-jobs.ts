export const scheduledJobs = {
  asaasWebhooks: {
    deadlineMs: 270 * 1000,
    leaseMs: 6 * 60 * 1000,
    path: "/api/cron/asaas-webhooks",
    schedule: "* * * * *",
  },
  enrollments: {
    deadlineMs: 12 * 60 * 1000,
    leaseMs: 15 * 60 * 1000,
    path: "/api/cron/enrollments",
    schedule: "0 10 * * *",
  },
  jmvstream: {
    deadlineMs: 270 * 1000,
    leaseMs: 6 * 60 * 1000,
    path: "/api/cron/jmvstream",
    schedule: "*/5 * * * *",
  },
  outbox: {
    deadlineMs: 270 * 1000,
    leaseMs: 6 * 60 * 1000,
    path: "/api/cron/outbox",
    schedule: "*/5 * * * *",
  },
  "resend-webhooks": {
    deadlineMs: 270 * 1000,
    leaseMs: 6 * 60 * 1000,
    path: "/api/cron/resend-webhooks",
    schedule: "*/5 * * * *",
  },
  maintenance: {
    deadlineMs: 12 * 60 * 1000,
    leaseMs: 15 * 60 * 1000,
    path: "/api/cron/maintenance",
    schedule: "0 4 * * *",
  },
} as const;

export type ScheduledJobName = keyof typeof scheduledJobs;

export const isScheduledJobName = (value: string): value is ScheduledJobName =>
  Object.hasOwn(scheduledJobs, value);
