export const scheduledJobs = {
  enrollments: {
    path: "/api/cron/enrollments",
    schedule: "0 10 * * *",
    timeoutMs: 10 * 60 * 1000,
  },
  jmvstream: {
    path: "/api/cron/jmvstream",
    schedule: "*/5 * * * *",
    timeoutMs: 4 * 60 * 1000,
  },
  outbox: {
    path: "/api/cron/outbox",
    schedule: "*/5 * * * *",
    timeoutMs: 4 * 60 * 1000,
  },
  maintenance: {
    path: "/api/cron/maintenance",
    schedule: "0 4 * * *",
    timeoutMs: 10 * 60 * 1000,
  },
} as const;

export type ScheduledJobName = keyof typeof scheduledJobs;

export const isScheduledJobName = (value: string): value is ScheduledJobName =>
  Object.hasOwn(scheduledJobs, value);
