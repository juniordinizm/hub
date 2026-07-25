# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.11 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM oven/bun:1.3.11 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG DEPLOYMENT_VERSION
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG R2_PUBLIC_BASE_URL

ENV DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV R2_PUBLIC_BASE_URL=${R2_PUBLIC_BASE_URL}

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN test -n "${DEPLOYMENT_VERSION}" && test -n "${NEXT_PUBLIC_APP_URL}"
RUN --mount=type=secret,id=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,required=true \
    --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)" && \
    if [ -f /run/secrets/SENTRY_AUTH_TOKEN ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)"; fi && \
    bun run build
RUN bun build scripts/run-scheduled-job.ts --target=node --outfile=dist/run-scheduled-job.mjs
RUN bun build scripts/migrate-production.ts --target=node --outfile=dist/migrate-production.mjs

FROM node:24.18.0-bookworm-slim AS runner
WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Next output tracing does not retain Sharp's shared libvips payload.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img
COPY --from=builder --chown=nextjs:nodejs /app/dist/run-scheduled-job.mjs ./run-scheduled-job.mjs
COPY --from=builder --chown=nextjs:nodejs /app/dist/migrate-production.mjs ./migrate-production.mjs
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const secret=process.env.HEALTHCHECK_SECRET;if(!secret)process.exit(1);fetch('http://127.0.0.1:3000/api/health/ready',{headers:{authorization:'Bearer '+secret}}).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
